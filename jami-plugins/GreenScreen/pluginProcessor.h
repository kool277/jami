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

#pragma once

#include <map>
#include <optional>
#include <vector>
extern "C" {
#include <libavutil/frame.h>
}

#include <plugin/jamiplugin.h>
#include <plugin/mediahandler.h>

#include <opencv2/core.hpp>
#include <onnxruntime_cxx_api.h>
#ifdef __ANDROID__
#include <nnapi_provider_factory.h>
#endif

#include <frameFilter.h>
#include <frameUtils.h>
#include <mediaStream.h>
#include <functional>

namespace jami {

static const char* modelInputNames[8] = {"image:0"};
static const char* modelOutputNames[11] = {"Identity:0"};

class PluginProcessor
{
public:
    PluginProcessor(const std::string& model, bool acc);
    ~PluginProcessor();

    void initModel(const std::string& modelPath, bool activateAcc);
    /**
     * @brief feedInput
     * Takes a frame and feeds it to the model storage for predictions
     * @param frame
     */
    void feedInput(AVFrame* input);

    /**
     * @brief computePredictions
     * Uses the model to compute the predictions and store them in
     * computedPredictions
     */
    void computePredictions();

    void printMask();
    void drawMaskOnFrame(AVFrame* frame, AVFrame* frameReduced, int angle);
    bool isAllocated() { return isAllocated_; }
    void setBlur(bool isBlur) { isBlur_ = isBlur; }
    void setBlurLevel(const std::string& blurLevel) { blurLevel_ = blurLevel; }
    void setBackgroundImage(const std::string& backgroundPath) { backgroundPath_ = backgroundPath; }
    void initFilters(const std::pair<int, int>& inputSize, int format, int angle);

    std::pair<int, int> modelInputDimensions {257, 257};
    std::map<int, std::string> rotation = {{90, "-PI/2"},
                                           {-90, "PI/2"},
                                           {-180, "-PI"},
                                           {180, "PI"},
                                           {0, "0"}};

private:
    void resetInitValues();
    void loadBackground();
    MediaStream getbgAVFrameInfos();

    bool isBlur_ {false};
    std::string blurLevel_;
    std::string backgroundPath_;
    cv::Mat previousMasks_[2];
    std::vector<float> computedMask_;
    cv::Mat cvFrame_;

    // process variables
    cv::Size kSize_;
    int count_ {0};
    cv::Mat bgdModel_, fgdModel_;
    int grabCutMode_ {1}; // cv::GC_INIT_WITH_MASK = 1;
    int grabCutIterations_ {4};
    int grabcutClass_ {3};
    int frameCount_ {5};
    float smoothFactors_[3] = {0.6f, 0.3f, 0.1f};
    float kernelSize_ {0.05f};

    // filters
    std::string mainFilterDescription_;
    FrameFilter mainFilter_;
    std::unique_ptr<AVFormatContext, std::function<void(AVFormatContext*)>> pFormatCtx_
        = {avformat_alloc_context(), [](AVFormatContext* ptr) {
               avformat_close_input(&ptr);
               avformat_free_context(ptr);
           }};
    int videoStream_ {-1};
    MediaStream ims_, ims2_, maskms_;

    // onnx related
    bool isAllocated_ {false};
    std::optional<Ort::Env> env_;
    Ort::Session* session_ {};
    Ort::SessionOptions sessOpt_;

    Ort::Value input_tensor_ {nullptr};
    std::array<int64_t, 3> input_shape_ {257, 257, 3};
    std::array<float, 257 * 257 * 3> input_image_ {};

    Ort::Value output_tensor_ {nullptr};
    std::array<int64_t, 4> output_shape_ {1, 17, 17, 1};
    std::array<float, 17 * 17> results_ {};
};
} // namespace jami
