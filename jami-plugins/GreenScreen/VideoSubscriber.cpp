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

#include "VideoSubscriber.h"

extern "C" {
#include <libavutil/display.h>
}
#include <frameScaler.h>
#include <accel.h>
#include <mediaStream.h>
#include <pluglog.h>

const std::string TAG = "FORESEG";
const char sep = separator();

namespace jami {

VideoSubscriber::VideoSubscriber(const std::string& model, bool acc)
    : pluginProcessor {model, acc}
{
    /**
     * Waits for new frames and then process them
     * Writes the predictions in computedPredictions
     **/
    processFrameThread = std::thread([this] {
        while (running) {
            std::unique_lock<std::mutex> l(inputLock);
            inputCv.wait(l, [this] { return not running or newFrame; });
            if (not running) {
                break;
            }

            pluginProcessor.feedInput(inputFrame_.get());
            newFrame = false;
            /** Unclock the mutex, this way we let the other thread
             *  copy new data while we are processing the old one
             **/
            l.unlock();
            pluginProcessor.computePredictions();
        }
    });
}

VideoSubscriber::~VideoSubscriber()
{
    stop();
    processFrameThread.join();
    detach();
    inputFilter_.clean();
    Plog::log(Plog::LogPriority::INFO, TAG, "~MediaProcessor");
}

void
VideoSubscriber::update(jami::Observable<AVFrame*>*, AVFrame* const& pluginFrame)
{
    if (!observable_ || !pluginProcessor.isAllocated() || !pluginFrame)
        return;

    //======================================================================================
    // GET FRAME ROTATION
    AVFrameSideData* side_data = av_frame_get_side_data(pluginFrame, AV_FRAME_DATA_DISPLAYMATRIX);
    int newAngle {0};
    if (side_data) {
        auto matrix_rotation = reinterpret_cast<int32_t*>(side_data->data);
        newAngle = static_cast<int>(av_display_rotation_get(matrix_rotation));
    }
    if (newAngle != angle_) {
        angle_ = newAngle;
        firstRun = true;
    }

    //======================================================================================
    // GET RAW FRAME
    uniqueFramePtr rgbFrame = {transferToMainMemory(pluginFrame, AV_PIX_FMT_NV12), frameFree};
    rgbFrame.reset(FrameScaler::convertFormat(rgbFrame.get(), AV_PIX_FMT_YUV420P));
    if (!rgbFrame.get())
        return;
    rgbFrame->pts = 1;

    //======================================================================================
    // PROCESS
    if (firstRun) {
        initFilters();
        pluginProcessor.initFilters({rgbFrame->width, rgbFrame->height}, rgbFrame->format, angle_);
        rational<int> fr(rgbFrame->pts, 1);
        MediaStream pluginstream_ = MediaStream("input",
                                                rgbFrame->format,
                                                1 / fr,
                                                rgbFrame->width,
                                                rgbFrame->height,
                                                0,
                                                fr);
        inputFilter_.initialize(inputFilterDescription_, {pluginstream_});

        firstRun = false;
    }
    if (!inputFilter_.initialized_)
        return;

    AVFrame* filteredFrame;
    if (inputFilter_.feedInput(rgbFrame.get(), "input") == 0) {
        if ((filteredFrame = inputFilter_.readOutput()) == 0)
            return;
        else
            filteredFrame->pts = 1;
    } else
        return;

    if (!newFrame) {
        std::lock_guard<std::mutex> l(inputLock);
        inputFrame_.reset(av_frame_clone(filteredFrame));
        newFrame = true;
        inputCv.notify_all();
    }

    pluginProcessor.drawMaskOnFrame(rgbFrame.get(), filteredFrame, angle_);
    frameFree(filteredFrame);

    rgbFrame.reset(FrameScaler::convertFormat(rgbFrame.get(), AV_PIX_FMT_YUV420P));
    moveFrom(pluginFrame, rgbFrame.get());
}

void
VideoSubscriber::attached(jami::Observable<AVFrame*>* observable)
{
    observable_ = observable;
    Plog::log(Plog::LogPriority::INFO, TAG, "Attached!");
}

void
VideoSubscriber::detached(jami::Observable<AVFrame*>*)
{
    inputFilter_.clean();
    inputFrame_.reset();
    firstRun = true;
    observable_ = nullptr;
    Plog::log(Plog::LogPriority::INFO, TAG, "Detached!");
}

void
VideoSubscriber::detach()
{
    if (observable_) {
        firstRun = true;
        observable_->detachPriorityObserver(this);
    }
}

void
VideoSubscriber::stop()
{
    running = false;
    inputCv.notify_all();
}

void
VideoSubscriber::setBackground(const std::string& backgroundPath)
{
    pluginProcessor.setBackgroundImage(backgroundPath);
    firstRun = true;
}

void
VideoSubscriber::setBlur(bool isBlur)
{
    pluginProcessor.setBlur(isBlur);
    firstRun = true;
}

void
VideoSubscriber::setBlurLevel(const std::string& blurLevel)
{
    pluginProcessor.setBlurLevel(blurLevel);
    firstRun = true;
}

void
VideoSubscriber::initFilters()
{
    inputFilter_.clean();
    std::string rotateSides = "";
    if (std::abs(angle_) == 90)
        rotateSides = ":out_w=ih:out_h=iw";
    inputFilterDescription_ = "[input]scale="
                              + std::to_string(pluginProcessor.modelInputDimensions.first) + ":"
                              + std::to_string(pluginProcessor.modelInputDimensions.second)
                              + ",rotate=" + pluginProcessor.rotation[-angle_] + rotateSides
                              + ",format=rgb24";
    Plog::log(Plog::LogPriority::INFO, TAG, inputFilterDescription_);
}
} // namespace jami
