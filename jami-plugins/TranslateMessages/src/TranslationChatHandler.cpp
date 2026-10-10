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

#include "TranslationChatHandler.h"
#include "Translator.h"

#include "plugin/streamdata.h"
#include "pluglog.h"
#include "translatelog.h"

#include <json/json.h>
#include <algorithm>
#include <format>
#include <locale>
#include <filesystem>
#include <fstream>
#include <functional>

constexpr auto HANDLER_TAG = "TranslateMessages";

static std::string
truncLog(const std::string& s, const std::size_t n = 40)
{
    return s.size() > n ? s.substr(0, n) + "[…]" : s;
}

namespace jami {
#pragma region Helpers
// Returns a 2-letter ISO-639-1 language code for the Jami app language.
// Reads JAMI_LANG first (set by the Jami Qt client, the same env var the daemon
// uses in PluginUtils::getLanguage), then falls back to setlocale(LC_COLLATE).
// Falls back to "en" if nothing useful is found.
static std::string
jamiAppLanguage()
{
    auto extractCode = [](const char* locale) -> std::string {
        if (!locale || locale[0] == '\0') {
            return {};
        }
        const std::string s(locale);
        if (s == "C" || s == "POSIX") {
            return {};
        }
        // Take up to the first '_', '.', '-', or '@'.
        const auto end = s.find_first_of("_.-@");
        const auto code = (end == std::string::npos) ? s : s.substr(0, end);
        // Sanity check: ISO 639-1 codes are 2-3 chars; reject anything longer.
        if (code.empty() || code.size() > 8) {
            return {};
        }
        std::string lower(code.size(), '\0');
        std::ranges::transform(code, lower.begin(), ::tolower);
        return lower;
    };

    // 1. JAMI_LANG is set by the Jami client (the same source the daemon uses).
    if (const char* env = std::getenv("JAMI_LANG")) {
        if (auto code = extractCode(env); !code.empty()) {
            return code;
        }
    }
    // 2. std::locale("") — thread-safe query of the system locale (no global mutation).
    std::string localeName;
    try {
        localeName = std::locale("").name();
    } catch (const std::runtime_error& e) {
        PLOG(Plog::LogPriority::ERR, HANDLER_TAG, "std::locale() failed: {}", e.what());
        return "en";
    }
    if (auto code = extractCode(localeName.c_str()); !code.empty()) {
        return code;
    }

    return "en";
}
#pragma endregion // Helpers

#pragma region Construction
TranslationChatHandler::TranslationChatHandler(const JAMI_PluginAPI* api,
                                               std::string&& dataPath,
                                               TranslationPreferenceHandler* prefHandler)
    : api_ {api}
    , datapath_ {std::move(dataPath)}
    , prefHandler_ {prefHandler}
{
    setId(datapath_);
    peerChatSubscriber_ = std::make_shared<TranslationChatSubscriber>();

    peerChatSubscriber_->onOutgoingMessage = [this](pluginMessagePtr const& msg) {
        handleOutgoingMessage(msg);
    };

    // Initialize with the persisted global preference so the correct language is
    // used immediately (e.g. during announce() at startup, before any conversation
    // is opened and notifyChatSubject is called).
    std::map<std::string, std::string> prefs;
    api_->invokeService(api_, "getPluginPreferences", &prefs);
    if (const auto langIt = prefs.find("targetLanguage"); langIt != prefs.end()) {
        // Empty value means "auto-detect": use the system locale language.
        targetLanguage_ = langIt->second.empty() ? jamiAppLanguage() : langIt->second;
    }
    if (const auto it = prefs.find("translateIncoming"); it != prefs.end()) {
        translateIncoming_ = (it->second != "0");
    }
    if (const auto it = prefs.find("translateOutgoing"); it != prefs.end()) {
        translateOutgoing_ = (it->second == "1");
    }
    if (const auto it = prefs.find("sendTargetLanguage"); it != prefs.end()) {
        sendTargetLanguage_ = it->second.empty() ? jamiAppLanguage() : it->second;
    }

    // Discard any per-account overrides that were written to disk by
    // syncAccountDisplayPref and whose value equals the current resolved global.
    // Those values are display hints, not real user overrides, and should not
    // block future global-language changes from taking effect.
    if (prefHandler_) {
        prefHandler_->discardMatchingGlobalValues(targetLanguage_,
                                                  sendTargetLanguage_,
                                                  translateIncoming_.load(),
                                                  translateOutgoing_.load());
    }

    auto modelDir = datapath_ + sep + "models";
    translator_ = std::make_shared<Translator>(modelDir, targetLanguage_);
    setupWorker();
    loadCacheFromDisk();
}

void
TranslationChatHandler::syncAccountDisplayPref(
    const std::string& overrideKey,
    const std::string& value,
    const std::function<bool(const std::string&)>& hasOverride) const
{
    std::vector<std::string> accounts;
    api_->invokeService(api_, "getAccountIds", &accounts);
    for (const auto& accId : accounts) {
        if (!hasOverride(accId)) {
            std::tuple<std::string, std::string, std::string> d {accId, overrideKey, value};
            api_->invokeService(api_, "setPluginAccPreference", &d);
        }
    }
}

void
TranslationChatHandler::setupWorker()
{
    // Destroy the existing worker first (joins its thread; its destructor calls
    // translator_->terminate() to unblock any in-flight Run()).  After the join,
    // clear the terminate flag so subsequent Run() calls on the same Translator
    // object work normally.
    worker_.reset();
    if (!translator_) {
        return;
    }
    translator_->resetTerminate();
    // Always create the worker: if loading is still in progress waitReady() blocks
    // until done; if loading failed (model not found or ORT exception) waitReady()
    // returns false via loaderDone_ and the worker exits cleanly.
    worker_ = std::make_unique<TranslationWorker>(translator_,
                                                  [this](std::string translation,
                                                         std::string accountId,
                                                         std::string conversationId,
                                                         std::string messageId,
                                                         const std::string& cacheKey,
                                                         const bool isOwnMessage,
                                                         const bool isOutgoingSend) {
                                                      onTranslationComplete(std::move(translation),
                                                                            std::move(accountId),
                                                                            std::move(
                                                                                conversationId),
                                                                            std::move(messageId),
                                                                            cacheKey,
                                                                            isOwnMessage,
                                                                            isOutgoingSend);
                                                  });
}
#pragma endregion // Construction

#pragma region Worker callback
void
TranslationChatHandler::onTranslationComplete(std::string translation,
                                              std::string accountId,
                                              std::string conversationId,
                                              std::string messageId,
                                              const std::string& cacheKey,
                                              const bool isOwnMessage,
                                              const bool isOutgoingSend)
{
    // Store in cache (replaces in-progress sentinel with real translation).
    if (!isOutgoingSend) {
        std::lock_guard lk(cacheMutex_);
        translationCache_[cacheKey] = translation;
        saveCacheToDisk();
    }

    if (isOutgoingSend) {
        // Send-then-edit path: register the translated body as pending
        // (loop guard), then call editMessage to replace the original.
        PLOG(Plog::LogPriority::INFO,
             HANDLER_TAG,
             std::format("[send-translate] editing msgId={} translation=\"{}\"",
                         messageId,
                         truncLog(translation)));
        JamiMessage editReq {accountId,
                             conversationId,
                             false,
                             {{"body", translation}, {"edit", messageId}},
                             true};
        editReq.isSwarm = true;
        api_->invokeService(api_, "editMessage", &editReq);
        return;
    }

    // Normal receive-translate path (only non-own messages reach here).
    PLOG(Plog::LogPriority::INFO,
         HANDLER_TAG,
         std::format("[callback] msgId={} translation=\"{}\"", messageId, truncLog(translation)));
    if (!isOwnMessage) {
        PLOG(Plog::LogPriority::INFO, HANDLER_TAG, "[callback] invoking updateMessageBodyOverwrite");
        MessageBodyOverwriteUpdate upd {std::move(accountId),
                                        std::move(conversationId),
                                        std::move(messageId),
                                        std::move(translation)};
        api_->invokeService(api_, "updateMessageBodyOverwrite", &upd);
    }
}
#pragma endregion // Worker callback

#pragma region Cache
std::string
TranslationChatHandler::cacheFilePath() const
{
    return std::format("{}{}translation_cache.json", datapath_, sep);
}

std::string
TranslationChatHandler::getOrFetchOwnUri(const std::string& accountId)
{
    // Fast path: already cached — return under lock without touching the daemon.
    {
        std::lock_guard lk(ownUriMutex_);
        if (const auto it = ownUriCache_.find(accountId); it != ownUriCache_.end()) {
            return it->second;
        }
    }

    // Slow path: ask the daemon.  Done outside the lock so other threads can still
    // read ownUriCache_ while the service call is in flight.
    std::pair<std::string, std::string> uriQuery {accountId, {}};
    api_->invokeService(api_, "getAccountUri", &uriQuery);

    if (!uriQuery.second.empty()) {
        std::lock_guard lk(ownUriMutex_);
        // emplace is a no-op if another thread already inserted the same key while
        // we were in invokeService, which is harmless (both threads fetch the same URI).
        ownUriCache_.try_emplace(accountId, uriQuery.second);
        PLOG(Plog::LogPriority::INFO,
             HANDLER_TAG,
             std::format("[ownUri] resolved accountId={} → uri={}", accountId, uriQuery.second));
    } else {
        PLOG(Plog::LogPriority::WARN,
             HANDLER_TAG,
             std::format("[ownUri] getAccountUri returned empty for accountId={}", accountId));
    }
    return uriQuery.second;
}

void
TranslationChatHandler::loadCacheFromDisk()
{
    namespace fs = std::filesystem;
    const auto path = cacheFilePath();
    if (!fs::exists(path)) {
        return;
    }
    try {
        std::ifstream f(path);
        Json::Value j;
        Json::CharReaderBuilder rbuilder;
        rbuilder["collectComments"] = false;
        std::string errs;
        if (!Json::parseFromStream(rbuilder, f, &j, &errs) || !j.isObject()) {
            return;
        }
        for (const auto& key : j.getMemberNames()) {
            const auto& val = j[key];
            if (val.isString()) {
                translationCache_.try_emplace(key, val.asString());
            }
        }
        PLOG(Plog::LogPriority::INFO,
             HANDLER_TAG,
             std::format("Loaded {} cached translations from disk", translationCache_.size()));
    } catch (const std::exception& e) {
        PLOG(Plog::LogPriority::WARN,
             HANDLER_TAG,
             std::string("Failed to load translation cache: ") + e.what());
    }
}

void
TranslationChatHandler::saveCacheToDisk() const
{
    // Must be called while holding cacheMutex_.
    try {
        Json::Value j(Json::objectValue);
        for (const auto& [key, val] : translationCache_) {
            if (!val.empty()) {
                // skip in-progress sentinels
                j[key] = val;
            }
        }
        if (std::ofstream f(cacheFilePath(), std::ios::trunc); f) {
            Json::StreamWriterBuilder wbuilder;
            wbuilder["commentStyle"] = "None";
            wbuilder["indentation"] = "  ";
            f << Json::writeString(wbuilder, j);
        } else {
            PLOG(Plog::LogPriority::WARN,
                 HANDLER_TAG,
                 "Cannot open translation cache for writing: " + cacheFilePath());
        }
    } catch (const std::exception& e) {
        PLOG(Plog::LogPriority::WARN,
             HANDLER_TAG,
             std::string("Failed to save translation cache: ") + e.what());
    }
}
#pragma endregion // Cache

#pragma region Preferences
bool
TranslationChatHandler::preferenceMapHasKey(const std::string& key)
{
    return key == "targetLanguage" || key == "translateIncoming" || key == "translateOutgoing"
           || key == "targetLanguageOverride" || key == "translateIncomingOverride"
           || key == "translateOutgoingOverride" || key == "sendTargetLanguage"
           || key == "sendTargetLanguageOverride";
}

void
TranslationChatHandler::applyTranslateIncoming(const std::string& value)
{
    const bool newVal = (value != "0");
    if (const bool oldVal = translateIncoming_.exchange(newVal); oldVal != newVal) {
        if (!newVal) {
            api_->invokeService(api_, "clearBodyOverwritesAllConversations", nullptr);
        }
        api_->invokeService(api_, "reloadBodyOverwritesAllConversations", nullptr);
    }
    if (prefHandler_) {
        syncAccountDisplayPref("translateIncomingOverride", value, [this](const std::string& id) {
            return prefHandler_->hasTranslateIncomingOverride(id);
        });
    }
}

void
TranslationChatHandler::applyTranslateOutgoing(const std::string& value)
{
    translateOutgoing_ = (value == "1");
    PLOG(Plog::LogPriority::INFO,
         HANDLER_TAG,
         std::format("[pref] translateOutgoing={}", translateOutgoing_ ? "on" : "off"));
    if (prefHandler_) {
        syncAccountDisplayPref("translateOutgoingOverride", value, [this](const std::string& id) {
            return prefHandler_->hasOutgoingOverride(id);
        });
    }
}

void
TranslationChatHandler::applyTargetLanguage(const std::string& value)
{
    // Empty means "auto-detect" — resolve to actual language code.
    const auto resolved = value.empty() ? jamiAppLanguage() : value;
    {
        std::lock_guard lk(langMutex_);
        if (resolved == targetLanguage_) {
            return;
        }
        targetLanguage_ = resolved;
    }
    // Discard pending jobs for the old language and rebuild the worker.
    // Do NOT clear translationCache_: entries for the old language are keyed with
    // the old language token and won't match new lookups. Entries for the new
    // language (loaded from disk at startup) remain immediately usable.
    if (worker_) {
        worker_->drainQueue();
    }
    setupWorker();
    // Set the language AFTER the old worker is joined (setupWorker joins it).
    // Setting targetToken_/targetLangId_ while the old worker was still running
    // translate() would be a data race; the worker also sets the language per-job.
    if (translator_) {
        translator_->setTargetLanguage(resolved);
    }
    // Ask the daemon to retranslate all loaded messages with the new language.
    api_->invokeService(api_, "reloadBodyOverwritesAllConversations", nullptr);
    if (prefHandler_) {
        syncAccountDisplayPref("targetLanguageOverride", resolved, [this](const std::string& id) {
            return prefHandler_->hasLangOverride(id);
        });
    }
}

void
TranslationChatHandler::applySendTargetLanguage(const std::string& value)
{
    std::string newLang;
    {
        std::lock_guard lk(langMutex_);
        sendTargetLanguage_ = value.empty() ? jamiAppLanguage() : value;
        newLang = sendTargetLanguage_;
    }
    PLOG(Plog::LogPriority::INFO, HANDLER_TAG, "[pref] sendTargetLanguage={}", newLang);
    if (prefHandler_) {
        syncAccountDisplayPref("sendTargetLanguageOverride", newLang, [this](const std::string& id) {
            return prefHandler_->hasSendTargetLangOverride(id);
        });
    }
}

void
TranslationChatHandler::setPreferenceAttribute(const std::string& key, const std::string& value)
{
    try {
        if (key == "translateIncoming") {
            applyTranslateIncoming(value);
        } else if (key == "translateOutgoing") {
            applyTranslateOutgoing(value);
        } else if (key == "targetLanguage") {
            applyTargetLanguage(value);
        } else if (key == "targetLanguageOverride") {
            // Per-account override: TranslationPreferenceHandler already updated its
            // in-memory state. Just trigger a reload so conversations pick up the new language.
            api_->invokeService(api_, "reloadBodyOverwritesAllConversations", nullptr);
        } else if (key == "translateIncomingOverride") {
            // Per-account override for incoming translation; trigger a full retranslate.
            api_->invokeService(api_, "clearBodyOverwritesAllConversations", nullptr);
            api_->invokeService(api_, "reloadBodyOverwritesAllConversations", nullptr);
        } else if (key == "sendTargetLanguage") {
            applySendTargetLanguage(value);
        }
        // translateOutgoingOverride, sendTargetLanguageOverride: state already updated by
        // PreferenceHandler before this call; no further action needed.
    } catch (const std::exception& e) {
        PLOG(Plog::LogPriority::ERR,
             HANDLER_TAG,
             "setPreferenceAttribute error: " + std::string(e.what()));
    } catch (...) {
        PLOG(Plog::LogPriority::ERR, HANDLER_TAG, "setPreferenceAttribute unknown error");
    }
}

std::string
TranslationChatHandler::getTargetLanguage(const std::string& accountId) const
{
    // Per-account override from conversation menu takes priority.
    if (prefHandler_) {
        if (const auto langOverride = prefHandler_->getLangOverride(accountId);
            !langOverride.empty()) {
            return langOverride;
        }
    }
    // Fall back to the global plugin setting (always up to date in memory).
    std::lock_guard lk(langMutex_);
    return targetLanguage_;
}

bool
TranslationChatHandler::getTranslateIncoming(const std::string& accountId) const
{
    if (prefHandler_) {
        if (const int ov = prefHandler_->getTranslateIncomingOverride(accountId); ov != -1) {
            return ov == 1;
        }
    }
    return translateIncoming_.load();
}

bool
TranslationChatHandler::getTranslateOutgoing(const std::string& accountId) const
{
    if (prefHandler_) {
        if (const int ov = prefHandler_->getOutgoingOverride(accountId); ov != -1) {
            return ov == 1;
        }
    }
    return translateOutgoing_.load();
}

std::string
TranslationChatHandler::getSendTargetLanguage(const std::string& accountId) const
{
    if (prefHandler_) {
        if (const auto ov = prefHandler_->getSendTargetLangOverride(accountId); !ov.empty()) {
            return ov;
        }
    }
    std::lock_guard lk(langMutex_);
    return sendTargetLanguage_;
}
#pragma endregion // Preferences

#pragma region Message handling
void
TranslationChatHandler::handleOutgoingMessage(pluginMessagePtr const& message)
{
    if (!message || !translator_ || !worker_) {
        return;
    }
    if (!getTranslateOutgoing(message->accountId)) {
        return;
    }

    // Edits: ignore (V1: no edit handling).
    if (message->data.contains("edit")) {
        return;
    }

    // Only handle plain text messages.
    if (const auto typeIt = message->data.find("type");
        typeIt == message->data.end() || typeIt->second != "text/plain") {
        return;
    }

    const auto bodyIt = message->data.find("body");
    const auto idIt = message->data.find("id");
    if (bodyIt == message->data.end() || bodyIt->second.empty()) {
        return;
    }
    if (idIt == message->data.end() || idIt->second.empty()) {
        return;
    }

    const auto& body = bodyIt->second;
    const auto& msgId = idIt->second;
    const auto& accountId = message->accountId;
    const auto& conversationId = message->peerId;
    const auto lang = getSendTargetLanguage(accountId);

    // Build a cache key scoped to this send-translate job (separate from receiver keys).
    const auto cacheKey = std::format("{}\x1F{}\x1Fsend\x1F{}", accountId, msgId, lang);

    PLOG(Plog::LogPriority::INFO,
         HANDLER_TAG,
         "[send-translate] enqueuing msgId=" + msgId + " body=\"" + truncLog(body)
             + "\" lang=" + lang);

    TranslationWorker::Job job;
    job.text = body;
    job.accountId = accountId;
    job.conversationId = conversationId;
    job.messageId = msgId;
    job.cacheKey = cacheKey;
    job.targetLang = lang;
    job.isOwnMessage = true;
    job.isOutgoingSend = true;
    worker_->enqueue(std::move(job));
}

void
TranslationChatHandler::evictCacheIfNeeded()
{
    for (auto it = translationCache_.begin();
         it != translationCache_.end() && translationCache_.size() >= MAX_CACHE_ENTRIES;) {
        if (!it->second.empty()) {
            it = translationCache_.erase(it);
        } else {
            ++it;
        }
    }
}

void
TranslationChatHandler::processSwarmMessage(libjami::SwarmMessage& msg,
                                            const std::string_view ownUri,
                                            const std::string& lang,
                                            const std::string& accountId,
                                            const std::string& conversationId,
                                            std::vector<TranslationWorker::Job>& toEnqueue)
{
    if (msg.type != "text/plain") {
        // Signal to the daemon that this message will never be translated so it
        // won't be re-batched on future loadMissingBodyOverwrites calls.
        msg.pluginData["bodyOverwrite"] = "";
        return;
    }
    auto body = msg.body;
    if (!msg.editions.empty()) {
        const auto it = std::ranges::find_if(msg.editions, [&msg](const auto& edition) {
            return edition.at("id") == msg.id;
        });
        if (it != msg.editions.end()) {
            body = *it;
        }
    }

    const auto bodyIt = body.find("body");
    if (bodyIt == body.end() || bodyIt->second.empty()) {
        msg.pluginData["bodyOverwrite"] = "";
        return;
    }

    // Determine whether this message is authored by the local user.
    bool isOwn = false;
    if (!ownUri.empty()) {
        if (const auto authIt = msg.body.find("author"); authIt != msg.body.end()) {
            isOwn = (authIt->second == ownUri);
        }
    }
    // Skip own messages in the receive-translate path:
    //   - When send-translate is on: handled by handleOutgoingMessage instead.
    //   - When send-translate is off: we don't show incoming translations for own messages.
    if (isOwn) {
        msg.pluginData["bodyOverwrite"] = "";
        return;
    }

    // Include accountId: accountId keeps each
    // account's translation state independent (a sender's isOwn=true sentinel
    // must not prevent the receiver's account from enqueuing its own job).
    auto mainKey = std::format("{}\x1F{}\x1F{}", accountId, msg.id, lang);
    if (const auto mainIt = translationCache_.find(mainKey); mainIt != translationCache_.end()) {
        if (!mainIt->second.empty()) {
            msg.pluginData["bodyOverwrite"] = mainIt->second;
        }
    } else {
        translationCache_[mainKey] = "";
        PLOG(Plog::LogPriority::INFO,
             HANDLER_TAG,
             std::format("[translate async] \"{}\"", truncLog(bodyIt->second)));
        toEnqueue.emplace_back(bodyIt->second,
                               accountId,
                               conversationId,
                               msg.id,
                               std::move(mainKey),
                               lang,
                               isOwn);
    }
}

void
TranslationChatHandler::transformSwarmMessages(
    std::vector<libjami::SwarmMessage>& messages,
    const std::string& accountId,
    const std::string& conversationId)
{
    if (!translator_ || !worker_) {
        return;
    }
    // Only translate messages for conversations this handler is attached to.
    if (!attachedConversations_.contains({accountId, conversationId})) {
        return;
    }
    // If incoming translation is disabled, leave all messages untranslated.
    if (!getTranslateIncoming(accountId)) {
        return;
    }

    // Wrap the entire body: this function is called synchronously from the daemon via
    // the plugin C API boundary.  Any uncaught exception (including bad_alloc from cache
    // insertions or job-queue pushes with a large conversation history) would propagate
    // through the daemon's noexcept code and call std::terminate.
    try {
        // Resolve the effective language for this account: per-account override (in-memory,
        // never stale) takes priority over the global targetLanguage_.
        const auto lang = getTargetLanguage(accountId);

        // Collect jobs to enqueue outside the cache lock to avoid lock inversion.
        std::vector<TranslationWorker::Job> toEnqueue;
        {
            // Always resolve the account's own URI: own messages are skipped in the
            // receive-translate path (send-translate handles them via handleOutgoingMessage).
            const std::string ownUri = getOrFetchOwnUri(accountId);
            std::lock_guard lk(cacheMutex_);
            // Evict completed entries when the cache exceeds the limit so it
            // does not grow without bound over a long-running session.
            if (translationCache_.size() >= MAX_CACHE_ENTRIES) {
                evictCacheIfNeeded();
            }
            for (auto& msg : messages) {
                processSwarmMessage(msg, ownUri, lang, accountId, conversationId, toEnqueue);
            }
        }
        for (auto& job : toEnqueue) {
            worker_->enqueue(std::move(job));
        }
    } catch (const std::exception& e) {
        PLOG(Plog::LogPriority::ERR,
             HANDLER_TAG,
             std::string("transformSwarmMessages error: ") + e.what());
    } catch (...) {
        PLOG(Plog::LogPriority::ERR, HANDLER_TAG, "transformSwarmMessages unknown error");
    }
}
#pragma endregion // Message handling

#pragma region Chat handler interface
void
TranslationChatHandler::notifyChatSubject(std::pair<std::string, std::string>& subjectConnection,
                                          const chatSubjectPtr subject)
{
    try {
        if (peerChatSubscriber_ && !subjects.contains(subject)) {
            subject->attach(peerChatSubscriber_.get());
            subjects.insert(subject);
            subjectToConnection_[subject] = subjectConnection;
            attachedConversations_.insert(subjectConnection);

            const auto str
                = std::format("=== conversation opened ===\n  account : {}\n  peer    : {}",
                              subjectConnection.first,
                              subjectConnection.second);
            PLOG(Plog::LogPriority::INFO, HANDLER_TAG, str);

            // Eagerly learn the account's own URI so we can filter self-authored
            // messages before any real-time message arrives.
            getOrFetchOwnUri(subjectConnection.first);

            // Reset any empty-string sentinels that a prior loadMissingBodyOverwrites
            // call (with no active handler) may have written.  Those sentinels cause
            // loadMissingBodyOverwrites to skip every message (pluginData.contains
            // "bodyOverwrite" → true), so no jobs are ever enqueued after attach.
            api_->invokeService(api_, "clearBodyOverwrites", &subjectConnection);
        }

        // Translate messages already loaded in this conversation only.
        // Using the scoped service avoids triggering retranslation of unrelated conversations.
        api_->invokeService(api_, "loadMissingBodyOverwrites", &subjectConnection);
    } catch (const std::exception& e) {
        PLOG(Plog::LogPriority::ERR,
             HANDLER_TAG,
             std::string("notifyChatSubject error: ") + e.what());
    } catch (...) {
        PLOG(Plog::LogPriority::ERR, HANDLER_TAG, "notifyChatSubject unknown error");
    }
}

std::map<std::string, std::string>
TranslationChatHandler::getChatHandlerDetails()
{
    return {{"name", HANDLER_TAG}, {"iconPath", datapath_ + sep + "icon.svg"}, {"pluginId", id()}};
}

void
TranslationChatHandler::detach(const chatSubjectPtr subject)
{
    try {
        if (const auto subjIt = subjects.find(subject); subjIt != subjects.end()) {
            // Stop queued jobs so we don't push translations after clearing.
            if (worker_) {
                worker_->drainQueue();
            }
            {
                std::lock_guard lk(cacheMutex_);
                saveCacheToDisk();
            }

            subject->detach(peerChatSubscriber_.get());
            subjects.erase(subjIt);

            // Look up the connection for this subject, then clean up tracking state and
            // clear translations only for this conversation (not all conversations).
            if (const auto connIt = subjectToConnection_.find(subject);
                connIt != subjectToConnection_.end()) {
                auto connection = connIt->second;
                attachedConversations_.erase(connection);
                subjectToConnection_.erase(connIt);
                api_->invokeService(api_, "clearBodyOverwrites", &connection);
                PLOG(Plog::LogPriority::INFO, HANDLER_TAG, "Clearing body overwrites for {} - {}", connection.first, connection.second);
            }
        }
    } catch (const std::exception& e) {
        PLOG(Plog::LogPriority::ERR, HANDLER_TAG, "detach error: {}", e.what());
    } catch (...) {
        PLOG(Plog::LogPriority::ERR, HANDLER_TAG, "detach unknown error");
    }
}

TranslationChatHandler::~TranslationChatHandler()
{
    // 1. Stop worker thread: drain pending jobs then join the thread so no
    //    more callbacks can fire into the API or touch the translator.
    if (worker_) {
        worker_->drainQueue();
    }
    worker_.reset(); // joins thread; also releases worker's shared_ptr<Translator>

    // 2. Explicitly release ORT sessions now, while the process is still in a
    //    reasonable state.  translator_->~Translator() resets each session in a
    //    try/catch, so CUDA-driver-is-shutting-down errors are swallowed rather
    //    than propagating out of a destructor and calling std::terminate.
    translator_.reset();

    for (const auto& subject : subjects) {
        subject->detach(peerChatSubscriber_.get());
    }
    subjects.clear();
}
#pragma endregion // Chat handler interface
} // namespace jami
