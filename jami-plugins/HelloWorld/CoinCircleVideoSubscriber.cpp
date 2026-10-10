/**
 *  Copyright (C) 2020-2021 Savoir-faire Linux Inc.
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

#include "CoinCircleVideoSubscriber.h"

extern "C" {
#include <libavutil/display.h>
}
#include <accel.h>
#include <frameUtils.h>
#include <frameScaler.h>
#include <pluglog.h>
#include <stdio.h>
#include <opencv2/imgproc.hpp>

const std::string TAG = "CoinCircle";
const char sep = separator();

namespace jami {

CoinCircleVideoSubscriber::CoinCircleVideoSubscriber(const std::string& dataPath)
    : path_ {dataPath}
{}

CoinCircleVideoSubscriber::~CoinCircleVideoSubscriber()
{
    std::ostringstream oss;
    oss << "~CoinCircleMediaProcessor" << std::endl;
    Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
}

void
CoinCircleVideoSubscriber::update(jami::Observable<AVFrame*>*, AVFrame* const& pluginFrame)
{
    if (!pluginFrame)
        return;

    //======================================================================================
    // GET FRAME ROTATION
    AVFrameSideData* side_data = av_frame_get_side_data(pluginFrame, AV_FRAME_DATA_DISPLAYMATRIX);

     int angle {0};
    if (side_data) {
        auto matrix_rotation = reinterpret_cast<int32_t*>(side_data->data);
        angle = static_cast<int>(av_display_rotation_get(matrix_rotation));
    }

    //======================================================================================
    // GET RAW FRAME
    // Use a non-const Frame
    // Convert input frame to RGB
    uniqueFramePtr rgbFrame = {transferToMainMemory(pluginFrame, AV_PIX_FMT_NV12), frameFree};
    rgbFrame.reset(FrameScaler::convertFormat(rgbFrame.get(), AV_PIX_FMT_RGB24));
    if (!rgbFrame.get())
        return;
    resultFrame = cv::Mat {rgbFrame->height,
                           rgbFrame->width,
                           CV_8UC3,
                           rgbFrame->data[0],
                           static_cast<size_t>(rgbFrame->linesize[0])};

    // First clone the frame as the original one is unusable because of
    // linespace
    processingFrame = resultFrame.clone();

    if (firstRun) {
        // we set were the circle will be draw.
        int w = resultFrame.size().width;
        int h = resultFrame.size().height;
        radius = std::min(w, h) / 8;
        circlePos.y = static_cast<int>(radius);
        circlePos.x = static_cast<int>(radius);
        firstRun = false;
    }

    drawCoinCircle(angle);
    copyByLine();

    //======================================================================================
    // REPLACE AVFRAME DATA WITH FRAME DATA
    rgbFrame.reset(FrameScaler::convertFormat(rgbFrame.get(), AV_PIX_FMT_YUV420P));
    moveFrom(pluginFrame, rgbFrame.get());
}

void
CoinCircleVideoSubscriber::drawCoinCircle(const int angle)
{
    if (!processingFrame.empty()) {
        rotateFrame(angle, processingFrame);
        cv::circle(processingFrame, circlePos, radius, baseColor, cv::FILLED);
        rotateFrame(-angle, processingFrame);
    }
}

void
CoinCircleVideoSubscriber::rotateFrame(const int angle, cv::Mat& frame)
{
    if (angle == -90)
        cv::rotate(frame, frame, cv::ROTATE_90_COUNTERCLOCKWISE);
    else if (std::abs(angle) == 180)
        cv::rotate(frame, frame, cv::ROTATE_180);
    else if (angle == 90)
        cv::rotate(frame, frame, cv::ROTATE_90_CLOCKWISE);
}

void
CoinCircleVideoSubscriber::setColor(const std::string& color)
{
    int r, g, b = 0;
    std::sscanf(color.c_str(), "#%02x%02x%02x", &r, &g, &b);
    baseColor = cv::Scalar(r, g, b);
    Plog::log(Plog::LogPriority::INFO, TAG, "Color set to: " + color);
}

void
CoinCircleVideoSubscriber::copyByLine()
{
    if (resultFrame.size() != processingFrame.size() || resultFrame.type() != processingFrame.type()) {
        resultFrame = cv::Mat(processingFrame.size(), processingFrame.type());
    }

    processingFrame.copyTo(resultFrame);
}

void
CoinCircleVideoSubscriber::attached(jami::Observable<AVFrame*>* observable)
{
    std::ostringstream oss;
    oss << "::Attached ! " << std::endl;
    Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
    observable_ = observable;
}

void
CoinCircleVideoSubscriber::detached(jami::Observable<AVFrame*>*)
{
    firstRun = true;
    observable_ = nullptr;
    std::ostringstream oss;
    oss << "::Detached()" << std::endl;
    Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
}

void
CoinCircleVideoSubscriber::detach()
{
    if (observable_) {
        firstRun = true;
        std::ostringstream oss;
        oss << "::Calling detach()" << std::endl;
        Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
        observable_->detach(this);
    }
}
} // namespace jami
