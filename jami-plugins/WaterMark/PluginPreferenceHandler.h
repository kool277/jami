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

#pragma once

#include "plugin/jamiplugin.h"
#include "plugin/preferencehandler.h"

#include <string>
#include <map>
#include <memory>
#include <set>
#include <mutex>

namespace jami {
class WatermarkMediaHandler;

class PluginPreferenceHandler : public jami::PreferenceHandler
{
public:
    PluginPreferenceHandler(const JAMI_PluginAPI* api,
                            std::map<std::string, std::map<std::string, std::string>>&& preferences,
                            const std::string& dataPath);
    ~PluginPreferenceHandler();

    std::map<std::string, std::string> getHandlerDetails() override;
    bool preferenceMapHasKey(const std::string& key) override;
    void setPreferenceAttribute(const std::string& accountId,
                                const std::string& key,
                                const std::string& value) override;
    void resetPreferenceAttributes(const std::string& accountId) override;

    std::map<std::string, std::string> getPreferences(const std::string& accountId);
    void setWaterMarkHandler(WatermarkMediaHandler* handler);

private:
    const JAMI_PluginAPI* api_;
    WatermarkMediaHandler* wmh_;
    const std::string datapath_;
    std::map<std::string, std::map<std::string, std::string>> preferences_;
    std::mutex mtx_;
};
} // namespace jami
