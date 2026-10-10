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

#include "pluginMediaHandler.h"

#include <pluglog.h>
#include <string_view>
const char sep = separator();
const std::string TAG = "FORESEG";

#define NAME "Foreground Segmentation"

namespace jami {

PluginMediaHandler::PluginMediaHandler(std::map<std::string, std::string>&& preferences,
                                       std::string&& datapath)
    : dataPath_ {datapath}
    , preferences_ {preferences}
{
    setId(dataPath_);
#ifdef __ANDROID__
    mVS = std::make_shared<VideoSubscriber>(dataPath_ + sep + "model/mModel.ort",
                                            preferences_.at("acceleration") == "1");
#else
#ifdef NVIDIA
    mVS = std::make_shared<VideoSubscriber>(dataPath_ + sep + "model/mModel.onnx",
                                            preferences_.at("acceleration") == "1");
#else
    mVS = std::make_shared<VideoSubscriber>(dataPath_ + sep + "model/mModel.onnx");
#endif // NVIDIA
#endif // ANDROID
    mVS->setBackground(preferences_.at("background"));
    mVS->setBlur(preferences_.at("blur") == "1");
    mVS->setBlurLevel(preferences_.at("blurlevel"));
}

void
PluginMediaHandler::notifyAVFrameSubject(const StreamData& data, jami::avSubjectPtr subject)
{
    std::ostringstream oss;
    std::string_view direction = data.direction ? "Receive" : "Preview";
    oss << "NEW SUBJECT: [" << data.id << "," << direction << "]" << std::endl;

    bool preferredStreamDirection = false;
    auto it = preferences_.find("streamslist");
    if (it != preferences_.end()) {
        preferredStreamDirection = it->second == "in";
    }
    oss << "preferredStreamDirection " << preferredStreamDirection << std::endl;
    if (data.type == StreamType::video && !data.direction
        && data.direction == preferredStreamDirection) {
        detach();
        subject->attachPriorityObserver(mVS); // my image
        oss << "got my sent image attached" << std::endl;
        attached_ = '1';
    } else if (data.type == StreamType::video && data.direction
               && data.direction == preferredStreamDirection) {
        detach();
        subject->attachPriorityObserver(mVS); // the image I receive from the others on the call
        oss << "got my received image attached" << std::endl;
        attached_ = '1';
    }

    Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
}

std::map<std::string, std::string>
PluginMediaHandler::getCallMediaHandlerDetails()
{
    return {{"name", NAME},
            {"iconPath", dataPath_ + sep + "icon.svg"},
            {"pluginId", id()},
            {"attached", attached_},
            {"dataType", "1"}};
}

void
PluginMediaHandler::setPreferenceAttribute(const std::string& key, const std::string& value)
{
    auto it = preferences_.find(key);
    if (it != preferences_.end() && it->second != value) {
        it->second = value;
        if (key == "background") {
            mVS->setBackground(value);
        }
        if (key == "blur") {
            mVS->setBlur(value == "1");
        }
        if (key == "blurlevel") {
            mVS->setBlurLevel(value);
        }
    }
}

bool
PluginMediaHandler::preferenceMapHasKey(const std::string& key)
{
    return (key == "background" || key == "blur" || key == "blurlevel");
}

void
PluginMediaHandler::detach()
{
    attached_ = '0';
    mVS->detach();
}

PluginMediaHandler::~PluginMediaHandler()
{
    std::ostringstream oss;
    oss << " ~FORESEG Plugin" << std::endl;
    Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
    detach();
}
} // namespace jami
