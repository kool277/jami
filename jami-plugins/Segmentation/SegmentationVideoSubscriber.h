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

#pragma once

extern "C" {
#include <libavutil/frame.h>
}
#include <observer.h>
#include <opencv2/core.hpp>
#include <queue>
#include <thread>
#include <mutex>
#include <condition_variable>
#include <onnxruntime_cxx_api.h>

namespace jami {

class SegmentationVideoSubscriber : public Observer<AVFrame*>
{
public:
    SegmentationVideoSubscriber(const std::string& dataPath);
    ~SegmentationVideoSubscriber();

    virtual void update(Observable<AVFrame*>*, AVFrame* const&) override;
    virtual void attached(Observable<AVFrame*>*) override;
    virtual void detached(Observable<AVFrame*>*) override;

    void detach();

    void setVisibility(const std::string& visibility);

private:
    struct Detection {
        cv::Rect box;
        float confidence;
        int class_id;
        cv::Mat mask;
    };
    struct TrackedObject {
    int id;
    Detection detection;
    int frames_since_seen;
    };

    int next_id = 0;
    std::vector<TrackedObject> tracked_objects;
    int max_frames_to_persist = 3;

    // thread
    void inferenceThreadFunc();

    std::queue<cv::Mat> frameQueue;
    std::thread inferenceThread;
    std::mutex queueMutex;
    std::condition_variable queueCondVar;
    bool stopThread = false;

    static constexpr int maxQueueSize = 1;

    // Observer pattern
    Observable<AVFrame*>* observable_{};

    // Data
    std::string path_;

    // define custom variables
    void copyByLine(const int lineSize);
    void drawSegmentation(const int angle);
    void rotateFrame(const int angle, cv::Mat& frame);
    void initModel();
    cv::Mat resizeWithPadding(const cv::Mat& img, const cv::Size& new_size, float& scale, int& top, int& left);
    float calculateIoU(const cv::Rect& boxA, const cv::Rect& boxB);
    std::vector<int> applyManualNMS(const std::vector<cv::Rect>& boxes, const std::vector<float>& confidences, float nms_threshold);

    void DrawFinalDet(const std::vector<TrackedObject>& tracked_objects);
    void updateTrackedObjects(const std::vector<Detection>& detections);
    std::vector<Detection> Detect(cv::Mat frameToProcess);
    cv::Mat processingFrame;
    cv::Mat resultFrame;
    int frameCounter = 0;
    std::string baseVisibility ="all";

    Ort::Env env;
    std::unique_ptr<Ort::Session> session;
    std::vector<Detection> detections;

    std::string inferenceTime;
};
} // namespace jami
