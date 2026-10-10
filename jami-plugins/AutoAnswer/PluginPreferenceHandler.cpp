/**
 *  Copyright (C) 2021 Savoir-faire Linux Inc.
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

#include "PluginPreferenceHandler.h"

#include "pluglog.h"

const char sep = separator();
const std::string TAG = "BotAcc";

#define NAME "BotAcc"

namespace jami {

PluginPreferenceHandler::PluginPreferenceHandler(
    const JAMI_PluginAPI* api,
    std::map<std::string, std::map<std::string, std::string>>&& preferences,
    const std::string& dataPath)
    : api_ {api}
    , datapath_ {dataPath}
{
    preferences_ = preferences;
    setId(datapath_);
};

std::map<std::string, std::string>
PluginPreferenceHandler::getHandlerDetails()
{
    return {{"name", NAME}, {"iconPath", datapath_ + sep + "icon.svg"}, {"pluginId", id()}};
}

void
PluginPreferenceHandler::setPreferenceAttribute(const std::string& accountId,
                                             const std::string& key,
                                             const std::string& value)
{
    if (accountId.empty()) {
        for (auto& prefMap : preferences_) {
            auto it = prefMap.second.find(key);
            if (it != prefMap.second.end() && it->second != value) {
                it->second = value;
            }
        }
    } else {
        auto accIt = preferences_.find("default");
        accIt = preferences_.emplace(accountId, preferences_["default"]).first;
        auto it = accIt->second.find(key);
        if (it != accIt->second.end() && it->second != value) {
            it->second = value;
        }
    }
}

void
PluginPreferenceHandler::resetPreferenceAttributes(const std::string& accountId)
{
    std::lock_guard<std::mutex> lk(mtx_);
    if (accountId.empty()) {
        preferences_.clear();
        api_->invokeService(api_, "getPluginAccPreferences", &preferences_);
    } else
        preferences_[accountId] = preferences_["default"];
}

bool
PluginPreferenceHandler::preferenceMapHasKey(const std::string& key)
{
    return key == "answer" || key == "inText";
}

std::string
PluginPreferenceHandler::getPreferences(const std::string& accountId, const std::string& key)
{
    std::lock_guard<std::mutex> lk(mtx_);
    auto accIt = preferences_.emplace(accountId, preferences_["default"]).first;
    auto valueIt = accIt->second.find(key);
    if (valueIt != accIt->second.end()) {
        return valueIt->second;
    }
    return "";
}

PluginPreferenceHandler::~PluginPreferenceHandler()
{
    preferences_.clear();
}
} // namespace jami
