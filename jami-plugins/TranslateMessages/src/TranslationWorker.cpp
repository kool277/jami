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

#include "TranslationWorker.h"
#include "TranslatorHelpers.h"
#include "translatelog.h"

namespace jami {
    TranslationWorker::TranslationWorker(std::shared_ptr<Translator> translator, Callback callback)
        : translator_{std::move(translator)}
          , callback_{std::move(callback)}
          , thread_{&TranslationWorker::workerLoop, this} {
    }

    TranslationWorker::~TranslationWorker() {
        {
            std::lock_guard lock(mutex_);
            stop_ = true;
        }
        // Interrupt any in-flight ORT Session::Run so the worker thread unblocks
        // promptly and thread_.join() doesn't block for the full inference duration.
        if (translator_) {
            translator_->terminate();
        }
        cv_.notify_all();
        if (thread_.joinable()) {
            thread_.join();
        }
    }

    void
    TranslationWorker::drainQueue() {
        std::lock_guard lock(mutex_);
        std::queue<Job> empty;
        queue_.swap(empty);
    }

    void
    TranslationWorker::enqueue(Job job) {
        {
            std::lock_guard lock(mutex_);
            queue_.push(std::move(job));
        }
        cv_.notify_one();
    }

    void
    TranslationWorker::workerLoop() {
        // Block until the model finishes loading (or we're shut down before it does).
        if (!translator_ || !translator_->waitReady()) {
            return;
        }

        while (true) {
            Job job;
            {
                std::unique_lock lock(mutex_);
                cv_.wait(lock, [this] { return stop_ || !queue_.empty(); });
                if (stop_ && queue_.empty()) {
                    return;
                }
                job = std::move(queue_.front());
                queue_.pop();
            }

            try {
                if (!job.targetLang.empty()) {
                    translator_->setTargetLanguage(job.targetLang);
                }
                auto translated = translator_->translate(job.text);
                // Don't fire the callback if we've been asked to stop: the translation
                // may have returned the original text (terminated run), and calling the
                // callback would write that into the cache and invoke daemon API methods
                // on a partially torn-down handler.
                if (!stop_) {
                    callback_(std::move(translated),
                              std::move(job.accountId),
                              std::move(job.conversationId),
                              std::move(job.messageId),
                              std::move(job.cacheKey),
                              job.isOwnMessage,
                              job.isOutgoingSend);
                }
            } catch (...) {
                // Last-resort guard: a second bad_alloc thrown inside a catch block
                // when memory is fully exhausted cannot be caught by translate() itself.
                PLOG(Plog::LogPriority::ERR, TRANS_TAG, "Worker: unexpected exception swallowed");
            }
        }
    }
} // namespace jami
