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

extern "C" {
#include <libavutil/frame.h>
}

#include <observer.h>

#include <frameFilter.h>
#include "PluginPreferenceHandler.h"

namespace jami {

class TranscriptVideoSubscriber : public Observer<AVFrame*>
{
public:
    TranscriptVideoSubscriber(const std::string& dataPath);
    ~TranscriptVideoSubscriber();

    virtual void update(Observable<AVFrame*>*, AVFrame* const&) override;
    virtual void attached(Observable<AVFrame*>*) override;
    virtual void detached(Observable<AVFrame*>*) override;

    void detach();

    void setText(const std::string& text);
    void setFilterDescription();

    void setParameter(std::string& parameter, Parameter type);

private:
    // Observer pattern
    Observable<AVFrame*>* observable_{};

    // Filter for video formatting
    std::string filterDescription_;
    FrameFilter filter_;
    std::string subtitle_ {"No subtitle fetched."};
    std::string fontFile_;
    AVRational sourceTimeBase_;
    int angle_ {0};
    std::map<int, std::string> rotation = {{-90, "-PI/2"},
                                           {90, "PI/2"},
                                           {-180, "-PI"},
                                           {180, "PI"},
                                           {0, "0"}};

    // Data
    std::string path_;

    // Status variables of the processing
    bool firstRun {true};

    std::pair<int, int> pluginFrameSize_ {0, 0};
    std::pair<int, int> point_;
    std::string fontSize_, background_, fontColor_, fontBackground_, position_;
    int maxWordsLength = 12;
};
} // namespace jami
