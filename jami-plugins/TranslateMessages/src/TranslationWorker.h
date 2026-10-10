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

#pragma once

#include "Translator.h"

#include <functional>
#include <memory>
#include <atomic>
#include <mutex>
#include <condition_variable>
#include <queue>
#include <thread>
#include <string>

namespace jami {
    // Runs translation on a single background thread to avoid blocking Jami's
    // message dispatch thread. Callback is invoked from the worker thread.
    class TranslationWorker {
    public:
        struct Job {
            std::string text;
            std::string accountId;
            std::string conversationId;
            std::string messageId;
            // Full cache key (e.g. msgId+'\x1F'+lang+'\x1F'+suffix); baked in at enqueue time
            // so the callback stores the result under exactly the right key.
            std::string cacheKey;
            // Target language for this job (e.g. "fr", "de"). Set before calling
            // translator_->translate() so mixed-account jobs use the right language.
            std::string targetLang;
            // True when the message was authored by the local user.
            // The callback uses this to skip the UI update when translateOutgoing is off.
            bool isOwnMessage{false};
            // True when this job was triggered by the "send translated" feature.
            // The callback calls editMessage instead of updateMessageBodyOverwrite.
            bool isOutgoingSend{false};
        };

        using Callback = std::function<void(std::string translation,
                                            std::string accountId,
                                            std::string conversationId,
                                            std::string messageId,
                                            std::string cacheKey,
                                            bool isOwnMessage,
                                            bool isOutgoingSend)>;

        TranslationWorker(std::shared_ptr<Translator> translator, Callback callback);

        ~TranslationWorker(); // joins the worker thread

        void enqueue(Job job);

        // Discard all queued (not yet started) jobs.
        void drainQueue();

    private:
        void workerLoop();

        std::shared_ptr<Translator> translator_;
        Callback callback_;

        std::queue<Job> queue_;
        std::mutex mutex_;
        std::condition_variable cv_;
        std::thread thread_;
        std::atomic<bool> stop_{false};
    };
} // namespace jami
