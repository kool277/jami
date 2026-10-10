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

#include "plugin/preferencehandler.h"
#include "plugin/jamiplugin.h"

#include <mutex>
#include <string>
#include <unordered_map>

namespace jami {
    /**
     * Handles per-account language overrides ("targetLanguageOverride").
     * Stores overrides in memory; initialized from the daemon's per-account
     * preference storage on startup so overrides survive restarts.
     */
    class TranslationPreferenceHandler : public PreferenceHandler {
    public:
        TranslationPreferenceHandler(const JAMI_PluginAPI *api, std::string dataPath);

        std::map<std::string, std::string> getHandlerDetails() override;

        void setPreferenceAttribute(const std::string &accountId,
                                    const std::string &key,
                                    const std::string &value) override;

        bool preferenceMapHasKey(const std::string &key) override;

        void resetPreferenceAttributes(const std::string &accountId) override;

        // Returns the stored per-account language override, or "" if none is set.
        std::string getLangOverride(const std::string &accountId) const;

        // Returns the per-account incoming-translation override:
        //   -1 → use global setting   0 → force OFF   1 → force ON
        int getTranslateIncomingOverride(const std::string &accountId) const;

        // Returns the per-account outgoing-translation (send-translate) override:
        //   -1 → use global setting   0 → force OFF   1 → force ON
        int getOutgoingOverride(const std::string &accountId) const;

        // Returns the per-account send target language override, or "" if none is set.
        std::string getSendTargetLangOverride(const std::string &accountId) const;

        // Returns true if the account has a user-set override (not inherited from global).
        bool hasLangOverride(const std::string &accountId) const;

        bool hasTranslateIncomingOverride(const std::string &accountId) const;

        bool hasOutgoingOverride(const std::string &accountId) const;

        bool hasSendTargetLangOverride(const std::string &accountId) const;

        // Removes any in-memory per-account override whose value exactly matches the
        // corresponding resolved global value.  Call once at startup (after the
        // TranslationChatHandler has resolved its global settings) to discard values
        // that were written to disk by syncAccountDisplayPref and are not real
        // user-set overrides.
        void discardMatchingGlobalValues(std::string_view globalLang,
                                         std::string_view globalSendLang,
                                         bool globalIncoming,
                                         bool globalOutgoing);

    private:
        const JAMI_PluginAPI *api_;
        const std::string datapath_;

        mutable std::mutex mutex_;
        // accountId → language code; absent or empty means "use the global default"
        std::unordered_map<std::string, std::string> langOverrides_;
        // accountId → 0 (off) / 1 (on); absent means "use global setting" (-1)
        std::unordered_map<std::string, int> translateIncomingOverrides_;
        // accountId → 0 (off) / 1 (on); absent means "use global setting" (-1)
        std::unordered_map<std::string, int> outgoingOverrides_;
        // accountId → language code for outgoing translation override
        std::unordered_map<std::string, std::string> sendTargetLangOverrides_;
    };
} // namespace jami
