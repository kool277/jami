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

#ifndef FRAMESCALER_H
#define FRAMESCALER_H

extern "C" {
#include <libavutil/avutil.h>
#include <libavutil/frame.h>
#include <libavutil/pixfmt.h>
#include <libswscale/swscale.h>
}

class FrameScaler
{
public:
    FrameScaler() {}

    /**
     * @brief scaleConvert
     * Scales an av frame accoding to the desired width height/height
     * Converts the frame to another format if the desiredFromat is different from the input PixelFormat
     * @param input
     * @param desiredWidth
     * @param desiredHeight
     * @param desiredFormat
     * @return
     */
    static AVFrame* scaleConvert(const AVFrame* input,
                                 const size_t desiredWidth,
                                 const size_t desiredHeight,
                                 const AVPixelFormat desiredFormat)
    {
        if (input) {
            SwsContext* ctx_ = nullptr;
            AVFrame* output = av_frame_alloc();
            output->width = static_cast<int>(desiredWidth);
            output->height = static_cast<int>(desiredHeight);
            output->format = static_cast<int>(desiredFormat);

            if (av_frame_get_buffer(output, 0)) {
                av_frame_unref(output);
                av_frame_free(&output);
                return nullptr;
            }

            ctx_ = sws_getCachedContext(ctx_,
                                        input->width,
                                        input->height,
                                        static_cast<AVPixelFormat>(input->format),
                                        output->width,
                                        output->height,
                                        static_cast<AVPixelFormat>(output->format),
                                        SWS_FAST_BILINEAR,
                                        nullptr,
                                        nullptr,
                                        nullptr);
            if (!ctx_) {
                av_frame_unref(output);
                av_frame_free(&output);
                return nullptr;
            }

            if (sws_scale(ctx_,
                          input->data,
                          input->linesize,
                          0,
                          input->height,
                          output->data,
                          output->linesize)
                <= 0) {
                av_frame_unref(output);
                av_frame_free(&output);
                sws_freeContext(ctx_);
                return nullptr;
            }

            sws_freeContext(ctx_);
            return output;
        }
        return nullptr;
    }

    /**
     * @brief convertFormat
     * @param input
     * @param pix
     * @return
     */
    static AVFrame* convertFormat(const AVFrame* input, AVPixelFormat pix)
    {
        return input ? scaleConvert(input,
                                    static_cast<size_t>(input->width),
                                    static_cast<size_t>(input->height),
                                    pix)
                     : nullptr;
    }
};

#endif // FRAMESCALER_H
