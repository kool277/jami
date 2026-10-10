/**
 *  Copyright (C) 2022 Savoir-faire Linux Inc.
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

extern "C" {
#include <libavutil/frame.h>
}
#include <observer.h>

#include <frameFilter.h>
#include <frameUtils.h>
#include "TranscriptVideoSubscriber.h"
#include "PluginPreferenceHandler.h"
#include "resampler.h"

#include <thread>
#include <condition_variable>
#include <deque>
#include <atomic>
#include <fstream>

class RealtimeSttWhisper;

namespace jami {

class TranscriptAudioSubscriber : public Observer<AVFrame*>
{
public:
    TranscriptAudioSubscriber(const std::string& dataPath,
        std::function<void(const std::string&)> onText,
        std::function<void(const std::string&)> onPartialText,
        std::string filePath = "");
    ~TranscriptAudioSubscriber();

    virtual void update(Observable<AVFrame*>*, AVFrame* const&) override;
    virtual void attached(Observable<AVFrame*>*) override;
    virtual void detached(Observable<AVFrame*>*) override;

    void detach();

    void setParameter(const std::string& parameter, Parameter type);

private:
    // Observer pattern
    Observable<AVFrame*>* observable_ {};
    std::string language_ {"auto"};

    // Data
    std::string path_;
    bool writeToFile_ ;



    // Status variables of the processing
    bool firstRun {true};
    std::atomic_bool running {false};

    std::mutex inputLock;
    std::condition_variable cv_;

    // Model
    std::unique_ptr<RealtimeSttWhisper> whisper_;
    Resampler resampler_;
    std::vector<uniqueFramePtr> frames_;
    std::string modelpath_;
    //TODO: detect dynamicly
    bool newModel {true};

    // Threading
    std::thread processFrameThread;
    void processFrame();
    void stop();
    void start();

    // Video processor
    //TranscriptVideoSubscriber* mVS_ {};
    std::function<void(const std::string&)> onText_;
    std::function<void(const std::string&)> onPartialText_;
};
} // namespace jami
