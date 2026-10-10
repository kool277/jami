/**
 *  Copyright (C) 2024 Savoir-faire Linux Inc.
 *
 *  This program is free software; you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation; either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program; if not, write to the Free Software
 *  Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301 USA.
 */

#include "SegmentationVideoSubscriber.h"
extern "C" {
#include <libavutil/display.h>
}
#include <accel.h>
#include <frameUtils.h>
#include <frameScaler.h>
#include <pluglog.h>
#include <stdio.h>
#include <opencv2/imgproc.hpp>
const std::string TAG = "Segmentation";
const char sep = separator();

namespace jami {

SegmentationVideoSubscriber::SegmentationVideoSubscriber(const std::string& dataPath)
    : path_ {dataPath}, env(ORT_LOGGING_LEVEL_WARNING, "test")
{
    initModel();
    inferenceThread = std::thread(&SegmentationVideoSubscriber::inferenceThreadFunc, this);
}

SegmentationVideoSubscriber::~SegmentationVideoSubscriber()
{
    {
        std::lock_guard<std::mutex> lock(queueMutex);
        stopThread = true;
    }
    queueCondVar.notify_all();
    inferenceThread.join();

    std::ostringstream oss;
    oss << "~SegmentationVideoSubscriber" << std::endl;
    Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
}

void SegmentationVideoSubscriber::inferenceThreadFunc()
{
    while (true) {
        cv::Mat frameToProcess;
        {
            std::unique_lock<std::mutex> lock(queueMutex);
            queueCondVar.wait(lock, [this] { return !frameQueue.empty() || stopThread; });

            if (stopThread && frameQueue.empty())
                break;

            frameToProcess = frameQueue.front();
            frameQueue.pop();
        }

        if (!frameToProcess.empty()) {
            auto start = std::chrono::high_resolution_clock::now();
            detections = Detect(frameToProcess);
            auto end = std::chrono::high_resolution_clock::now();
            std::chrono::duration<double> elapsed_seconds = end - start;
            Plog::log(Plog::LogPriority::INFO, TAG, "Inference time: " + std::to_string(elapsed_seconds.count()) + "s");
            inferenceTime = "Inference time: " + std::to_string(elapsed_seconds.count()) + "s";
            updateTrackedObjects(detections);
        }
    }
}

void SegmentationVideoSubscriber::updateTrackedObjects(const std::vector<Detection>& detections) {
    // Update the tracked objects with the new detections, to stabilize the results between frames
    // You can adjust the max_frames_to_persist parameter to keep the objects longer

    for (auto& obj : tracked_objects) {
        obj.frames_since_seen++;
    }

    for (const auto& det : detections) {
        float best_iou = 0.0f;
        TrackedObject* best_match = nullptr;

        for (auto& obj : tracked_objects) {
            if (obj.detection.class_id != det.class_id)
                continue;

            float iou = calculateIoU(obj.detection.box, det.box);
            if (iou > best_iou) {
                best_iou = iou;
                best_match = &obj;
            }
        }

        if (best_match && best_iou > 0.3f) {
            best_match->detection = det;
            best_match->frames_since_seen = 0;
        } else {
            TrackedObject new_obj;
            new_obj.id = next_id++;
            new_obj.detection = det;
            new_obj.frames_since_seen = 0;
            tracked_objects.push_back(new_obj);
        }
    }

    tracked_objects.erase(
        std::remove_if(tracked_objects.begin(), tracked_objects.end(),
            [this](const TrackedObject& obj) {
                return obj.frames_since_seen > max_frames_to_persist;
            }),
        tracked_objects.end()
    );
}

void
SegmentationVideoSubscriber::initModel() {

    // The model used is yolo11n-seg.onnx
    // It is the nano version of the yolo 11 model
    // The model is trained on the COCO dataset and is able to detect 80 classes of objects.
    // It has been converted form PyTorch to ONNX format with IR 9 version, to be compatible with onnxruntime1.16.3
    // the model takes a 1x3x640x640 input tensor and outputs 2 tensors of shape 1x116x8400 and 1x32x160x160:
    // input: images, [Batch_size, channels, height, width].
    // output0: output0, [Batch_size, 4 positions + 80 classes + 32 mask coefficients, raw_boxes].
    // output1: output1, [Batch_size, raw_masks, height, width].
    // To extract the mask of the detected object, the model outputs 32 mask coefficients that are multiplied by 160x160 mask prototypes.

    Plog::log(Plog::LogPriority::INFO, TAG, "Initialisation du modèle yolo11n-seg.onnx");
    Ort::SessionOptions session_options;
    session_options.SetIntraOpNumThreads(1);
    const std::string& modelpath = path_ + "/model/yolo11n-seg.onnx";
    session = std::make_unique<Ort::Session>(env, modelpath.c_str(), session_options);
    Plog::log(Plog::LogPriority::INFO, TAG, "Modèle chargé");
}

void
SegmentationVideoSubscriber::update(jami::Observable<AVFrame*>*, AVFrame* const& pluginFrame)
{
    if (!pluginFrame)
        return;
    frameCounter++;

    //======================================================================================
    // GET FRAME ROTATION
    AVFrameSideData* side_data = av_frame_get_side_data(pluginFrame, AV_FRAME_DATA_DISPLAYMATRIX);

    int angle {0};
    if (side_data) {
        auto matrix_rotation = reinterpret_cast<int32_t*>(side_data->data);
        angle = static_cast<int>(av_display_rotation_get(matrix_rotation));
    }

    //======================================================================================
    // GET RAW FRAME
    // Use a non-const Frame
    // Convert input frame to RGB
    uniqueFramePtr rgbFrame = {transferToMainMemory(pluginFrame, AV_PIX_FMT_NV12), frameFree};
    rgbFrame.reset(FrameScaler::convertFormat(rgbFrame.get(), AV_PIX_FMT_RGB24));
    if (!rgbFrame.get())
        return;
    resultFrame = cv::Mat {rgbFrame->height,
                           rgbFrame->width,
                           CV_8UC3,
                           rgbFrame->data[0],
                           static_cast<size_t>(rgbFrame->linesize[0])};

    // First clone the frame as the original one is unusable because of
    // linespace

    processingFrame = resultFrame.clone();

    rotateFrame(angle, processingFrame);

    // Thread
    {
        std::lock_guard<std::mutex> lock(queueMutex);
        if (frameQueue.size() >= maxQueueSize) {
            frameQueue.pop();
        }
        frameQueue.push(processingFrame.clone()); // Clone is needed, else there is issues when rotated at 180°
    }
    queueCondVar.notify_one();
    // save processingFrame in a file

    drawSegmentation(angle);

    rotateFrame(-angle, processingFrame);

    copyByLine(rgbFrame->linesize[0]);

    //======================================================================================
    // REPLACE AVFRAME DATA WITH FRAME DATA
    rgbFrame.reset(FrameScaler::convertFormat(rgbFrame.get(), AV_PIX_FMT_YUV420P));
    moveFrom(pluginFrame, rgbFrame.get());
}

void
SegmentationVideoSubscriber::drawSegmentation(const int angle)
{
    if (!processingFrame.empty()) {
        if (!tracked_objects.empty()){
            DrawFinalDet(tracked_objects);
        }
    }
}

std::vector<SegmentationVideoSubscriber::Detection>
SegmentationVideoSubscriber::Detect(cv::Mat frameToProcess) {

    cv::Mat image = frameToProcess.clone();
    if (image.empty()) {
        return detections;
    }
    const char* input_names[] = {"images"};
    const char* output_names[] = {"output0", "output1"};

    int img_width = image.cols;
    int img_height = image.rows;

    const int input_width = 640;
    const int input_height = 640;
    float scale;
    int top, left;

    cv::Mat resized_image = resizeWithPadding(image, cv::Size(input_width, input_height), scale, top, left);
    // Convert to float32 and normalize
    resized_image.convertTo(resized_image, CV_32F, 1.0 / 255.0);

    // convert form BGR to RGB (OpenCV uses BGR by default)
    cv::cvtColor(resized_image, resized_image, cv::COLOR_BGR2RGB);

    // Transpose channels to match the model's input format (HWC -> CHW)
    std::vector<cv::Mat> chw(3);
    cv::split(resized_image, chw);
    // Flatten the image to a 1D array
    std::vector<float> input_tensor_values;
    for (int i = 0; i < 3; ++i) {
        input_tensor_values.insert(input_tensor_values.end(), (float*)chw[i].datastart, (float*)chw[i].dataend);
    }

    std::vector<int64_t> input_shape = {1, 3, input_height, input_width};
    // Create input tensor
    Ort::MemoryInfo memory_info = Ort::MemoryInfo::CreateCpu(OrtArenaAllocator, OrtMemTypeDefault);
    Ort::Value input_tensor = Ort::Value::CreateTensor<float>(
        memory_info, input_tensor_values.data(), input_tensor_values.size(),
        input_shape.data(), input_shape.size()
    );
    // Run inference
    auto output_tensors = session->Run(
        Ort::RunOptions{nullptr},
        input_names, &input_tensor, 1,
        output_names, 2
    );

    // Get the output tensor values
    float* output0_data = output_tensors[0].GetTensorMutableData<float>();
    std::vector<int64_t> output0_shape = output_tensors[0].GetTensorTypeAndShapeInfo().GetShape();

    float* output1_data = output_tensors[1].GetTensorMutableData<float>();
    std::vector<int64_t> output1_shape = output_tensors[1].GetTensorTypeAndShapeInfo().GetShape();

    int num_channels = output0_shape[1];     // 116
    int num_predictions = output0_shape[2];  // 8400

    int mask_dim = 32; // Mask coefficients
    int mask_h = output1_shape[2]; // Masks height (160)
    int mask_w = output1_shape[3]; // Masks width (160)

    // Convert output to cv::Mat
    cv::Mat output0 = cv::Mat(num_channels, num_predictions, CV_32F, output0_data);
    output0 = output0.t(); // Transpose for each line to be a prediction

    // Convert output1 to cv::Mat
    cv::Mat mask_protos = cv::Mat(mask_dim, mask_h * mask_w, CV_32F, output1_data);

    std::vector<Detection> detections;
    float conf_threshold = 0.25f;
    float nms_threshold = 0.45f;
    int num_classes = 80; // Classes of dataset COCO

    // Save the predictions
    std::vector<cv::Mat> mask_coef_vectors;

    for (int i = 0; i < output0.rows; ++i) {
        float* data = output0.ptr<float>(i);

        // Coordonates of the bounding box
        float x = data[0];
        float y = data[1];
        float w = data[2];
        float h = data[3];

        // Classes scores
        float* scores = &data[4];

        // Get max score and class
        auto max_class_score = std::max_element(scores, scores + num_classes);
        float confidence = *max_class_score;
        int class_id = std::distance(scores, max_class_score);

        if (confidence >= conf_threshold) {
            // Search box coordinates in the original image
            float x0 = (x - w / 2.0f);
            float y0 = (y - h / 2.0f);
            float x1 = (x + w / 2.0f);
            float y1 = (y + h / 2.0f);

            // Adjust with padding and scale
            x0 = (x0 - left) / scale;
            y0 = (y0 - top) / scale;
            x1 = (x1 - left) / scale;
            y1 = (y1 - top) / scale;

            // Stay in the image boundaries
            x0 = std::max(0.0f, std::min(x0, static_cast<float>(img_width - 1)));
            y0 = std::max(0.0f, std::min(y0, static_cast<float>(img_height - 1)));
            x1 = std::max(0.0f, std::min(x1, static_cast<float>(img_width - 1)));
            y1 = std::max(0.0f, std::min(y1, static_cast<float>(img_height - 1)));

            cv::Rect box(cv::Point(static_cast<int>(x0), static_cast<int>(y0)),
                         cv::Point(static_cast<int>(x1), static_cast<int>(y1)));

            // Extract mask coeficients
            float* mask_coef_data = &data[4 + num_classes];
            cv::Mat mask_coef = cv::Mat(1, mask_dim, CV_32F, mask_coef_data).clone(); // Clone pour copier les données

            Detection det;
            det.box = box;
            det.confidence = confidence;
            det.class_id = class_id;

            detections.push_back(det);
            mask_coef_vectors.push_back(mask_coef);
        }
    }
    // Apply Non-Maximum Suppression (NMS) to avoid multiple detections of the same object
    // Normally, you would use the NMS function from OpenCV_DNN, but here we will implement it manually because DNN is not in the daemon contribs
    std::vector<int> indices;
    std::vector<cv::Rect> boxes;
    std::vector<float> confidences;

    for (const auto& det : detections) {
        boxes.push_back(det.box);
        confidences.push_back(det.confidence);
    }

    indices = applyManualNMS(boxes, confidences, nms_threshold);
    // Generate the final detections
    std::vector<Detection> final_detections;
    for (size_t i = 0; i < indices.size(); ++i) {
        int idx = indices[i];
        Detection det = detections[idx];
        cv::Mat mask_coef = mask_coef_vectors[idx];

        // Generate the mask
        cv::Mat mask = mask_coef * mask_protos; // (1, 32) x (32, 160*160) -> (1, 160*160)

        cv::Mat mask_reshaped = mask.reshape(1, mask_h); // Reshape to (160, 160)
        cv::Mat mask_sigmoid;
        cv::exp(-mask_reshaped, mask_sigmoid);
        mask_sigmoid = 1.0 / (1.0 + mask_sigmoid);

        // Resize the mask to the original image size
        cv::Mat mask_resized;
        if (mask_sigmoid.empty()) {
            continue;
        }
        cv::resize(mask_sigmoid, mask_resized, cv::Size(input_width, input_height), 0, 0, cv::INTER_LINEAR);

        // Crop the mask to the bounding box
        int x0 = std::max((det.box.x * scale + left), 0.0f);
        int y0 = std::max((det.box.y * scale + top), 0.0f);
        int x1 = std::min((det.box.x + det.box.width) * scale + left, (float)input_width);
        int y1 = std::min((det.box.y + det.box.height) * scale + top, (float)input_height);

        cv::Rect mask_roi = cv::Rect(cv::Point(int(x0), int(y0)), cv::Point(int(x1), int(y1)));

        cv::Mat mask_cropped = mask_resized(mask_roi);

        // Resize the mask to the original image size
        cv::Mat mask_original_size;
        if (mask_cropped.empty()) {
            continue;
        }
        cv::resize(mask_cropped, mask_original_size, cv::Size(det.box.width, det.box.height), 0, 0, cv::INTER_LINEAR);

        // Binarize the mask
        cv::Mat mask_bin;
        cv::threshold(mask_original_size, mask_bin, 0.6, 1, cv::THRESH_BINARY);

        // Store the mask
        det.mask = mask_bin;

        final_detections.push_back(det);
    }
    return final_detections;
}

void
SegmentationVideoSubscriber::DrawFinalDet(const std::vector<TrackedObject>& tracked_objects) {
    // Classes names from COCO dataset (80 classes)
    std::vector<std::string> class_names = {
        "person", "bicycle", "car", "motorbike", "aeroplane", "bus", "train",
        "truck", "boat", "traffic light", "fire hydrant", "stop sign",
        "parking meter", "bench", "bird", "cat", "dog", "horse", "sheep",
        "cow", "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella",
        "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard",
        "sports ball", "kite", "baseball bat", "baseball glove", "skateboard",
        "surfboard", "tennis racket", "bottle", "wine glass", "cup", "fork",
        "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange",
        "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair",
        "sofa", "pottedplant", "bed", "diningtable", "toilet", "tvmonitor",
        "laptop", "mouse", "remote", "keyboard", "cell phone", "microwave",
        "oven", "toaster", "sink", "refrigerator", "book", "clock", "vase",
        "scissors", "teddy bear", "hair drier", "toothbrush"
    };

    for (const auto& obj : tracked_objects) {
        // if (det.class_id != 0) continue; // To detect only persons
        // Draw the bounding box
        const auto& det = obj.detection;

        if (det.box.x < 0 || det.box.y < 0 || det.box.x + det.box.width > processingFrame.cols || det.box.y + det.box.height > processingFrame.rows) {
            continue; // Ignore the box if it is out of the frame
        }

        if (baseVisibility == "all" || baseVisibility == "box") {
            // Draw the bounding box
            cv::rectangle(processingFrame, det.box, cv::Scalar(0, 255, 0), 1);

            // Afficher le nom de la classe, la confiance et l'ID de suivi
            std::string label = class_names[det.class_id] + ": " + cv::format("%.2f", det.confidence);
            int baseLine = 0;
            cv::Size labelSize = cv::getTextSize(label, cv::FONT_HERSHEY_SIMPLEX, 1, 2, &baseLine);
            int top_label = std::max(det.box.y, labelSize.height);
            cv::rectangle(processingFrame, cv::Point(det.box.x, top_label - labelSize.height),
                        cv::Point(det.box.x + labelSize.width, top_label + baseLine),
                        cv::Scalar(255, 255, 255), cv::FILLED);
            cv::putText(processingFrame, label, cv::Point(det.box.x, top_label),
                        cv::FONT_HERSHEY_SIMPLEX, 1, cv::Scalar(0, 0, 0), 2);
            if (det.mask.empty()) {
                Plog::log(Plog::LogPriority::INFO, TAG, "Mask is empty");
                continue;
            }
        }

        if (baseVisibility == "all" || baseVisibility == "mask") {
            // Draw the segmentation mask
            srand (det.class_id); // Set the seed of random to the class_id to have the same color for the same class
            cv::Mat color = cv::Mat::zeros(det.mask.size(), CV_8UC3);
            cv::Scalar random_color = cv::Scalar(rand() % 256, rand() % 256, rand() % 256);
            color.setTo(random_color);

            // roi = Region of Interest
            cv::Mat roi = processingFrame(det.box);

            cv::Mat mask_uint8;
            det.mask.convertTo(mask_uint8, CV_8U, 255);
            cv::Mat mask_resized;
            if (mask_uint8.empty()) {
                Plog::log(Plog::LogPriority::INFO, TAG, "mask_uint8 is empty");
                continue;
            }
            cv::resize(mask_uint8, mask_resized, roi.size(), 0, 0, cv::INTER_NEAREST);
            cv::Mat blended;
            if (mask_resized.empty()) {
                Plog::log(Plog::LogPriority::INFO, TAG, "mask_resized is empty");
                continue;
            }
            if (roi.size() != color.size()) {
                Plog::log(Plog::LogPriority::INFO, TAG, "roi.size() != color.size()");
                continue;
            }
            cv::addWeighted(roi, 1.0, color, 0.5, 0, blended);
            if (mask_resized.size() == roi.size()) {
            blended.copyTo(roi, mask_resized);
            }
        }
    }
    // add a rectangle with std::string inferenceTime
    // cv::rectangle(processingFrame, cv::Point(0, 0), cv::Point(processingFrame.cols, 30), cv::Scalar(0, 0, 0), cv::FILLED);
    // cv::putText(processingFrame, inferenceTime, cv::Point(10, 20), cv::FONT_HERSHEY_SIMPLEX, 0.5, cv::Scalar(255, 255, 255), 1);
}

cv::Mat
SegmentationVideoSubscriber::resizeWithPadding(const cv::Mat& img, const cv::Size& new_size, float& scale, int& top, int& left) {
    // Resize the image to the imput size with padding to keep the aspect ratio
    int original_width = img.cols;
    int original_height = img.rows;
    int resized_width = new_size.width;
    int resized_height = new_size.height;

    scale = std::min(resized_width / (float)original_width, resized_height / (float)original_height);
    int new_unpad_w = scale * original_width;
    int new_unpad_h = scale * original_height;

    cv::Mat resized;
    cv::resize(img, resized, cv::Size(new_unpad_w, new_unpad_h));

    int dw = resized_width - new_unpad_w;
    int dh = resized_height - new_unpad_h;

    left = dw / 2;
    top = dh / 2;

    cv::Mat padded;
    cv::copyMakeBorder(resized, padded, top, dh - top, left, dw - left, cv::BORDER_CONSTANT, cv::Scalar(114, 114, 114));
    return padded;
}

float
SegmentationVideoSubscriber::calculateIoU(const cv::Rect& boxA, const cv::Rect& boxB) {
    // Calculate the Intersection over Union (IoU) of two bounding boxes
    int xA = std::max(boxA.x, boxB.x);
    int yA = std::max(boxA.y, boxB.y);
    int xB = std::min(boxA.x + boxA.width, boxB.x + boxB.width);
    int yB = std::min(boxA.y + boxA.height, boxB.y + boxB.height);

    int interArea = std::max(0, xB - xA + 1) * std::max(0, yB - yA + 1);
    int boxAArea = boxA.width * boxA.height;
    int boxBArea = boxB.width * boxB.height;

    float iou = static_cast<float>(interArea) / static_cast<float>(boxAArea + boxBArea - interArea);
    return iou;
}

std::vector<int>
SegmentationVideoSubscriber::applyManualNMS(const std::vector<cv::Rect>& boxes, const std::vector<float>& confidences, float nms_threshold) {
    // Apply Non-Maximum Suppression (NMS) to avoid multiple detections of the same object
    std::vector<int> indices;
    std::vector<std::pair<float, int>> sorted_boxes;

    for (size_t i = 0; i < confidences.size(); ++i) {
        sorted_boxes.push_back(std::make_pair(confidences[i], i));
    }

    std::sort(sorted_boxes.begin(), sorted_boxes.end(), [](const std::pair<float, int>& a, const std::pair<float, int>& b) {
        return a.first > b.first;
    });

    std::vector<bool> is_suppressed(confidences.size(), false);
    for (size_t i = 0; i < sorted_boxes.size(); ++i) {
        int idxA = sorted_boxes[i].second;
        if (is_suppressed[idxA]) continue;

        indices.push_back(idxA);
        for (size_t j = i + 1; j < sorted_boxes.size(); ++j) {
            int idxB = sorted_boxes[j].second;
            if (calculateIoU(boxes[idxA], boxes[idxB]) > nms_threshold) {
                is_suppressed[idxB] = true;
            }
        }
    }
    return indices;
}

void
SegmentationVideoSubscriber::rotateFrame(const int angle, cv::Mat& frame)
{
    // Rotate the frame by the given angle
    // On Android, when the phone rotate, the video output is the same, with a rotation angle in the metadata to avoid huge calculations on the phone.
    // We need to rotate the frame to use it correctly
    if (angle == -90)
        cv::rotate(frame, frame, cv::ROTATE_90_COUNTERCLOCKWISE);
    else if (std::abs(angle) == 180)
        cv::rotate(frame, frame, cv::ROTATE_180);
    else if (angle == 90)
        cv::rotate(frame, frame, cv::ROTATE_90_CLOCKWISE);
}

void
SegmentationVideoSubscriber::setVisibility(const std::string& visibility)
{
    char visible[5] = "all";
    std::sscanf(visibility.c_str(), "%4s", visible);
    baseVisibility = visible;
}

void
SegmentationVideoSubscriber::copyByLine(const int lineSize)
{
    if (resultFrame.size() != processingFrame.size() || resultFrame.type() != processingFrame.type()) {
        resultFrame = cv::Mat(processingFrame.size(), processingFrame.type());
    }
    processingFrame.copyTo(resultFrame);
}

void
SegmentationVideoSubscriber::attached(jami::Observable<AVFrame*>* observable)
{
    std::ostringstream oss;
    oss << "::Attached ! " << std::endl;
    Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
    observable_ = observable;
}

void
SegmentationVideoSubscriber::detached(jami::Observable<AVFrame*>*)
{
    observable_ = nullptr;
    std::ostringstream oss;
    oss << "::Detached()" << std::endl;
    Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
}

void
SegmentationVideoSubscriber::detach()
{
    if (observable_) {
        std::ostringstream oss;
        oss << "::Calling detach()" << std::endl;
        Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
        observable_->detach(this);
    }
}
} // namespace jami
