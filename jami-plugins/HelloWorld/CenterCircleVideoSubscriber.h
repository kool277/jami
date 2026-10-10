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

#pragma once

extern "C" {
#include <libavutil/frame.h>
}
#include <observer.h>
#include <opencv2/core.hpp>

namespace jami {

class CenterCircleVideoSubscriber : public Observer<AVFrame*>
{
public:
    CenterCircleVideoSubscriber(const std::string& dataPath);
    ~CenterCircleVideoSubscriber();

    virtual void update(Observable<AVFrame*>*, AVFrame* const&) override;
    virtual void attached(Observable<AVFrame*>*) override;
    virtual void detached(Observable<AVFrame*>*) override;

    void detach();

    void setColor(const std::string& color);

private:
    // Observer pattern
    Observable<AVFrame*>* observable_{};

    // Data
    std::string path_;

    // Status variables of the processing
    bool firstRun {true};

    // define custom variables
    void copyByLine();
    void drawCenterCircle();

    cv::Point circlePos;
    cv::Mat processingFrame;
    cv::Mat resultFrame;
    int radius;
    cv::Scalar baseColor;
};
} // namespace jami
