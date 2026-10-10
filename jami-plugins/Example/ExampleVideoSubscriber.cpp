/**
 *  Copyright (C) 2023-2024 Savoir-faire Linux Inc.
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

#include "ExampleVideoSubscriber.h"

extern "C" {
#include <libavutil/display.h>
}
#include <accel.h>
#include <frameScaler.h>
#include <common.h>

#include <pluglog.h>
#include <algorithm>
#include <ctime>
#include <clocale>
#include <iostream>

const std::string TAG = "Example";
const char sep = separator();

namespace jami {

ExampleVideoSubscriber::ExampleVideoSubscriber(const std::string& dataPath) // Construct the video subscriber.
{
    if (std::setlocale(LC_TIME, std::locale("").name().c_str()) == NULL) {
        Plog::log(Plog::LogPriority::INFO, TAG, "error while setting locale");
    }

    std::setlocale(LC_NUMERIC, "C");
    fontFile_ = string_utils::ffmpegFormatString(dataPath + sep + "Muli-Light.ttf");
}

ExampleVideoSubscriber::~ExampleVideoSubscriber() // Deconstruct the video subscriber.
{
    validLogo_ = false;
    logoFilter_.clean();
    detach();
    std::lock_guard<std::mutex> lk(mtx_);
    Plog::log(Plog::LogPriority::INFO, TAG, "~ExampleMediaProcessor");
}

MediaStream
ExampleVideoSubscriber::getLogoAVFrameInfos() // Open an image logo and a video stream, so that the logo can be applied to the stream later on.
{
    AVFormatContext* ctx = avformat_alloc_context();

    // Open
    if (avformat_open_input(&ctx, logoPath_.c_str(), NULL, NULL) != 0) {
        avformat_free_context(ctx);
        Plog::log(Plog::LogPriority::INFO, TAG, "Couldn't open input stream.");
        validLogo_ = false;
        return {};
    }
    pFormatCtx_.reset(ctx);
    // Retrieve stream information
    if (avformat_find_stream_info(pFormatCtx_.get(), NULL) < 0) {
        Plog::log(Plog::LogPriority::INFO, TAG, "Couldn't find stream information.");
        validLogo_ = false;
        return {};
    }

    // Dump valid information onto standard error
    av_dump_format(pFormatCtx_.get(), 0, logoPath_.c_str(), false);

    // Find the video stream
    for (int i = 0; i < static_cast<int>(pFormatCtx_->nb_streams); i++)
        if (pFormatCtx_->streams[i]->codecpar->codec_type == AVMEDIA_TYPE_VIDEO) {
            videoStream_ = i;
            break;
        }

    if (videoStream_ == -1) {
        Plog::log(Plog::LogPriority::INFO, TAG, "Didn't find a video stream.");
        validLogo_ = false;
        return {};
    }

    rational<int> fr = pFormatCtx_->streams[videoStream_]->r_frame_rate;
    return MediaStream("logo",
                       pFormatCtx_->streams[videoStream_]->codecpar->format,
                       1 / fr,
                       pFormatCtx_->streams[videoStream_]->codecpar->width,
                       pFormatCtx_->streams[videoStream_]->codecpar->height,
                       0,
                       fr);
}

void
ExampleVideoSubscriber::loadMarkLogo() // Load a logo, altering the image data so it can be safely placed onto the video stream.
{
    if (logoPath_.empty())
        return;

    logoFilter_.clean();
    logoDescription_ = "[logo]scale=" + logoSize_ + "*" + std::to_string(pluginFrameSize_.first)
                       + ":" + logoSize_ + "*" + std::to_string(pluginFrameSize_.second)
                       + ":force_original_aspect_ratio='decrease',format=yuva444p,"
                         "split=2[bg][fg],[bg]drawbox=c='"
                       + backgroundColor_
                       + "':replace=1:t=fill[bg],"
                         "[bg][fg]overlay=format=auto";
    Plog::log(Plog::LogPriority::INFO, TAG, logoDescription_);
    logoStream_ = getLogoAVFrameInfos();
    logoFilter_.initialize(logoDescription_, {logoStream_});

    AVCodecContext* pCodecCtx;

    const AVCodec* pCodec = avcodec_find_decoder(
        pFormatCtx_->streams[videoStream_]->codecpar->codec_id);
    if (pCodec == nullptr) {
        pFormatCtx_.reset();
        Plog::log(Plog::LogPriority::INFO, TAG, "Codec not found.");
        validLogo_ = false;
        return;
    }

    pCodecCtx = avcodec_alloc_context3(pCodec);
    // Open codec
    if (avcodec_open2(pCodecCtx, pCodec, NULL) < 0) {
        pFormatCtx_.reset();
        Plog::log(Plog::LogPriority::INFO, TAG, "Could not open codec.");
        validLogo_ = false;
        return;
    }

    AVPacket* packet = av_packet_alloc();

    if (av_read_frame(pFormatCtx_.get(), packet) < 0) {
        avcodec_close(pCodecCtx);
        avcodec_free_context(&pCodecCtx);
        av_packet_unref(packet);
        av_packet_free(&packet);
        pFormatCtx_.reset();
        Plog::log(Plog::LogPriority::INFO, TAG, "Could not read packet from context.");
        validLogo_ = false;
        return;
    }

    if (avcodec_send_packet(pCodecCtx, packet) < 0) {
        avcodec_close(pCodecCtx);
        avcodec_free_context(&pCodecCtx);
        av_packet_unref(packet);
        av_packet_free(&packet);
        pFormatCtx_.reset();
        Plog::log(Plog::LogPriority::INFO, TAG, "Could not send packet no codec.");
        validLogo_ = false;
        return;
    }

    uniqueFramePtr logoImage = {av_frame_alloc(), frameFree};
    if (avcodec_receive_frame(pCodecCtx, logoImage.get()) < 0) {
        avcodec_close(pCodecCtx);
        avcodec_free_context(&pCodecCtx);
        av_packet_unref(packet);
        av_packet_free(&packet);
        pFormatCtx_.reset();
        Plog::log(Plog::LogPriority::INFO, TAG, "Could not read packet from codec.");
        validLogo_ = false;
        return;
    }

    logoFilter_.feedInput(logoImage.get(), "logo");
    logoFilter_.feedEOF("logo");

    avcodec_close(pCodecCtx);
    avcodec_free_context(&pCodecCtx);
    av_packet_unref(packet);
    av_packet_free(&packet);
    pFormatCtx_.reset();
    mark_.reset(logoFilter_.readOutput());
    mark_->pts = 0;
    mark_->best_effort_timestamp = 0;
    validLogo_ = mark_->width && mark_->height;
}

void
ExampleVideoSubscriber::setParameter(std::string& parameter, Parameter type) // Apply the parameters set by the user.
{
    switch (type) {
    case (Parameter::LOGOSIZE):
        logoSize_ = parameter;
        break;
    case (Parameter::TIMEZONE):
        timeZone_ = parameter == "1";
        return;
    case (Parameter::FONTSIZE):
        fontSize_ = std::stoi(parameter);
        break;
    case (Parameter::LOGOBACKGROUND):
        backgroundColor_ = parameter;
        if (backgroundColor_.find("black") == std::string::npos) {
            fontColor_ = "black";
            fontBackground_ = "white@0.5";
        } else {
            fontColor_ = "white";
            fontBackground_ = "black@0.5";
        }
        break;
    case (Parameter::SHOWLOGO):
        showLogo_ = parameter == "1";
        break;
    case (Parameter::SHOWINFOS):
        showInfos_ = parameter == "1";
        break;
    case (Parameter::LOGOPATH):
        logoPath_ = parameter;
        break;
    case (Parameter::TIME):
        time_ = parameter == "1";
        break;
    case (Parameter::DATE):
        date_ = parameter == "1";
        break;
    case (Parameter::TIMEFORMAT):
        timeFormat_ = "%{localtime\\:'" + parameter + "'}";
        if (timeZone_)
            timeFormat_ = "%{localtime\\:'" + parameter + " %Z'}";
        break;
    case (Parameter::DATEFORMAT):
        dateFormat_ = "%{localtime\\:'" + parameter + "'}";
        break;
    case (Parameter::LOCATION):
        location_ = parameter;
        break;
    case (Parameter::INFOSPOSITION):
        infosposition_ = parameter;
        break;
    case (Parameter::LOGOPOSITION):
        logoposition_ = parameter;
        break;
    default:
        return;
    }

    firstRun = true;
}

void
ExampleVideoSubscriber::setFilterDescription() // Prepare the logo to be processed by ffmpeg.
{
    loadMarkLogo();

    std::string infoSep = ", ";
    if (pluginFrameSize_.first < pluginFrameSize_.second)
        infoSep = ",\n";

    std::vector<std::string> infos;
    infosSize_ = 0;
    if (!location_.empty()) {
        infosSize_++;
        infos.emplace_back(location_);
    }
    if (date_) {
        infosSize_++;
        infos.emplace_back(dateFormat_);
    }
    if (time_) {
        infosSize_++;
        infos.emplace_back(timeFormat_);
    }
    infosString.clear();
    for (int i = 0; i < infosSize_ - 1; i++)
        infosString += infos[i] + infoSep;
    if (infosSize_ > 0)
        infosString += infos.back();

    setMarkPosition();

    std::string rotateSides = "";
    if (std::abs(angle_) == 90)
        rotateSides = ":out_w=ih:out_h=iw";
    std::string formatedPath = string_utils::ffmpegFormatString(logoPath_);

    auto gifDescription = "movie='" + formatedPath + "':loop=0,setpts=N/(FR*TB)[logo],"
                          + logoDescription_ + "[loop],";

    if (angle_ != 0)
        pluginFilterDescription_ = gifDescription
                                   + "[input]rotate=" + rotation[angle_] + rotateSides
                                   + "[rot],[rot][loop]overlay=" + std::to_string(points_[0].first)
                                   + ":" + std::to_string(points_[0].second)
                                   + ",rotate=" + rotation[-angle_] + rotateSides;
    else
        pluginFilterDescription_ = gifDescription
                                   + "[input][loop]overlay="
                                   + std::to_string(points_[0].first) + ":"
                                   + std::to_string(points_[0].second);

    std::string baseInfosDescription = "[input]rotate=" + rotation[angle_] + rotateSides
                                       + ",drawtext=fontfile='" + fontFile_ + "':text='"
                                       + infosString + "':fontcolor=" + fontColor_
                                       + ":fontsize=" + std::to_string(fontSize_)
                                       + ":line_spacing=" + std::to_string(lineSpacing_)
                                       + ":box=1:boxcolor=" + fontBackground_ + ":boxborderw=5:x=";

    if (infosposition_ == "1")
        infosDescription_ = baseInfosDescription + std::to_string(points_[1].first)
                            + "-text_w:y=" + std::to_string(points_[1].second);
    else if (infosposition_ == "2")
        infosDescription_ = baseInfosDescription + std::to_string(points_[1].first)
                            + ":y=" + std::to_string(points_[1].second);
    else if (infosposition_ == "3")
        infosDescription_ = baseInfosDescription + std::to_string(points_[1].first)
                            + ":y=" + std::to_string(points_[1].second) + "-text_h";
    else if (infosposition_ == "4")
        infosDescription_ = baseInfosDescription + std::to_string(points_[1].first)
                            + "-text_w:y=" + std::to_string(points_[1].second) + "-text_h";
    infosDescription_ += ",rotate=" + rotation[-angle_] + rotateSides + ",format=yuv420p";

    Plog::log(Plog::LogPriority::INFO, TAG, infosDescription_);
    Plog::log(Plog::LogPriority::INFO, TAG, pluginFilterDescription_);
}

void
ExampleVideoSubscriber::setMarkPosition() // Set the position where the logo will be applied on the video stream.
{
    if (!validLogo_)
        return;
    // 1, 2, 3, and 4 are cartesian positions
    int margin = 10;
    int markWidth = showLogo_ ? mark_->width : 0;
    int markHeight = showLogo_ ? mark_->height : 0;
    int infoHeight = (std::abs(angle_) == 90) ? (fontSize_ + lineSpacing_) * infosSize_
                                              : lineSpacing_ * 2 + fontSize_;
    if (pluginFrameSize_.first == 0 || pluginFrameSize_.second == 0)
        return;

    if (infosposition_ == "1") {
        points_[1] = {pluginFrameSize_.first - margin, margin};
    } else if (infosposition_ == "2") {
        points_[1] = {margin, margin};
    } else if (infosposition_ == "3") {
        points_[1] = {margin, pluginFrameSize_.second - margin};
    } else if (infosposition_ == "4") {
        points_[1] = {pluginFrameSize_.first - margin, pluginFrameSize_.second - margin};
    }
    if (logoposition_ == "1") {
        points_[0] = {pluginFrameSize_.first - mark_->width - margin / 2, margin};
    } else if (logoposition_ == "2") {
        points_[0] = {margin / 2, margin};
    } else if (logoposition_ == "3") {
        points_[0] = {margin / 2, pluginFrameSize_.second - markHeight - margin};
    } else if (logoposition_ == "4") {
        points_[0] = {pluginFrameSize_.first - markWidth - margin / 2,
                      pluginFrameSize_.second - markHeight - margin};
    }

    if (infosposition_ == logoposition_ && showInfos_ && showLogo_) {
        if (logoposition_ == "1" || logoposition_ == "2") {
            points_[0].second += infoHeight;
        } else if (logoposition_ == "3" || logoposition_ == "4") {
            points_[0].second -= infoHeight;
        }
    }
}

void
ExampleVideoSubscriber::update(jami::Observable<AVFrame*>*, AVFrame* const& pluginFrame) // Get a video frame, and apply the logo onto the video frame.
{
    if (!observable_ || !pluginFrame || (showLogo_ && !validLogo_))
        return;

    AVFrameSideData* side_data = av_frame_get_side_data(pluginFrame, AV_FRAME_DATA_DISPLAYMATRIX);
    int newAngle {0};
    if (side_data) {
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
    rgbFrame.reset(FrameScaler::convertFormat(rgbFrame.get(), AV_PIX_FMT_YUV420P));
    if (!rgbFrame.get())
        return;

    if (sourceTimeBase_.num != pluginFrame->time_base.num || sourceTimeBase_.den != pluginFrame->time_base.den)
        firstRun = true;

    rgbFrame->pts = pluginFrame->pts;
    rgbFrame->time_base = pluginFrame->time_base;
    sourceTimeBase_ = pluginFrame->time_base;

    if (firstRun) {
        pluginFilter_.clean();
        infosFilter_.clean();
        pluginFrameSize_ = {rgbFrame->width, rgbFrame->height};
        if (std::abs(angle_) == 90)
            pluginFrameSize_ = {rgbFrame->height, rgbFrame->width};

        setFilterDescription();

        rational<int> fr(sourceTimeBase_.den, sourceTimeBase_.num);
        pluginstream_ = MediaStream("input",
                                    rgbFrame->format,
                                    1 / fr,
                                    rgbFrame->width,
                                    rgbFrame->height,
                                    0,
                                    fr);

        if (showLogo_ && validLogo_) {
            pluginFilter_.initialize(pluginFilterDescription_, {pluginstream_});
        }

        infosFilter_.initialize(infosDescription_, {pluginstream_});
        firstRun = false;
    }

    if (!infosFilter_.initialized_ && !pluginFilter_.initialized_)
        return;

    if (showLogo_ && validLogo_) {
        if (pluginFilter_.feedInput(rgbFrame.get(), "input") == 0) {
            uniqueFramePtr filteredFrame = {pluginFilter_.readOutput(), frameFree};
            if (filteredFrame.get())
                moveFrom(rgbFrame.get(), filteredFrame.get());
        }
    }
    if (showInfos_) {
        if (infosFilter_.feedInput(rgbFrame.get(), "input") == 0) {
            uniqueFramePtr filteredFrame = {infosFilter_.readOutput(), frameFree};
            if (filteredFrame.get())
                moveFrom(rgbFrame.get(), filteredFrame.get());
        }
    }
    if (showInfos_ || showLogo_) {
        moveFrom(pluginFrame, rgbFrame.get());
    }
}

void
ExampleVideoSubscriber::attached(jami::Observable<AVFrame*>* observable)
{
    Plog::log(Plog::LogPriority::INFO, TAG, "Attached!");
    observable_ = observable;
}

void
ExampleVideoSubscriber::detached(jami::Observable<AVFrame*>*)
{
    pluginFilter_.clean();
    infosFilter_.clean();
    firstRun = true;
    observable_ = nullptr;
    Plog::log(Plog::LogPriority::INFO, TAG, "Detached!");
    mtx_.unlock();
}

void
ExampleVideoSubscriber::detach() // Detach from the video stream.
{
    if (observable_) {
        mtx_.lock();
        firstRun = true;
        observable_->detach(this);
    }
}
} // namespace jami
