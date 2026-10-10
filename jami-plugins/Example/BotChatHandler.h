/**
 *  Copyright (C) 2023-2024 Savoir-faire Linux Inc.
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

#include "BotPeerChatSubscriber.h"

#include "plugin/jamiplugin.h"
#include "plugin/chathandler.h"

#include <string>
#include <map>
#include <memory>
#include <set>

using chatSubjectPtr = std::shared_ptr<jami::PublishObservable<jami::pluginMessagePtr>>;

namespace jami {

class BotChatHandler : public jami::ChatHandler
{
public:
    BotChatHandler(const JAMI_PluginAPI* api,
                   std::string&& dataPath,
                   PluginPreferenceHandler* prefHandler);
    ~BotChatHandler();

    void notifyChatSubject(std::pair<std::string, std::string>& subjectConnection,
                           chatSubjectPtr subject) override;
    std::map<std::string, std::string> getChatHandlerDetails() override;
    void detach(chatSubjectPtr subject) override;
    void setPreferenceAttribute(const std::string& key, const std::string& value) override {}
    bool preferenceMapHasKey(const std::string& key) override { return false; }

    std::shared_ptr<BotPeerChatSubscriber> peerChatSubscriber_ {};

private:
    const JAMI_PluginAPI* api_;
    const std::string datapath_;
    PluginPreferenceHandler* aph_;
    std::set<chatSubjectPtr> subjects;
};
} // namespace jami
