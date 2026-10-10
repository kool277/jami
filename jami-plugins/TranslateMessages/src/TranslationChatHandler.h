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

#include "TranslationChatSubscriber.h"
#include "TranslationPreferenceHandler.h"
#include "Translator.h"
#include "TranslationWorker.h"

#include "plugin/jamiplugin.h"
#include "plugin/chathandler.h"

#include <string>
#include <string_view>
#include <map>
#include <mutex>
#include <unordered_map>
#include <memory>
#include <set>
#include <vector>
#include <atomic>

using chatSubjectPtr = std::shared_ptr<jami::PublishObservable<jami::pluginMessagePtr> >;

namespace jami {
    class TranslationChatHandler : public ChatHandler {
    public:
        /**
         * Creates the chat handler, creates the Chat subscribers and the `Translator`.
         * @param api        The Jami plugin API
         * @param dataPath   The path where the plugin is installed
         * @param prefHandler Pointer to the per-account preference handler (not owned; must outlive this)
         */
        TranslationChatHandler(const JAMI_PluginAPI *api,
                               std::string &&dataPath,
                               TranslationPreferenceHandler *prefHandler);

        /**
         * Wait for the workers to finish and detaches the subscriber
         */
        ~TranslationChatHandler() override;

        /**
         * Notify the subscribers of the arrival of a new message
         * @param subjectConnection
         * @param subject
         */
        void notifyChatSubject(std::pair<std::string, std::string> &subjectConnection,
                               chatSubjectPtr subject) override;

        std::map<std::string, std::string> getChatHandlerDetails() override;

        void detach(chatSubjectPtr subject) override;

        void setPreferenceAttribute(const std::string &key, const std::string &value) override;

        bool preferenceMapHasKey(const std::string &key) override;

        void transformSwarmMessages(std::vector<libjami::SwarmMessage> &messages,
                                    const std::string &accountId,
                                    const std::string &conversationId) override;

        std::shared_ptr<TranslationChatSubscriber> peerChatSubscriber_{};

    private:
        std::string getTargetLanguage(const std::string &accountId) const;

        /**
         * Returns the effective "translate incoming" flag for the given account:
         * checks per-account override first, falls back to the global toggle.
         */
        bool getTranslateIncoming(const std::string &accountId) const;

        /**
         * Returns the effective "translate outgoing" (send-translate) flag for the given account:
         * checks per-account override first, falls back to the global toggle.
         */
        bool getTranslateOutgoing(const std::string &accountId) const;

        /**
         * Returns the effective send target language for the given account.
         */
        std::string getSendTargetLanguage(const std::string &accountId) const;

        /**
         * Called for every real-time outgoing swarm message.
         * Implements the send-then-edit translation flow.
         */
        void handleOutgoingMessage(pluginMessagePtr const &message);

        // setPreferenceAttribute helpers — one per complex preference key.
        void applyTranslateIncoming(const std::string &value);

        void applyTranslateOutgoing(const std::string &value);

        void applyTargetLanguage(const std::string &value);

        void applySendTargetLanguage(const std::string &value);

        // transformSwarmMessages helpers — both must be called under cacheMutex_.
        void evictCacheIfNeeded();

        void processSwarmMessage(libjami::SwarmMessage &msg,
                                 std::string_view ownUri,
                                 const std::string &lang,
                                 const std::string &accountId,
                                 const std::string &conversationId,
                                 std::vector<TranslationWorker::Job> &toEnqueue);

        // Callback invoked by the worker thread when a translation job completes.
        void onTranslationComplete(std::string translation,
                                   std::string accountId,
                                   std::string conversationId,
                                   std::string messageId,
                                   const std::string &cacheKey,
                                   bool isOwnMessage,
                                   bool isOutgoingSend);

        /**
         * (Re)create the TranslationWorker with the current translator and language.
         *  Must be called whenever the translator or target language changes.
         */
        void setupWorker();

        /**
         * For every account that has no user-set override (as determined by hasOverride),
         * writes overrideKey=value to the account preference store via setPluginAccPreference
         * so the preference UI reflects the current global setting.
         */
        void syncAccountDisplayPref(const std::string &overrideKey,
                                    const std::string &value,
                                    const std::function<bool(const std::string &)> &hasOverride) const;

        // Persistent translation cache
        std::string cacheFilePath() const;

        void loadCacheFromDisk(); // called once in constructor, no lock needed
        void saveCacheToDisk() const; // must be called under cacheMutex_

        const JAMI_PluginAPI *api_;
        const std::string datapath_;
        // Not owned; set at construction; valid for the plugin's lifetime.
        TranslationPreferenceHandler *prefHandler_{nullptr};
        /**
         * Protects targetLanguage_ and sendTargetLanguage_.
         * std::string is not trivially copyable so std::atomic<std::string> is not available
         * even in C++20. The lock is held only for the bare read/write — never across
         * slow calls like setupWorker() or invokeService().
         */
        mutable std::mutex langMutex_;
        std::string targetLanguage_{"en"};
        std::shared_ptr<Translator> translator_;
        /**
         * Background worker: runs translation off the IO thread.
         */
        std::unique_ptr<TranslationWorker> worker_;
        std::set<chatSubjectPtr> subjects;
        // Maps each attached subject to its {accountId, conversationId} connection.
        std::map<chatSubjectPtr, std::pair<std::string, std::string> > subjectToConnection_;
        // Set of {accountId, conversationId} pairs this handler is actively attached to.
        // transformSwarmMessages only processes conversations present in this set.
        std::set<std::pair<std::string, std::string> > attachedConversations_;
        /**
         * Protects translationCache_, accessed from both the daemon's
         * conversation thread (transformSwarmMessages) and the worker callback thread.
         */
        mutable std::mutex cacheMutex_;
        /**
         * Cache: message id → translated text.
         * Empty string ("") is a sentinel meaning "translation in progress".
         */
        std::unordered_map<std::string, std::string> translationCache_;
        /**
         * Maximum number of completed entries kept in memory and written to disk.
         * When exceeded, completed entries are evicted (oldest-in-iteration order).
         */
        static constexpr std::size_t MAX_CACHE_ENTRIES = 2000;
        /**
         * Whether to translate incoming messages (received from others).
         * Controlled by the "translateIncoming" plugin preference.
         */
        std::atomic<bool> translateIncoming_{true};
        /**
         * Whether to translate outgoing messages before sending (send-translate).
         * Controlled by the "translateOutgoing" plugin preference.
         */
        std::atomic<bool> translateOutgoing_{false};
        /**
         * Maps accountId → the account's own URI, populated on first attach / outgoing message.
         * Used to skip self-authored messages in the receive-translate path.
         * Protected by ownUriMutex_: accessed from the subscriber thread, the daemon conversation
         * thread, and the notification thread.
         */
        mutable std::mutex ownUriMutex_;
        std::unordered_map<std::string, std::string> ownUriCache_;

        /**
         * Return the cached own-URI for accountId, fetching it from the daemon if not yet known.
         * Safe to call from any thread; the invokeService call is made outside the lock so it
         * never blocks threads that already have the URI cached.
         * Returns "" when the daemon cannot supply a URI.
         */
        std::string getOrFetchOwnUri(const std::string &accountId);

        // ---- Send-translated (send-then-edit) ----
        /**
         * Global target language for outgoing message translation.
         * Protected by langMutex_.
         */
        std::string sendTargetLanguage_{"en"};
    };
} // namespace jami
