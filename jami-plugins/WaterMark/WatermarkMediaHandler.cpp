/**
 *  Copyright (C) 2021 Savoir-faire Linux Inc.
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

#include "WatermarkMediaHandler.h"

#include "PluginPreferenceHandler.h"
#include "pluglog.h"
#include <string_view>

const char sep = separator();
const std::string TAG = "Watermark";

#define NAME "Watermark"

namespace jami {

WatermarkMediaHandler::WatermarkMediaHandler(std::string&& dataPath,
                                             PluginPreferenceHandler* prefHandler)
    : datapath_ {dataPath}
{
    aph_ = prefHandler;
    setId(datapath_);
    mediaSubscriber_ = std::make_shared<WatermarkVideoSubscriber>(datapath_);
    setParameters("default");
}

void
WatermarkMediaHandler::notifyAVFrameSubject(const StreamData& data, jami::avSubjectPtr subject)
{
    std::ostringstream oss;
    std::string_view direction = data.direction ? "Receive" : "Preview";
    oss << "NEW SUBJECT: [" << data.id << "," << direction << "]" << std::endl;

    accountId_ = data.source;
    auto preferences = aph_->getPreferences(accountId_);

    bool preferredStreamDirection {false}; // false for output; true for input
    auto it = preferences.find("videostream");
    if (it != preferences.end()) {
        preferredStreamDirection = it->second == "1";
    }
    oss << "preferredStreamDirection " << preferredStreamDirection << std::endl;
    if (data.type == StreamType::video && !data.direction
        && data.direction == preferredStreamDirection) {
        if (attached_ == "1")
            detach();

        setParameters(data.source);
        subject->attach(mediaSubscriber_.get()); // your image
        oss << "got my sent image attached" << std::endl;
        attached_ = "1";
    } else if (data.type == StreamType::video && data.direction
               && data.direction == preferredStreamDirection) {
        if (attached_ == "1")
            detach();
        setParameters(data.source);
        subject->attach(mediaSubscriber_.get()); // the image you receive from others on the call
        oss << "got received image attached" << std::endl;
        attached_ = "1";
    }

    Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
}

void
WatermarkMediaHandler::setParameters(const std::string& accountId)
{
    if (!accountId.empty() && accountId != accountId_)
        return;
    auto preferences = aph_->getPreferences(accountId_);
    try {
        mediaSubscriber_->setParameter(preferences["fontsize"], Parameter::FONTSIZE);
        mediaSubscriber_->setParameter(preferences["logosize"], Parameter::LOGOSIZE);
        mediaSubscriber_->setParameter(preferences["markbackground"], Parameter::LOGOBACKGROUND);
        mediaSubscriber_->setParameter(preferences["showinfos"], Parameter::SHOWINFOS);
        mediaSubscriber_->setParameter(preferences["showlogo"], Parameter::SHOWLOGO);
        mediaSubscriber_->setParameter(preferences["mark"], Parameter::LOGOPATH);
        mediaSubscriber_->setParameter(preferences["date"], Parameter::DATE);
        mediaSubscriber_->setParameter(preferences["dateformat"], Parameter::DATEFORMAT);
        mediaSubscriber_->setParameter(preferences["time"], Parameter::TIME);
        mediaSubscriber_->setParameter(preferences["timezone"], Parameter::TIMEZONE);
        mediaSubscriber_->setParameter(preferences["timeformat"], Parameter::TIMEFORMAT);
        mediaSubscriber_->setParameter(preferences["location"], Parameter::LOCATION);
        mediaSubscriber_->setParameter(preferences["infosposition"], Parameter::INFOSPOSITION);
        mediaSubscriber_->setParameter(preferences["logoposition"], Parameter::LOGOPOSITION);
    } catch (std::exception& e) {
        Plog::log(Plog::LogPriority::ERR, TAG, e.what());
    }
}

std::map<std::string, std::string>
WatermarkMediaHandler::getCallMediaHandlerDetails()
{
    return {{"name", NAME},
            {"iconPath", datapath_ + sep + "icon.svg"},
            {"pluginId", id()},
            {"attached", attached_},
            {"dataType", "1"}};
}

void
WatermarkMediaHandler::detach()
{
    attached_ = "0";
    mediaSubscriber_->detach();
}

WatermarkMediaHandler::~WatermarkMediaHandler()
{
    Plog::log(Plog::LogPriority::INFO, TAG, "~WatermarkMediaHandler from WaterMark Plugin");
    detach();
}
} // namespace jami
