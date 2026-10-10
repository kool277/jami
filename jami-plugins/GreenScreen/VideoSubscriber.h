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

#include "pluginProcessor.h"

extern "C" {
#include <libavutil/frame.h>
}
#include <observer.h>

#include <thread>
#include <condition_variable>
#include <frameFilter.h>

namespace jami {

class VideoSubscriber : public Observer<AVFrame*>
{
public:
    VideoSubscriber(const std::string& model, bool acc = false);
    ~VideoSubscriber();

    virtual void update(Observable<AVFrame*>*, AVFrame* const&) override;
    virtual void attached(Observable<AVFrame*>*) override;
    virtual void detached(Observable<AVFrame*>*) override;

    void detach();
    void stop();
    void setBackground(const std::string& backgroundPath);
    void setBlur(bool isBlur);
    void setBlurLevel(const std::string& blurLevel);
    void initFilters();

private:
    // Observer pattern
    Observable<AVFrame*>* observable_ {};
    int angle_ {0};
    uniqueFramePtr inputFrame_ = {av_frame_alloc(), frameFree};
    FrameFilter inputFilter_;
    std::string inputFilterDescription_;

    // Threading
    std::thread processFrameThread;
    std::mutex inputLock;
    std::condition_variable inputCv;

    // Status variables of the processing
    bool firstRun {true};
    bool running {true};
    bool newFrame {false};

    PluginProcessor pluginProcessor;
};
} // namespace jami
