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

#include "TranslationPreferenceHandler.h"

#include <utility>
#include "pluglog.h"
#include "translatelog.h"
#include "plugin/streamdata.h"

constexpr auto PH_TAG = "TranslateMessages";

namespace jami {
#pragma region Construction
TranslationPreferenceHandler::TranslationPreferenceHandler(const JAMI_PluginAPI* api,
                                                           std::string dataPath)
    : api_(api)
    , datapath_(std::move(dataPath))
{
    setId(datapath_);

    // Restore per-account overrides saved in previous sessions.
    std::map<std::string, std::map<std::string, std::string>> accPrefs;
    if (api_) {
        api_->invokeService(api_, "getPluginAccPreferences", &accPrefs);
    }
    for (const auto& [accId, prefs] : accPrefs) {
        if (auto langIt = prefs.find("targetLanguageOverride");
            langIt != prefs.end() && !langIt->second.empty()) {
            langOverrides_[accId] = langIt->second;
        }

        if (auto inIt = prefs.find("translateIncomingOverride");
            inIt != prefs.end() && !inIt->second.empty()) {
            if (inIt->second == "1") {
                translateIncomingOverrides_[accId] = 1;
            } else if (inIt->second == "0") {
                translateIncomingOverrides_[accId] = 0;
            }
        }

        if (auto outIt = prefs.find("translateOutgoingOverride");
            outIt != prefs.end() && !outIt->second.empty()) {
            if (outIt->second == "1") {
                outgoingOverrides_[accId] = 1;
            } else if (outIt->second == "0") {
                outgoingOverrides_[accId] = 0;
            }
        }

        if (auto slIt = prefs.find("sendTargetLanguageOverride");
            slIt != prefs.end() && !slIt->second.empty()) {
            sendTargetLangOverrides_[accId] = slIt->second;
        }
    }
    PLOG(Plog::LogPriority::INFO,
         PH_TAG,
         "PreferenceHandler loaded {} per-account language override(s), {} incoming override(s), "
         "{} outgoing override(s)",
         langOverrides_.size(),
         translateIncomingOverrides_.size(),
         outgoingOverrides_.size());
}
#pragma endregion // Construction

#pragma region Preference handler interface
std::map<std::string, std::string>
TranslationPreferenceHandler::getHandlerDetails()
{
    return {{"name", "TranslateMessages"},
            {"iconPath", std::format("{}{}icon.svg", datapath_, sep)},
            {"backgroundPath", std::format("{}{}background.svg", datapath_, sep)},
            {"pluginId", id()}};
}

void
TranslationPreferenceHandler::setPreferenceAttribute(const std::string& accountId,
                                                     const std::string& key,
                                                     const std::string& value)
{
    const std::string displayVal = value.empty() ? "(global)" : value;
    if (key == "targetLanguageOverride") {
        std::lock_guard lk(mutex_);
        if (value.empty()) {
            langOverrides_.erase(accountId);
        } else {
            langOverrides_[accountId] = value;
        }
        PLOG(Plog::LogPriority::INFO,
             PH_TAG,
             "[pref] account={} targetLanguageOverride={}",
             accountId,
             displayVal);
    } else if (key == "translateIncomingOverride") {
        std::lock_guard lk(mutex_);
        if (value == "1") {
            translateIncomingOverrides_[accountId] = 1;
        } else if (value == "0") {
            translateIncomingOverrides_[accountId] = 0;
        } else {
            translateIncomingOverrides_.erase(accountId);
        }
        PLOG(Plog::LogPriority::INFO,
             PH_TAG,
             "[pref] account={} translateIncomingOverride={}",
             accountId,
             displayVal);
    } else if (key == "translateOutgoingOverride") {
        std::lock_guard lk(mutex_);
        if (value == "1") {
            outgoingOverrides_[accountId] = 1;
        } else if (value == "0") {
            outgoingOverrides_[accountId] = 0;
        } else {
            outgoingOverrides_.erase(accountId);
        }
        PLOG(Plog::LogPriority::INFO,
             PH_TAG,
             "[pref] account={} translateOutgoingOverride={}",
             accountId,
             displayVal);
    } else if (key == "sendTargetLanguageOverride") {
        std::lock_guard lk(mutex_);
        if (value.empty()) {
            sendTargetLangOverrides_.erase(accountId);
        } else {
            sendTargetLangOverrides_[accountId] = value;
        }
        PLOG(Plog::LogPriority::INFO,
             PH_TAG,
             "[pref] account={} sendTargetLanguageOverride={}",
             accountId,
             displayVal);
    }
}

bool
TranslationPreferenceHandler::preferenceMapHasKey(const std::string& key)
{
    return key == "targetLanguageOverride" || key == "translateIncomingOverride"
           || key == "translateOutgoingOverride" || key == "sendTargetLanguageOverride";
}

void
TranslationPreferenceHandler::resetPreferenceAttributes(const std::string& accountId)
{
    {
        std::lock_guard lk(mutex_);
        if (accountId.empty()) {
            langOverrides_.clear();
            translateIncomingOverrides_.clear();
            outgoingOverrides_.clear();
            sendTargetLangOverrides_.clear();
        } else {
            langOverrides_.erase(accountId);
            translateIncomingOverrides_.erase(accountId);
            outgoingOverrides_.erase(accountId);
            sendTargetLangOverrides_.erase(accountId);
        }
    }
    // Retranslate so the UI reflects the restored global language.
    if (api_) {
        api_->invokeService(api_, "reloadBodyOverwritesAllConversations", nullptr);
    }
}
#pragma endregion // Preference handler interface

#pragma region Override accessors
std::string
TranslationPreferenceHandler::getLangOverride(const std::string& accountId) const
{
    std::lock_guard lk(mutex_);
    const auto it = langOverrides_.find(accountId);
    return it != langOverrides_.end() ? it->second : "";
}

int
TranslationPreferenceHandler::getOutgoingOverride(const std::string& accountId) const
{
    std::lock_guard lk(mutex_);
    const auto it = outgoingOverrides_.find(accountId);
    return it != outgoingOverrides_.end() ? it->second : -1; // -1 = use global setting
}

int
TranslationPreferenceHandler::getTranslateIncomingOverride(const std::string& accountId) const
{
    std::lock_guard lk(mutex_);
    const auto it = translateIncomingOverrides_.find(accountId);
    return it != translateIncomingOverrides_.end() ? it->second : -1;
}

std::string
TranslationPreferenceHandler::getSendTargetLangOverride(const std::string& accountId) const
{
    std::lock_guard lk(mutex_);
    const auto it = sendTargetLangOverrides_.find(accountId);
    return it != sendTargetLangOverrides_.end() ? it->second : "";
}

bool
TranslationPreferenceHandler::hasLangOverride(const std::string& accountId) const
{
    std::lock_guard lk(mutex_);
    return langOverrides_.contains(accountId);
}

bool
TranslationPreferenceHandler::hasTranslateIncomingOverride(const std::string& accountId) const
{
    std::lock_guard lk(mutex_);
    return translateIncomingOverrides_.contains(accountId);
}

bool
TranslationPreferenceHandler::hasOutgoingOverride(const std::string& accountId) const
{
    std::lock_guard lk(mutex_);
    return outgoingOverrides_.contains(accountId);
}

bool
TranslationPreferenceHandler::hasSendTargetLangOverride(const std::string& accountId) const
{
    std::lock_guard lk(mutex_);
    return sendTargetLangOverrides_.contains(accountId);
}
#pragma endregion // Override accessors

#pragma region Cleanup
void
TranslationPreferenceHandler::discardMatchingGlobalValues(const std::string_view globalLang,
                                                          const std::string_view globalSendLang,
                                                          const bool globalIncoming,
                                                          const bool globalOutgoing)
{
    std::lock_guard lk(mutex_);
    for (auto it = langOverrides_.begin(); it != langOverrides_.end();) {
        it = (it->second == globalLang) ? langOverrides_.erase(it) : std::next(it);
    }
    for (auto it = sendTargetLangOverrides_.begin(); it != sendTargetLangOverrides_.end();) {
        it = (it->second == globalSendLang) ? sendTargetLangOverrides_.erase(it) : std::next(it);
    }
    const int incomingVal = globalIncoming ? 1 : 0;
    for (auto it = translateIncomingOverrides_.begin(); it != translateIncomingOverrides_.end();) {
        it = (it->second == incomingVal) ? translateIncomingOverrides_.erase(it) : std::next(it);
    }
    const int outgoingVal = globalOutgoing ? 1 : 0;
    for (auto it = outgoingOverrides_.begin(); it != outgoingOverrides_.end();) {
        it = (it->second == outgoingVal) ? outgoingOverrides_.erase(it) : std::next(it);
    }
}
#pragma endregion // Cleanup
} // namespace jami
