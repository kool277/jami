/**
 *  Copyright (C) 2020-2021 Savoir-faire Linux Inc.
 *
 *  Author: Aline Gondim Santos <aline.gondimsantos@savoirfairelinux.com>
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
 *  Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301
 * USA.
 */

#include "pluginProcessor.h"
// System includes
#include <algorithm>
#include <cstring>
// OpenCV headers
#include <opencv2/core.hpp>
#include <opencv2/imgcodecs.hpp>
#include <opencv2/imgproc.hpp>
// Logger
#include <pluglog.h>

extern "C" {
#include <libavutil/display.h>
}

const char sep = separator();

const std::string TAG = "FORESEG";

PluginParameters* mPluginParameters = getGlobalPluginParameters();

namespace jami {

PluginProcessor::PluginProcessor(const std::string& dataPath)
    : pluginInference {TFModel {dataPath + sep + "models" + sep + mPluginParameters->model}}
{
    initModel();
    setBackgroundImage(mPluginParameters->image);
}

void
PluginProcessor::setBackgroundImage(const std::string& backgroundPath)
{
    cv::Size size = cv::Size {0, 0};

    if (!backgroundImage.empty())
        size = backgroundImage.size();

    cv::Mat newBackgroundImage = cv::imread(backgroundPath);
    if (newBackgroundImage.cols == 0) {
        Plog::log(Plog::LogPriority::ERR, TAG, "Background image not Loaded");
    } else {
        Plog::log(Plog::LogPriority::INFO, TAG, "Background image Loaded");
        cv::cvtColor(newBackgroundImage, newBackgroundImage, cv::COLOR_BGR2RGB);
        newBackgroundImage.convertTo(newBackgroundImage, CV_32FC3);
        if (size.height) {
            cv::resize(newBackgroundImage, newBackgroundImage, size);
            backgroundRotation = 0;
        }
        backgroundImage = newBackgroundImage.clone();
        newBackgroundImage.release();
        hasBackground_ = true;
    }
}

void
PluginProcessor::initModel()
{
    try {
        pluginInference.init();
    } catch (std::exception& e) {
        Plog::log(Plog::LogPriority::ERR, TAG, e.what());
    }
    std::ostringstream oss;
    oss << "Model is allocated " << pluginInference.isAllocated();
    Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
}

#ifdef TFLITE
void
PluginProcessor::feedInput(const cv::Mat& frame)
{
    auto pair = pluginInference.getInput();
    uint8_t* inputPointer = pair.first;

    cv::Mat temp(frame.rows, frame.cols, CV_8UC3, inputPointer);
    frame.convertTo(temp, CV_8UC3);

    inputPointer = nullptr;
}
#else
void
PluginProcessor::feedInput(const cv::Mat& frame)
{
    pluginInference.ReadTensorFromMat(frame);
}
#endif // TFLITE

int
PluginProcessor::getBackgroundRotation()
{
    return backgroundRotation;
}

void
PluginProcessor::setBackgroundRotation(int angle)
{
    if (backgroundRotation != angle && (backgroundRotation - angle) != 0) {
        rotateFrame(backgroundRotation - angle, backgroundImage);
        backgroundRotation = angle;
    }
}

void
PluginProcessor::computePredictions()
{
    if (count == 0) {
        // Run the graph
        pluginInference.runGraph();
        auto predictions = pluginInference.masksPredictions();

        // Save the predictions
        computedMask = predictions;
    }
}

void
PluginProcessor::printMask()
{
    for (size_t i = 0; i < computedMask.size(); i++) {
        // Log the predictions
        std::ostringstream oss;
        oss << "\nclass: " << computedMask[i] << std::endl;
        Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
    }
}

void
PluginProcessor::resetInitValues(const cv::Size& modelInputSize)
{
    previousMasks[0] = cv::Mat(modelInputSize.height, modelInputSize.width, CV_32FC1, double(0.));
    previousMasks[1] = cv::Mat(modelInputSize.height, modelInputSize.width, CV_32FC1, double(0.));
    kSize = cv::Size(modelInputSize.width * kernelSize, modelInputSize.height * kernelSize);
    if (kSize.height % 2 == 0) {
        kSize.height -= 1;
    }
    if (kSize.width % 2 == 0) {
        kSize.width -= 1;
    }
    count = 0;
    grabCutMode = cv::GC_INIT_WITH_MASK;
    grabCutIterations = 5;
}

void
copyByLine(uchar* frameData, uchar* applyMaskData, const int lineSize, cv::Size size)
{
    if (3 * size.width == lineSize) {
        std::memcpy(frameData, applyMaskData, size.height * size.width * 3);
    } else {
        int rows = size.height;
        int offset = 0;
        int maskoffset = 0;
        for (int i = 0; i < rows; i++) {
            std::memcpy(frameData + offset, applyMaskData + maskoffset, lineSize);
            offset += lineSize;
            maskoffset += 3 * size.width;
        }
    }
}

void
PluginProcessor::drawMaskOnFrame(
    cv::Mat& frame, cv::Mat& frameReduced, std::vector<float> computedMask, int lineSize, int angle)
{
    if (computedMask.empty()) {
        return;
    }

    int maskSize = static_cast<int>(std::sqrt(computedMask.size()));
    cv::Mat maskImg(maskSize, maskSize, CV_32FC1, computedMask.data());
    cv::Mat* applyMask = &frameReduced;
    cv::Mat output;

    if (count == 0) {
        rotateFrame(-angle, maskImg);
#ifdef TFLITE
        for (int i = 0; i < maskImg.cols; i++) {
            for (int j = 0; j < maskImg.rows; j++) {
                if (maskImg.at<float>(j, i) == 15)
                    maskImg.at<float>(j, i) = 1.;
                else
                    maskImg.at<float>(j, i) = smoothFactors[0] * previousMasks[0].at<float>(j, i)
                                              + smoothFactors[1] * previousMasks[1].at<float>(j, i);
            }
        }
        cv::morphologyEx(maskImg,
                         maskImg,
                         cv::MORPH_CLOSE,
                         cv::getStructuringElement(cv::MORPH_ELLIPSE, kSize),
                         cv::Point(-1, -1),
                         4);
#else
        cv::resize(maskImg, maskImg, cv::Size(frameReduced.cols, frameReduced.rows));

        double m, M;
        cv::minMaxLoc(maskImg, &m, &M);

        if (M < 2) { // avoid detection if there is any one in frame
            maskImg = 0. * maskImg;
        } else {
            for (int i = 0; i < maskImg.cols; i++) {
                for (int j = 0; j < maskImg.rows; j++) {
                    maskImg.at<float>(j, i) = (maskImg.at<float>(j, i) - m) / (M - m);

                    if (maskImg.at<float>(j, i) < 0.4)
                        maskImg.at<float>(j, i) = 0.;
                    else if (maskImg.at<float>(j, i) < 0.7) {
                        float value = maskImg.at<float>(j, i) * smoothFactors[0]
                                      + previousMasks[0].at<float>(j, i) * smoothFactors[1]
                                      + previousMasks[1].at<float>(j, i) * smoothFactors[2];
                        maskImg.at<float>(j, i) = 0.;
                        if (value > 0.7)
                            maskImg.at<float>(j, i) = 1.;
                    } else
                        maskImg.at<float>(j, i) = 1.;
                }
            }
        }
#endif
        if (cv::countNonZero(maskImg) != 0) {
#ifdef TFLITE
            cv::Mat tfMask;
            tfMask = maskImg.clone();
            tfMask *= 255.;
            tfMask.convertTo(tfMask, CV_8UC1);
            cv::threshold(tfMask, tfMask, 127, 255, cv::THRESH_BINARY);
            if (cv::countNonZero(tfMask) != 0) {
#endif
                cv::Mat dilate;
                cv::dilate(maskImg,
                           dilate,
                           cv::getStructuringElement(cv::MORPH_ELLIPSE, kSize),
                           cv::Point(-1, -1),
                           2);
                cv::erode(maskImg,
                          maskImg,
                          cv::getStructuringElement(cv::MORPH_ELLIPSE, kSize),
                          cv::Point(-1, -1),
                          2);
                for (int i = 0; i < maskImg.cols; i++) {
                    for (int j = 0; j < maskImg.rows; j++) {
                        if (dilate.at<float>(j, i) != maskImg.at<float>(j, i))
                            maskImg.at<float>(j, i) = grabcutClass;
                    }
                }
                maskImg.convertTo(maskImg, CV_8UC1);
                applyMask->convertTo(*applyMask, CV_8UC1);
                cv::Rect rect(1, 1, maskImg.rows, maskImg.cols);
                cv::grabCut(*applyMask,
                            maskImg,
                            rect,
                            bgdModel,
                            fgdModel,
                            grabCutIterations,
                            grabCutMode);

                grabCutMode = cv::GC_EVAL;
                grabCutIterations = 1;

                maskImg = maskImg & 1;
#ifdef TFLITE
                cv::bitwise_and(maskImg, tfMask, maskImg);
            }
#endif
            maskImg.convertTo(maskImg, CV_32FC1);
            maskImg *= 255.;
            GaussianBlur(maskImg, maskImg, cv::Size(7, 7), 0); // float mask from 0 to 255.
            maskImg = maskImg / 255.;
        }
        previousMasks[1] = previousMasks[0].clone();
        previousMasks[0] = maskImg.clone();
    }

    cv::Mat roiMaskImg = previousMasks[0].clone();
    cv::Mat roiMaskImgComplementary = 1. - roiMaskImg; // mask from 1. to 0

    std::vector<cv::Mat> channels;
    std::vector<cv::Mat> channelsComplementary;

    channels.emplace_back(roiMaskImg);
    channels.emplace_back(roiMaskImg);
    channels.emplace_back(roiMaskImg);
    channelsComplementary.emplace_back(roiMaskImgComplementary);
    channelsComplementary.emplace_back(roiMaskImgComplementary);
    channelsComplementary.emplace_back(roiMaskImgComplementary);

    cv::merge(channels, roiMaskImg);
    cv::merge(channelsComplementary, roiMaskImgComplementary);

    int origType = frameReduced.type();
    int roiMaskType = roiMaskImg.type();

    frameReduced.convertTo(output, roiMaskType);
    output = output.mul(roiMaskImg);
    output += backgroundImage.mul(roiMaskImgComplementary);
    output.convertTo(output, origType);

    cv::resize(output, output, cv::Size(frame.cols, frame.rows));

    copyByLine(frame.data, output.data, lineSize, cv::Size(frame.cols, frame.rows));
    count++;
    count = count % frameCount;
}

void
PluginProcessor::rotateFrame(int angle, cv::Mat& mat)
{
    if (angle == -90)
        cv::rotate(mat, mat, cv::ROTATE_90_COUNTERCLOCKWISE);
    else if (std::abs(angle) == 180)
        cv::rotate(mat, mat, cv::ROTATE_180);
    else if (angle == 90)
        cv::rotate(mat, mat, cv::ROTATE_90_CLOCKWISE);
}

bool
PluginProcessor::hasBackground() const
{
    return hasBackground_;
}
} // namespace jami
