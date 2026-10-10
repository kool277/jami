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
 *  Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301 USA.
 */

#include "FilterMediaHandler.h"

#include "pluglog.h"
#include <string_view>

const char sep = separator();
const std::string TAG = "Filter";

#define NAME "Filter"

namespace jami {

FilterMediaHandler::FilterMediaHandler(std::map<std::string, std::string>&& preferences,
                                       std::string&& datapath)
    : datapath_ {datapath}
    , preferences_ {preferences}
{
    setId(datapath_);
    auto it = preferences_.find("irFile");
    if (it != preferences_.end())
        mAS_ = std::make_shared<FilterAudioSubscriber>(datapath_, it->second);
}

void
FilterMediaHandler::notifyAVFrameSubject(const StreamData& data, jami::avSubjectPtr subject)
{
    if (!mAS_)
        return;
    std::ostringstream oss;
    std::string_view direction = data.direction ? "Receive" : "Preview";
    oss << "NEW SUBJECT: [" << data.id << "," << direction << "]" << std::endl;
    bool preferredStreamDirection = false; // false for output; true for input
    auto it = preferences_.find("streamlist");
    if (it != preferences_.end()) {
        preferredStreamDirection = it->second == "in";
    }
    oss << "preferredStreamDirection " << preferredStreamDirection << std::endl;
    if (data.type == StreamType::audio && !data.direction
        && data.direction == preferredStreamDirection) {
        subject->attach(mAS_.get()); // your audio
        oss << "got my sent audio attached" << std::endl;
        attached_ = '1';
    } else if (data.type == StreamType::audio && data.direction
               && data.direction == preferredStreamDirection) {
        subject->attach(mAS_.get()); // the audio you receive from others on the call
        oss << "got received audio attached" << std::endl;
        attached_ = '1';
    }

    Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
}

std::map<std::string, std::string>
FilterMediaHandler::getCallMediaHandlerDetails()
{
    return {{"name", NAME},
            {"iconPath", datapath_ + sep + "icon.svg"},
            {"pluginId", id()},
            {"attached", attached_},
            {"dataType", "0"}};
}

void
FilterMediaHandler::setPreferenceAttribute(const std::string& key, const std::string& value)
{
    auto it = preferences_.find(key);
    if (it != preferences_.end() && it->second != value) {
        it->second = value;
        if (key == "irFile" && mAS_)
            mAS_->setIRFile(value);
    }
}

bool
FilterMediaHandler::preferenceMapHasKey(const std::string& key)
{
    if (key == "irFile")
        return true;
    return false;
}

void
FilterMediaHandler::detach()
{
    attached_ = '0';
    if (mAS_)
        mAS_->detach();
}

FilterMediaHandler::~FilterMediaHandler()
{
    std::ostringstream oss;
    oss << " ~FilterMediaHandler from AudioFilter Plugin" << std::endl;
    Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
    detach();
}
} // namespace jami
