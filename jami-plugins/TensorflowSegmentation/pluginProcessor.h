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
// STL
#include <condition_variable>
#include <cstdint>
#include <map>
#include <memory>
#include <mutex>
#include <thread>
#include <vector>
// Filters
#include "pluginInference.h"
// AvFrame
extern "C" {
#include <libavutil/frame.h>
}
// Plugin
#include <plugin/jamiplugin.h>
#include <plugin/mediahandler.h>

namespace jami {

class PluginProcessor
{
public:
    PluginProcessor(const std::string& dataPath);

    void initModel();
    /**
     * @brief feedInput
     * Takes a frame and feeds it to the model storage for predictions
     * @param frame
     */
    void feedInput(const cv::Mat& frame);

    /**
     * @brief computePredictions
     * Uses the model to compute the predictions and store them in
     * computedPredictions
     */
    void computePredictions();

    void printMask();
    void drawMaskOnFrame(cv::Mat& frame,
                         cv::Mat& frameReduced,
                         std::vector<float> computedMask,
                         int lineSize,
                         int angle);
    int getBackgroundRotation();
    void setBackgroundRotation(int angle);
    void setBackgroundImage(const std::string& backgroundPath);
    void rotateFrame(int angle, cv::Mat& mat);
    bool hasBackground() const;
    void resetInitValues(const cv::Size& modelInputSize);

    // Output predictions
    std::vector<float> computedMask;

    cv::Mat previousMasks[2];
    cv::Mat backgroundImage;

    cv::Size kSize;

    PluginInference pluginInference;
    std::string backgroundPath;
    int count = 0;

private:
    // Frame
    cv::Mat frame;
    int backgroundRotation = 0;
    bool hasBackground_ = false;
    cv::Mat bgdModel, fgdModel;
    int grabCutMode = 1; // cv::GC_INIT_WITH_MASK = 1;
    int grabCutIterations = 5;
#ifdef TFLITE
    int grabcutClass = 2;
    int frameCount = 3;
    float smoothFactors[2] = {0.3f, 0.05f};
    float kernelSize = 0.1f;
#else
    int grabcutClass = 3;
    int frameCount = 5;
    float smoothFactors[3] = {0.6f, 0.3f, 0.1f};
    float kernelSize = 0.05f;
#endif
};
} // namespace jami
