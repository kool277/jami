/**
 *  Copyright (C) 2004-2021 Savoir-faire Linux Inc.
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
 *  Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301 USA.
 */

#pragma once

// AvFrame
extern "C" {
#include <libavutil/frame.h>
}
#include <observer.h>

// STl
#include <map>
#include <thread>
#include <condition_variable>

#include <opencv2/core.hpp>

#include "pluginProcessor.h"
#include <frameScaler.h>

namespace jami {

class FrameCopy
{
public:
    // This frame is a resized version of the original in RGB format
    cv::Mat resizedFrameRGB;
    cv::Size resizedSize;
    // This frame is used to draw predictions into in RGB format
    cv::Mat predictionsFrameRGB;
    cv::Size originalSize;
    // This frame is used to draw predictions into in RGB format on a resized frame
    cv::Mat predictionsResizedFrameRGB;
};

class VideoSubscriber : public Observer<AVFrame*>
{
public:
    VideoSubscriber(const std::string& dataPath);
    ~VideoSubscriber();

    virtual void update(Observable<AVFrame*>*, AVFrame* const&) override;
    virtual void attached(Observable<AVFrame*>*) override;
    virtual void detached(Observable<AVFrame*>*) override;

    void detach();
    void stop();
    void setBackground(const std::string& backgroundPath);

private:
    // Observer pattern
    Observable<AVFrame*>* observable_{};

    // Data
    std::string path_;

    // Frame
    FrameCopy fcopy;
    cv::Mat frame;

    FrameScaler scaler;

    // Threading
    std::thread processFrameThread;
    std::mutex inputLock;
    std::condition_variable inputCv;

    // Status variables of the processing
    bool firstRun {true};
    bool running {true};
    bool newFrame {false};

    // std::shared_ptr<PluginProcessor> pluginProcessor;
    PluginProcessor pluginProcessor;
};
} // namespace jami
