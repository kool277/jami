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

#include "TranscriptVideoSubscriber.h"

extern "C" {
#include <libavutil/display.h>
}

#include <pluglog.h>
#include <mediaStream.h>
#include <frameScaler.h>
#include <accel.h>
#include <common.h>
#include <frameUtils.h>

#include <fmt/core.h>
#include <fmt/format.h>

#include <bitset>
#include <string_view>
#include <thread>

using namespace std::literals;

const std::string TAG = "TranscriptVideo";
const char sep = separator();

namespace jami {

TranscriptVideoSubscriber::TranscriptVideoSubscriber(const std::string& dataPath)
    : path_ {dataPath}
{
    fontFile_ = string_utils::ffmpegFormatString(dataPath + sep + "Muli-Light.ttf");
}

TranscriptVideoSubscriber::~TranscriptVideoSubscriber()
{
    filter_.clean();
    Plog::log(Plog::LogPriority::INFO, TAG, "~TranscriptMediaProcessor");
}

void
TranscriptVideoSubscriber::setText(const std::string& t)
{
    Plog::log(Plog::LogPriority::INFO, TAG, "setText " + t);
    auto text = string_utils::ffmpegScapeString(t);
    std::vector<std::string> textWords = string_utils::getWords(text, " ");
    subtitle_ = "";

    auto idx = 0;
    for (const auto& word : textWords) {
        idx++;
        subtitle_ = fmt::format("{} {}", subtitle_, word);
        if (idx % maxWordsLength == 0)
            subtitle_ = fmt::format("{}{}", subtitle_, "\n");
    }

#ifdef __DEBUG__
    Plog::log(Plog::LogPriority::INFO, TAG, subtitle_);
#endif
    firstRun = true;
}

void
TranscriptVideoSubscriber::setParameter(std::string& parameter, Parameter type)
{
    switch (type) {
    case (Parameter::FONTSIZE):
        fontSize_ = parameter;
        break;
    case (Parameter::BACKGROUND):
        background_ = parameter;
        if (background_.find("black") == std::string::npos) {
            fontColor_ = "black";
            fontBackground_ = "white@0.5";
        } else {
            fontColor_ = "white";
            fontBackground_ = "black@0.5";
        }
        break;
    case (Parameter::POSITION):
        position_ = parameter;
        break;
    default:
        return;
    }

    firstRun = true;
}

std::string_view getTransposeDescr(int rotation)
{
    switch (rotation) {
    case 90:
        return "transpose=1,"sv;
    case 180:
        return "transpose=1, transpose=1,"sv;
    case -180:
        return "transpose=2, transpose=2,"sv;
    case -90:
        return "transpose=2,"sv;
    default:
        return {};
    }
    return {};
}

void
TranscriptVideoSubscriber::setFilterDescription()
{
    Plog::log(Plog::LogPriority::INFO, TAG, "setFilterDescription() " + subtitle_);
    if (pluginFrameSize_.first == 0 || pluginFrameSize_.second == 0)
        return;

    // 1, 2, 3, and 4 are cartesian positions
    int margin = 10;
    if (position_ == "1") {
        point_ = {pluginFrameSize_.first - margin, margin};
    } else if (position_ == "2") {
        point_ = {margin, margin};
    } else if (position_ == "3") {
        point_ = {margin, pluginFrameSize_.second - margin};
    } else if (position_ == "4") {
        point_ = {pluginFrameSize_.first - margin, pluginFrameSize_.second - margin};
    }

    auto baseInfosDescription
        = fmt::format("[input]{}"
                      "drawtext=fontcolor={}:fontsize={}:fontfile=\\'{}\\':expansion=none:text='{}"
                      "':line_spacing=5:box=1:boxcolor={}:boxborderw=5:x=",
                      getTransposeDescr(angle_),
                      fontColor_, fontSize_, fontFile_, subtitle_, fontBackground_);

    auto position = "{}-text_w:y={}"sv;
    if (position_ == "2")
        position = "{}:y={}"sv;
    else if (position_ == "3")
        position = "{}:y={}-text_h"sv;
    else if (position_ == "4")
        position = "{}-text_w:y={}-text_h"sv;
    filterDescription_ = baseInfosDescription + fmt::format(std::string(position) + ",{}format=yuv420p"s,
                                                    point_.first,
                                                    point_.second,
                                                    getTransposeDescr(-angle_));

    Plog::log(Plog::LogPriority::INFO, TAG, filterDescription_);
}

void
TranscriptVideoSubscriber::update(jami::Observable<AVFrame*>*, AVFrame* const& pluginFrame )
{
    // This sleep is only used if we are in the standalone testing version of the plugin
    // this is because if we don't wait, the video will be processed before the subtitles are generated
    #ifdef STANDALONE
    std::this_thread::sleep_for(std::chrono::milliseconds(60));
    #endif

    if (!observable_ || !pluginFrame || subtitle_.empty())
        return;

    int newAngle {0};
    if (AVFrameSideData* side_data = av_frame_get_side_data(pluginFrame, AV_FRAME_DATA_DISPLAYMATRIX)) {
        auto matrix_rotation = reinterpret_cast<int32_t*>(side_data->data);
        newAngle = static_cast<int>(av_display_rotation_get(matrix_rotation));
    }
    if (newAngle != angle_) {
        angle_ = newAngle;
        firstRun = true;
    }

    //======================================================================================
    // GET RAW FRAME
    uniqueFramePtr rgbFrame = {transferToMainMemory(pluginFrame, AV_PIX_FMT_NV12), frameFree};
    if (!rgbFrame.get())
        return;
    if ((AVPixelFormat)rgbFrame->format != AV_PIX_FMT_YUV420P)
        rgbFrame.reset(FrameScaler::convertFormat(rgbFrame.get(), AV_PIX_FMT_YUV420P));
    if (!rgbFrame.get())
        return;

    if (sourceTimeBase_.num != pluginFrame->time_base.num || sourceTimeBase_.den != pluginFrame->time_base.den)
        firstRun = true;

    rgbFrame->pts = pluginFrame->pts;
    rgbFrame->time_base = pluginFrame->time_base;
    sourceTimeBase_ = pluginFrame->time_base;

    if (firstRun) {
        filter_.clean();
        pluginFrameSize_ = {rgbFrame->width, rgbFrame->height};
        if (std::abs(angle_) == 90)
            pluginFrameSize_ = {rgbFrame->height, rgbFrame->width};
        setFilterDescription();

        rational<int> fr(sourceTimeBase_.den, sourceTimeBase_.num);
        auto ms = MediaStream("input",
                              rgbFrame->format,
                              1 / fr,
                              rgbFrame->width,
                              rgbFrame->height,
                              0,
                              fr);
        filter_.initialize(filterDescription_, {ms});
        firstRun = false;
    }

    if (!filter_.initialized_)
        return;

    if (filter_.feedInput(rgbFrame.get(), "input") == 0) {
        uniqueFramePtr filteredFrame = {filter_.readOutput(), frameFree};
        if (filteredFrame) {
            moveFrom(pluginFrame, filteredFrame.get());
        }
    }
}

void
TranscriptVideoSubscriber::attached(jami::Observable<AVFrame*>* observable)
{
    Plog::log(Plog::LogPriority::INFO, TAG, "::Attached ! ");
    observable_ = observable;
}

void
TranscriptVideoSubscriber::detached(jami::Observable<AVFrame*>*)
{
    firstRun = true;
    observable_ = nullptr;
    Plog::log(Plog::LogPriority::INFO, TAG, "::Detached()");
}

void
TranscriptVideoSubscriber::detach()
{
    if (observable_) {
        firstRun = true;
        std::ostringstream oss;
        Plog::log(Plog::LogPriority::INFO, TAG, "::Calling detach()");
        observable_->detach(this);
    }
}
} // namespace jami
