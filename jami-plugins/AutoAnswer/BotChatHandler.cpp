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

#include "BotChatHandler.h"

#include "pluglog.h"

const char sep = separator();
const std::string TAG = "Bot";

#define NAME "Bot"

namespace jami {

BotChatHandler::BotChatHandler(const JAMI_PluginAPI* api,
                               std::string&& dataPath,
                               PluginPreferenceHandler* prefHandler)
    : api_ {api}
    , datapath_ {dataPath}
{
    setId(datapath_);
    aph_ = prefHandler;
    peerChatSubscriber_ = std::make_shared<BotPeerChatSubscriber>(api_, aph_);
};

void
BotChatHandler::notifyChatSubject(std::pair<std::string, std::string>& subjectConnection,
                                  chatSubjectPtr subject)
{
    if (peerChatSubscriber_ && subjects.find(subject) == subjects.end()) {
        std::ostringstream oss;
        oss << "NEW SUBJECT: account = " << subjectConnection.first
            << " peer = " << subjectConnection.second << std::endl;
        Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
        subject->attach(peerChatSubscriber_.get());
        subjects.insert(subject);
    }
}

std::map<std::string, std::string>
BotChatHandler::getChatHandlerDetails()
{
    return {{"name", NAME}, {"iconPath", datapath_ + sep + "icon.svg"}, {"pluginId", id()}};
}

void
BotChatHandler::detach(chatSubjectPtr subject)
{
    auto it = subjects.find(subject);
    if (it != subjects.end()) {
        subject->detach(peerChatSubscriber_.get());
        subjects.erase(it);
    }
}

BotChatHandler::~BotChatHandler()
{
    const auto copy = subjects;
    for (const auto& subject : copy) {
        detach(subject);
    }
}
} // namespace jami
