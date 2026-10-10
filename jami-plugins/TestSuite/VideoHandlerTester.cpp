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

#include "VideoHandlerTester.h"

#include "pluglog.h"
#include <string_view>

const char sep = separator();
const std::string TAG = "VideoHandlerTester";

#define NAME "VideoHandlerTester"

namespace jami {

VideoHandlerTester::VideoHandlerTester(std::string&& datapath)
    : datapath_ {datapath}
{
    setId(datapath_);
    mVS = std::make_shared<VideoSubscriberTester>();
}

void
VideoHandlerTester::notifyAVFrameSubject(const StreamData& data, jami::avSubjectPtr subject)
{
    std::ostringstream oss;
    std::string_view direction = data.direction ? "Receive" : "Preview";
    oss << "NEW SUBJECT: [" << data.id << "," << direction << "]" << std::endl;

    bool preferredStreamDirection = false; // false for output; true for input
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
VideoHandlerTester::getCallMediaHandlerDetails()
{
    return {{"name", NAME},
            {"iconPath", datapath_ + sep + "icon.svg"},
            {"pluginId", id()},
            {"attached", attached_},
            {"dataType", "1"}};
}

void
VideoHandlerTester::detach()
{
    attached_ = "0";
    mVS->detach();
}

VideoHandlerTester::~VideoHandlerTester()
{
    std::ostringstream oss;
    oss << " ~VideoHandlerTester from TestSuite Plugin" << std::endl;
    Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
    detach();
}
} // namespace jami
