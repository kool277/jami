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

extern "C" {
#include <libavutil/frame.h>
}
#include <observer.h>
#include <frameUtils.h>
#include <frameFilter.h>
#include <map>
#include <array>

namespace jami {

enum Parameter {
    TIME,
    DATE,
    TIMEFORMAT,
    DATEFORMAT,
    LOGOPATH,
    SHOWLOGO,
    LOCATION,
    LOGOPOSITION,
    INFOSPOSITION,
    LOGOBACKGROUND,
    FONTSIZE,
    TIMEZONE,
    LOGOSIZE,
    SHOWINFOS,
};

class WatermarkVideoSubscriber : public Observer<AVFrame*>
{
public:
    WatermarkVideoSubscriber(const std::string& dataPath);
    ~WatermarkVideoSubscriber();

    virtual void update(Observable<AVFrame*>*, AVFrame* const&) override;
    virtual void attached(Observable<AVFrame*>*) override;
    virtual void detached(Observable<AVFrame*>*) override;

    void detach();

    MediaStream getLogoAVFrameInfos();
    void loadMarkLogo();
    void setFilterDescription();

    void setParameter(std::string& parameter, Parameter type);

private:
    void setMarkPosition();

    Observable<AVFrame*>* observable_ {};
    bool firstRun {true};
    std::mutex mtx_;
    int angle_ {0};

    std::pair<int, int> pluginFrameSize_ {0, 0};
    std::string infosposition_ = "1";
    std::string logoposition_ = "1";
    std::array<std::pair<int, int>, 2> points_;
    std::string logoPath_ = "";
    std::string backgroundColor_ = "black@0.0";
    bool showLogo_ {false};
    bool validLogo_ {true};
    std::string logoSize_ = "0.1";
    std::unique_ptr<AVFormatContext, std::function<void(AVFormatContext*)>> pFormatCtx_
        = {avformat_alloc_context(), [](AVFormatContext* ptr) {
               avformat_close_input(&ptr);
               avformat_free_context(ptr);
           }};
    int videoStream_ {-1};
    bool showInfos_ {true};
    std::string location_;
    bool date_ {false};
    bool time_ {false};
    bool timeZone_ {false};
    std::string dateFormat_ = "";
    std::string timeFormat_ = "";
    std::string fontFile_;
    AVRational sourceTimeBase_;

    FrameFilter pluginFilter_;
    std::string pluginFilterDescription_;
    MediaStream pluginstream_;
    FrameFilter logoFilter_;
    MediaStream logoStream_;
    std::string logoDescription_;
    uniqueFramePtr mark_ = getUniqueFrame();

    FrameFilter infosFilter_;
    std::string infosDescription_;
    std::string infosString = "";
    int fontSize_ {14};
    int lineSpacing_ {5};
    int infosSize_ {0};
    std::string fontColor_ = "white";
    std::string fontBackground_ = "black@0.5";

    std::map<int, std::string> rotation = {{-90, "-PI/2"},
                                           {90, "PI/2"},
                                           {-180, "-PI"},
                                           {180, "PI"},
                                           {0, "0"}};
};
} // namespace jami
