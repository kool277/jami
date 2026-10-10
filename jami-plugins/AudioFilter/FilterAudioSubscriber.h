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

#include <frameFilter.h>

namespace jami {

class FilterAudioSubscriber : public Observer<AVFrame*>
{
public:
    FilterAudioSubscriber(const std::string& dataPath, const std::string& irFile);
    ~FilterAudioSubscriber();

    virtual void update(Observable<AVFrame*>*, AVFrame* const&) override;
    virtual void attached(Observable<AVFrame*>*) override;
    virtual void detached(Observable<AVFrame*>*) override;

    void detach();

    void setIRFile(const std::string& irFile);

private:
    // Observer pattern
    Observable<AVFrame*>* observable_{};

    // Data
    std::string path_;
    FrameFilter reverbFilter_;
    AVFormatContext* pFormatCtx_ = NULL;
    int audioStream_ = -1;

    // Status variables of the processing
    bool firstRun {true};

    void setFilterDescription(const int pSampleRate, const int pSamples, const int pFormat);
    void setIRAVFrame();
    AudioFormat getIRAVFrameInfos();
    std::string irFile_{};
    std::string filterDescription_{};
};
} // namespace jami
