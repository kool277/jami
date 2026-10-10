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

#include "TranscriptMediaHandler.h"

#include "pluglog.h"
#include <string_view>
#include <fmt/format.h>

const char sep = separator();
const std::string TAG = "Transcript";

#define NAME "Transcript"

namespace jami {

TranscriptMediaHandler::TranscriptMediaHandler(std::string&& datapath, PluginPreferenceHandler* prefHandler)
    : datapath_ {datapath}
{
    aph_ = prefHandler;
    setId(datapath_);
    videoSubscriber_ = std::make_shared<TranscriptVideoSubscriber>(datapath_);
    audioSubscriber_ = std::make_shared<TranscriptAudioSubscriber>(datapath_,
        [this](const std::string& text) {writeToFile(text);},
        [this](const std::string& text) { videoSubscriber_->setText(text); });
    auto preferences = aph_->getPreferences(accountId_);
    setParameters("default");
    previousModel= aph_->getPreferences(accountId_, "model");
#ifdef __DEBUG__
    auto it = preferences.find("subtitle");
    if (it != preferences.end())
        videoSubscriber_->setText(it->second);
#endif
}

// Function to format a time_t value into a date or time string.
std::string TranscriptMediaHandler::dateTime(time_t time)
{
    char buffer[90];
    const char* format = "[%Y-%m-%d %H:%M:%S]";
    struct tm* timeinfo = localtime(&time);
    strftime(buffer, sizeof(buffer), format, timeinfo);
    return buffer;
}


void TranscriptMediaHandler::writeToFile(const std::string& text){
    auto time = std::chrono::system_clock::now();
    std::time_t time_t = std::chrono::system_clock::to_time_t(time);
    // Convert the time in a string to be able to write it in the file
    std::string time_str= dateTime(time_t);
    outputFile_ << time_str << " -" <<text<< std::endl;
    Plog::log(Plog::LogPriority::INFO, TAG, fmt::format("Writing to file: {}", text));
}

void
TranscriptMediaHandler::notifyAVFrameSubject(const StreamData& data, jami::avSubjectPtr subject)
{
    std::ostringstream oss;
    std::string_view direction = data.direction ? "Receive" : "Preview";
    oss << "NEW SUBJECT: [" << data.id << "," << direction << "]" << std::endl;
    auto shouldUpdate = accountId_ != data.source;
    accountId_ = data.source;
    if (shouldUpdate)
        setParameters(accountId_);
    if (firstRun){
        firstRun = false;
        trancriptFile = aph_->getPreferences(accountId_,"TranscriptIntoFile") =="1";
    if (trancriptFile) {
        audioSubscriber_->setParameter("true", Parameter::WRITEINFILE);
        //generate the title of the file
        auto time = std::chrono::system_clock::now();
        std::time_t time_t = std::chrono::system_clock::to_time_t(time);
        // Convert the time in a string to be able to write it in the file
        std::string time_str= dateTime(time_t);
        auto transcriptPath= aph_->getPreferences(accountId_, "location");
        outputFile_.open(transcriptPath + sep + "transcript" + time_str +".txt", std::ios::app);
    } else {
        audioSubscriber_->setParameter("false", Parameter::WRITEINFILE);
    }
    }
    bool preferredStreamDirection = false; // false for output; true for input
    preferredStreamDirection = aph_->getPreferences(accountId_, "avstream") == "in";
    oss << "preferredStreamDirection " << preferredStreamDirection << std::endl;
    if (aph_->getPreferences(accountId_, "model")=="base"){
        modelpath = "/assets/ggml-base-q5_1.bin";
    } else{
        modelpath = "/assets/ggml-tiny-q5_1.bin";
    }
    if ((data.type == StreamType::audio && !data.direction
        && data.direction == preferredStreamDirection) || modelpath != previousModel) {
        if (attached_[0]) {
            attached_[0] = false;
            audioSubscriber_->detach();
        }
        previousModel = modelpath;
        Plog::log(Plog::LogPriority::INFO, TAG, "modelpath :" + modelpath);
        audioSubscriber_->setParameter(modelpath, Parameter::MODEL);
        subject->attach(audioSubscriber_.get()); // your audio
        oss << "got my sent audio attached" << std::endl;
        attached_[0] = true;
    } else if (data.type == StreamType::audio && data.direction
               && data.direction == preferredStreamDirection) {
        if (attached_[0]) {
            attached_[0] = false;
            audioSubscriber_->detach();
        }
        subject->attach(audioSubscriber_.get()); // the audio you receive from others on the call
        oss << "got received audio attached" << std::endl;
        attached_[0] = true;
    }

    if (data.type == StreamType::video && !data.direction
        && data.direction == preferredStreamDirection) {
        if (attached_[1]) {
            attached_[1] = false;
            videoSubscriber_->detach();
        }
        subject->attach(videoSubscriber_.get()); // your video
        oss << "got my sent video attached" << std::endl;
        attached_[1] = true;
    } else if (data.type == StreamType::video && data.direction
               && data.direction == preferredStreamDirection) {
        if (attached_[1]) {
            attached_[1] = false;
            videoSubscriber_->detach();
        }
        subject->attach(videoSubscriber_.get()); // the video you receive from others on the call
        oss << "got received video attached" << std::endl;
        attached_[1] = true;
    }

    Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
}

void
TranscriptMediaHandler::setParameters(const std::string& accountId)
{
    if (!accountId.empty() && accountId != accountId_)
        return;
    auto preferences = aph_->getPreferences(accountId_);
    try {
        videoSubscriber_->setParameter(preferences["fontsize"], Parameter::FONTSIZE);
        videoSubscriber_->setParameter(preferences["background"], Parameter::BACKGROUND);
        videoSubscriber_->setParameter(preferences["position"], Parameter::POSITION);
        audioSubscriber_->setParameter(preferences["language"], Parameter::LANGUAGE);
    } catch (std::exception& e) {
        Plog::log(Plog::LogPriority::ERR, TAG, e.what());
    }
}

std::map<std::string, std::string>
TranscriptMediaHandler::getCallMediaHandlerDetails()
{
    return {{"name", NAME},
            {"iconPath", datapath_ + sep + "icon.svg"},
            {"pluginId", id()},
            {"attached", attached_[0] && attached_[1] ? "1" : "0"},
            {"dataType", "1"}};
}

void
TranscriptMediaHandler::detach()
{
    attached_ = {false, false};
    videoSubscriber_->detach();
    audioSubscriber_->detach();
    firstRun = true;
    if (trancriptFile) {
        outputFile_.close();}
}

TranscriptMediaHandler::~TranscriptMediaHandler()
{
    Plog::log(Plog::LogPriority::INFO, TAG, "~TranscriptMediaHandler from WhisperTranscript Plugin");
    detach();
}
} // namespace jami
