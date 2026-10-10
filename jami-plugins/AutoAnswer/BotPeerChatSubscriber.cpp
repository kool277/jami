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

#include "BotPeerChatSubscriber.h"
#include "pluglog.h"

const std::string TAG = "bot";

namespace jami {

BotPeerChatSubscriber::BotPeerChatSubscriber(const JAMI_PluginAPI* api,
                                             PluginPreferenceHandler* prefHandler)
    : api_ {api}
{
    aph_ = prefHandler;
}

BotPeerChatSubscriber::~BotPeerChatSubscriber()
{
    std::ostringstream oss;
    oss << "~botChatProcessor" << std::endl;
    Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
}

void
BotPeerChatSubscriber::update(Observable<pluginMessagePtr>*, const pluginMessagePtr& message)
{
    if (!aph_)
        return;
    std::string input = aph_->getPreferences(message->accountId, "inText");
    std::string answer = aph_->getPreferences(message->accountId, "answer");
    if (isAttached) {
        if (message->direction) {
            std::map<std::string, std::string> sendMsg;
            if (message->fromHistory)
                return;
            if (!message->isSwarm)
                for (auto& pair : message->data) {
                    if (pair.first == "text/plain" && pair.second == input) {
                        sendMsg[pair.first] = answer;
                    }
                }
            else if (message->data.at("type") == "text/plain" && message->data.at("body") == input) {
                sendMsg["type"] = "text/plain";
                sendMsg["body"] = answer;
#ifdef __DEBUG__
                Plog::log(Plog::LogPriority::INFO, TAG, "input " + message->data.at("body"));
                Plog::log(Plog::LogPriority::INFO, TAG, "ouput " + answer);
#endif
            }
            if (!sendMsg.empty()) {
                sendText(message->accountId, message->peerId, sendMsg, message->isSwarm);
            }
        }
    }
}

void
BotPeerChatSubscriber::attached(Observable<pluginMessagePtr>* observable)
{
    if (observables_.find(observable) == observables_.end()) {
        std::ostringstream oss;
        oss << "::Attached ! " << std::endl;
        Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
        observables_.insert(observable);
        isAttached = true;
    }
}

void
BotPeerChatSubscriber::detached(Observable<pluginMessagePtr>* observable)
{
    auto it = observables_.find(observable);
    if (it != observables_.end()) {
        observables_.erase(it);
        std::ostringstream oss;
        oss << "::Detached()" << std::endl;
        Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
        if (observables_.empty())
            isAttached = false;
    }
}

void
BotPeerChatSubscriber::sendText(std::string& accountId,
                                std::string& peerId,
                                std::map<std::string, std::string>& sendMsg,
                                bool swarm)
{
    pluginMessagePtr botAnswer = std::make_shared<JamiMessage>(accountId,
                                                               peerId,
                                                               false,
                                                               sendMsg,
                                                               true);
    botAnswer->isSwarm = swarm;
#ifndef __DEBUG__
    api_->invokeService(api_, "sendTextMessage", botAnswer.get());
#endif
}
} // namespace jami
