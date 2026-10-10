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

#include "WatermarkVideoSubscriber.h"

#include "plugin/jamiplugin.h"
#include "plugin/mediahandler.h"

using avSubjectPtr = std::weak_ptr<jami::Observable<AVFrame*>>;

namespace jami {
class PluginPreferenceHandler;

class WatermarkMediaHandler : public jami::CallMediaHandler
{
public:
    WatermarkMediaHandler(std::string&& dataPath, PluginPreferenceHandler* prefHandler);
    ~WatermarkMediaHandler();

    void notifyAVFrameSubject(const StreamData& data, avSubjectPtr subject) override;
    std::map<std::string, std::string> getCallMediaHandlerDetails() override;

    void detach() override;
    void setPreferenceAttribute(const std::string& key, const std::string& value) override {}
    bool preferenceMapHasKey(const std::string& key) override { return false; }

    std::shared_ptr<WatermarkVideoSubscriber> mediaSubscriber_;
    void setParameters(const std::string& accountId);

private:
    std::string accountId_ {"default"};
    const std::string datapath_;
    PluginPreferenceHandler* aph_;
    std::string attached_ {'0'};
};
} // namespace jami
