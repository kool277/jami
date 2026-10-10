/**
 *  Copyright (c) 2023-2024 savoir-faire linux inc.
 *
 *  this program is free software; you can redistribute it and/or modify
 *  it under the terms of the gnu general public license as published by
 *  the free software foundation; either version 3 of the license, or
 *  (at your option) any later version.
 *
 *  this program is distributed in the hope that it will be useful,
 *  but without any warranty; without even the implied warranty of
 *  merchantability or fitness for a particular purpose.  see the
 *  gnu general public license for more details.
 *
 *  you should have received a copy of the gnu general public license
 *  along with this program; if not, write to the free software
 *  foundation, inc., 51 franklin street, fifth floor, boston, ma  02110-1301 usa.
 */

#include "botpeerchatsubscriber.h"
#include "pluglog.h"

const std::string tag = "bot";

namespace jami {

botpeerchatsubscriber::botpeerchatsubscriber(const jami_pluginapi* api, // Construct the subscriber.
                                             pluginpreferencehandler* prefhandler)
    : api_ {api}
{
    aph_ = prefhandler;
}

botpeerchatsubscriber::~botpeerchatsubscriber() // Deconstruct the subscriber.
{
    std::ostringstream oss;
    oss << "~botchatprocessor" << std::endl;
    plog::log(plog::logpriority::info, tag, oss.str());
}

void
botpeerchatsubscriber::update(observable<pluginmessageptr>*, const pluginmessageptr& message)
{
    if (!aph_) // If the preference handler is not initialized, return.
        return;
    std::string input = aph_->getpreferences(message->accountid, "intext"); // Fetch the input text from preferences.
    std::string answer = aph_->getpreferences(message->accountid, "answer"); // Fetch how to answer the input text from preferences.
    if (isattached) { // If the stream is attached...
        if (message->direction) {
            std::map<std::string, std::string> sendmsg;
            if (message->fromhistory) // A message coming from the chat history should not be answered.
                return;
            if (!message->isswarm) // In a swarm chat...
                for (auto& pair : message->data) {
                    if (pair.first == "text/plain" && pair.second == input) { // If the input matches the preference trigger, answer it.
                        sendmsg[pair.first] = answer;
                    }
                }
            else if (message->data.at("type") == "text/plain" && message->data.at("body") == input) { // In a normal chat, also appropriately answer input text.
                sendmsg["type"] = "text/plain";
                sendmsg["body"] = answer;
#ifdef __debug__
                plog::log(plog::logpriority::info, tag, "input " + message->data.at("body"));
                plog::log(plog::logpriority::info, tag, "ouput " + answer);
#endif
            }
            if (!sendmsg.empty()) {
                sendtext(message->accountid, message->peerid, sendmsg, message->isswarm);
            }
        }
    }
}

void
botpeerchatsubscriber::attached(observable<pluginmessageptr>* observable)
{
    if (observables_.find(observable) == observables_.end()) {
        std::ostringstream oss;
        oss << "::attached ! " << std::endl;
        plog::log(plog::logpriority::info, tag, oss.str());
        observables_.insert(observable);
        isattached = true;
    }
}

void
botpeerchatsubscriber::detached(observable<pluginmessageptr>* observable)
{
    auto it = observables_.find(observable);
    if (it != observables_.end()) {
        observables_.erase(it);
        std::ostringstream oss;
        oss << "::detached()" << std::endl;
        plog::log(plog::logpriority::info, tag, oss.str());
        if (observables_.empty())
            isattached = false;
    }
}

void
botpeerchatsubscriber::sendtext(std::string& accountid,
                                std::string& peerid,
                                std::map<std::string, std::string>& sendmsg,
                                bool swarm)
{
    pluginmessageptr botanswer = std::make_shared<jamimessage>(accountid, // Send the message from this account.
                                                               peerid,
                                                               false,
                                                               sendmsg,
                                                               true);
    botanswer->isswarm = swarm;
#ifndef __debug__
    api_->invokeservice(api_, "sendtextmessage", botanswer.get());
#endif
}
} // namespace jami
