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

#include "CoinCircleMediaHandler.h"
#include "pluglog.h"
#include <string_view>

const char sep = separator();
const std::string TAG = "CoinCircle";

#define NAME "CoinCircle"

namespace jami {

CoinCircleMediaHandler::CoinCircleMediaHandler(std::map<std::string, std::string>&& preferences,
                                               std::string&& datapath)
    : datapath_ {datapath}
    , preferences_ {preferences}
{
    setId(datapath_);
    mVS = std::make_shared<CoinCircleVideoSubscriber>(datapath_);
    auto it = preferences_.find("color");
    if (it != preferences_.end()) {
        mVS->setColor(it->second);
    } else {
        mVS->setColor("#0000FF");
    }
}

void
CoinCircleMediaHandler::notifyAVFrameSubject(const StreamData& data, jami::avSubjectPtr subject)
{
    std::ostringstream oss;
    std::string_view direction = data.direction ? "Receive" : "Preview";
    oss << "NEW SUBJECT: [" << data.id << "," << direction << "]" << std::endl;

    bool preferredStreamDirection = false; // false for output; true for input
    auto it = preferences_.find("videostream");
    if (it != preferences_.end()) {
        preferredStreamDirection = it->second == "1";
    }
    oss << "preferredStreamDirection " << preferredStreamDirection << std::endl;
    if (data.type == StreamType::video && !data.direction
        && data.direction == preferredStreamDirection) {
        subject->attach(mVS.get()); // your image
        oss << "got my sent image attached" << std::endl;
        attached_ = "1";
    } else if (data.type == StreamType::video && data.direction
               && data.direction == preferredStreamDirection) {
        subject->attach(mVS.get()); // the image you receive from others on the call
        oss << "got received image attached" << std::endl;
        attached_ = "1";
    }

    Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
}

std::map<std::string, std::string>
CoinCircleMediaHandler::getCallMediaHandlerDetails()
{
    return {{"name", NAME},
            {"iconPath", datapath_ + sep + "icon.svg"},
            {"pluginId", id()},
            {"attached", attached_},
            {"dataType", "1"}};
}

void
CoinCircleMediaHandler::setPreferenceAttribute(const std::string& key, const std::string& value)
{
    auto it = preferences_.find(key);
    if (it != preferences_.end() && it->second != value) {
        it->second = value;
    }
}

bool
CoinCircleMediaHandler::preferenceMapHasKey(const std::string& key)
{
    return false;
}

void
CoinCircleMediaHandler::detach()
{
    attached_ = "0";
    mVS->detach();
}

CoinCircleMediaHandler::~CoinCircleMediaHandler()
{
    std::ostringstream oss;
    oss << " ~CoinCircleMediaHandler from HelloWorld Plugin" << std::endl;
    Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
    detach();
}
} // namespace jami
