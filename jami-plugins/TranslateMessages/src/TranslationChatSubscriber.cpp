/**
 *  Copyright (C) 2023-2026 Savoir-faire Linux Inc.
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

#include "TranslationChatSubscriber.h"
#include "pluglog.h"
#include "translatelog.h"

constexpr auto TAG = "TranslateMessages";

namespace jami {
    TranslationChatSubscriber::TranslationChatSubscriber() = default;

    TranslationChatSubscriber::~TranslationChatSubscriber() = default;

    void
    TranslationChatSubscriber::update(Observable<pluginMessagePtr> *, pluginMessagePtr const &message) {
        if (!message || message->direction) {
            return;
        }
        if (onOutgoingMessage) {
            onOutgoingMessage(message);
        }
    }

    void
    TranslationChatSubscriber::attached(Observable<pluginMessagePtr> *observable) {
        observables_.insert(observable);
    }

    void
    TranslationChatSubscriber::detached(Observable<pluginMessagePtr> *observable) {
        if (const auto it = observables_.find(observable); it != observables_.end()) {
            observables_.erase(it);
            PLOG(Plog::LogPriority::INFO, TAG, "detached from chat");
        }
    }
} // namespace jami
