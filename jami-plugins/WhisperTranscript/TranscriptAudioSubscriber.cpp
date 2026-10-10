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

#include "TranscriptAudioSubscriber.h"

#include <pluglog.h>
#include <frameUtils.h>
#include <bitset>
#include <iostream>
#include <fmt/core.h>
#include <fmt/format.h>
#include "stt_whisper.h"

const std::string TAG = "TranscriptAudio";
const char sep = separator();

namespace jami {

TranscriptAudioSubscriber::TranscriptAudioSubscriber(const std::string& dataPath,
        std::function<void(const std::string&)> onText,
        std::function<void(const std::string&)> onPartialText,
        std::string filePath)
    : path_ {dataPath}
    , onText_ {onText}
    , onPartialText_ {onPartialText}
{
    Plog::log(Plog::LogPriority::INFO, TAG, fmt::format("TranscriptAudioSubscriber {}", fmt::ptr(this)));
}

TranscriptAudioSubscriber::~TranscriptAudioSubscriber()
{
    Plog::log(Plog::LogPriority::INFO, TAG, fmt::format("~TranscriptAudioSubscriber {}", fmt::ptr(this)));
}

/**
 * Waits for audio samples and then process them
 **/
void
TranscriptAudioSubscriber::processFrame()
{
    if ((!whisper_ ) || newModel) {
        whisper_ = std::make_unique<RealtimeSttWhisper>(path_ + modelpath_);
        newModel = false;
        }
        whisper_->setLanguage(language_);

    while (running) {
        decltype(frames_) frames;
        {
            std::unique_lock<std::mutex> l(inputLock);
            cv_.wait(l, [&]{
                return !running || !frames_.empty();
            });
            if (!running)
                return;
            frames = std::move(frames_);
        }

        for (auto& f : frames) {
            if (f->nb_samples == 0 || f->sample_rate == 0 || f->ch_layout.nb_channels == 0) {
                //Plog::log(Plog::LogPriority::ERR, TAG, "processFrame() - empty frame");
                continue;
            }
            if (f->ch_layout.nb_channels == 1)
                f->ch_layout = AV_CHANNEL_LAYOUT_MONO;
            uniqueFramePtr filteredFrame = getUniqueFrame();
            filteredFrame->sample_rate = WHISPER_SAMPLE_RATE;
            filteredFrame->format  = AV_SAMPLE_FMT_FLT;
            av_channel_layout_from_mask(&filteredFrame->ch_layout , AV_CH_LAYOUT_MONO);
            try {
                if (resampler_.resample(f.get(), filteredFrame.get()) == 0) {
                    whisper_->AddAudioData((float*) filteredFrame->buf[0]->data,
                                           filteredFrame->nb_samples);
                }
            } catch (...) {
            }
        }

        auto result = whisper_->GetTranscribed();
        if (not result.empty()) {
            std::string txt;
            for (const auto& t : result) {
                Plog::log(Plog::LogPriority::INFO, TAG, fmt::format("Transcribed: {} partial: {}", t.text, t.is_partial));
                if (!t.is_partial && !t.text.empty()) {
                    onText_(t.text);
                }
                txt += t.text;
            }
            if (!txt.empty()){
                // We detect annotation inside of () or [] and remove them from the text before displaying it
                std::string::size_type pos = 0;
                while ((pos = txt.find_first_of("()[]", pos)) != std::string::npos) {
                    std::string::size_type end = txt.find_first_of("()[]", pos + 1);
                    if (end != std::string::npos) {
                        txt.erase(pos, end - pos + 1);
                    } else {
                        txt.erase(pos);
                        break;
                    }
                }
                if (!txt.empty()) {
                    onPartialText_(txt);
                }
            }
        }
    }
    whisper_.reset();
}

void
TranscriptAudioSubscriber::stop()
{
    Plog::log(Plog::LogPriority::INFO, TAG, "stop()");
    {
        std::unique_lock<std::mutex> l(inputLock);
        running = false;
        cv_.notify_all();
    }
    if (processFrameThread.joinable()) {
        processFrameThread.join();
    }
    onPartialText_("");
}

void
TranscriptAudioSubscriber::start()
{
    Plog::log(Plog::LogPriority::INFO, TAG, "start()");
    running = true;
    processFrameThread = std::thread([this](){ processFrame(); });
    onPartialText_("");
}

void
TranscriptAudioSubscriber::setParameter(const std::string& parameter, Parameter type)
{
    std::unique_lock<std::mutex> l(inputLock);
    switch (type) {
    case (Parameter::LANGUAGE):
        language_ = parameter;
        if (whisper_)
            whisper_->setLanguage(parameter);
        break;
    case (Parameter::MODEL):
        modelpath_ = parameter;
        newModel = true;
        break;
    case (Parameter::WRITEINFILE):
        if (parameter == "true")
            writeToFile_ = true;
        else if (parameter == "false")
            writeToFile_ = false;
    default:
        return;
    }
}

void
TranscriptAudioSubscriber::update(jami::Observable<AVFrame*>* obs, AVFrame* const& pluginFrame)
{
    std::unique_lock<std::mutex> l(inputLock);
    if (!pluginFrame || obs != observable_)
        return;

    frames_.emplace_back(uniqueFramePtr(av_frame_clone(pluginFrame), frameFree));
    cv_.notify_all();
    // audio returns as is
}

void
TranscriptAudioSubscriber::attached(jami::Observable<AVFrame*>* observable)
{
    std::unique_lock<std::mutex> l(inputLock);
    Plog::log(Plog::LogPriority::INFO, TAG, fmt::format("::Attached ! {} for {}", fmt::ptr(this), fmt::ptr(observable)));
    observable_ = observable;
    start();
}

void
TranscriptAudioSubscriber::detached(jami::Observable<AVFrame*>* observable)
{
    firstRun = true;
    observable_ = nullptr;
    stop();
    Plog::log(Plog::LogPriority::INFO, TAG, fmt::format("::Detached ! {} for {}", fmt::ptr(this), fmt::ptr(observable)));
}

void
TranscriptAudioSubscriber::detach()
{
    if (observable_) {
        firstRun = true;
        observable_->detach(this);
    }
}
} // namespace jami
