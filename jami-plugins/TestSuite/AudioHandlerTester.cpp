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

#include "AudioHandlerTester.h"

#include "pluglog.h"
#include <string_view>

const char sep = separator();
const std::string TAG = "AudioHandlerTester";

#define NAME "AudioHandlerTester"

namespace jami {

AudioHandlerTester::AudioHandlerTester(std::string&& datapath)
    : datapath_ {datapath}
{
    setId(datapath_);
    mAS = std::make_shared<AudioSubscriberTester>();
}

void
AudioHandlerTester::notifyAVFrameSubject(const StreamData& data, jami::avSubjectPtr subject)
{
    if (!mAS)
        return;
    std::ostringstream oss;
    std::string_view direction = data.direction ? "Receive" : "Preview";
    oss << "NEW SUBJECT: [" << data.id << "," << direction << "]" << std::endl;
    bool preferredStreamDirection = false; // false for output; true for input
    oss << "preferredStreamDirection " << preferredStreamDirection << std::endl;
    if (data.type == StreamType::audio && !data.direction
        && data.direction == preferredStreamDirection) {
        subject->attach(mAS.get()); // your image
        oss << "got my sent audio attached" << std::endl;
        attached_ = '1';
    } else if (data.type == StreamType::audio && data.direction
               && data.direction == preferredStreamDirection) {
        subject->attach(mAS.get()); // the image you receive from others on the call
        oss << "got received audio attached" << std::endl;
        attached_ = '1';
    }

    Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
}

std::map<std::string, std::string>
AudioHandlerTester::getCallMediaHandlerDetails()
{
    return {{"name", NAME},
            {"iconPath", datapath_ + sep + "icon.svg"},
            {"pluginId", id()},
            {"attached", attached_},
            {"dataType", "0"}};
}

void
AudioHandlerTester::detach()
{
    attached_ = '0';
    mAS->detach();
}

AudioHandlerTester::~AudioHandlerTester()
{
    std::ostringstream oss;
    oss << " ~AudioHandlerTester from TestSuite Plugin" << std::endl;
    Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
    detach();
}
} // namespace jami
