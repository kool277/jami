/**
 *  Copyright (C) 2022 Savoir-faire Linux Inc.
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

#include "TranscriptAudioSubscriber.h"
#include "TranscriptVideoSubscriber.h"

#include "PluginPreferenceHandler.h"

#include "plugin/jamiplugin.h"
#include "plugin/mediahandler.h"

namespace jami {

class TranscriptMediaHandler : public CallMediaHandler
{
public:
    TranscriptMediaHandler(std::string&& dataPath, PluginPreferenceHandler* prefHandler);
    ~TranscriptMediaHandler();

    virtual void notifyAVFrameSubject(const StreamData& data, avSubjectPtr subject) override;
    virtual std::map<std::string, std::string> getCallMediaHandlerDetails() override;

    virtual void detach() override;
    virtual void setPreferenceAttribute(const std::string& key, const std::string& value) override {}
    virtual bool preferenceMapHasKey(const std::string& key) override { return false; }

    void writeToFile(const std::string& text);
    void setParameters(const std::string& accountId);

    std::shared_ptr<TranscriptAudioSubscriber> audioSubscriber_;
    std::shared_ptr<TranscriptVideoSubscriber> videoSubscriber_;

private:
    std::vector<bool> attached_ = {false, false};
    std::string dateTime(time_t time);
    std::string accountId_ {"default"};
    const std::string datapath_;
    PluginPreferenceHandler* aph_;
    std::string modelpath;
    std::string previousModel;
    std::string transcriptPath_;
    std::ofstream outputFile_;
    bool trancriptFile;
    bool firstRun = true;
};
} // namespace jami
