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

#ifndef ACCEL_H
#define ACCEL_H

extern "C" {
#include <libavutil/pixdesc.h>
#include <libavutil/hwcontext.h>
#include <libavutil/frame.h>
#include <libavutil/buffer.h>
}

extern "C" {
#if LIBAVUTIL_VERSION_MAJOR < 56
AVFrameSideData* av_frame_new_side_data_from_buf(AVFrame* frame,
                                                 enum AVFrameSideDataType type,
                                                 AVBufferRef* buf);
#endif
}

AVFrame* transferToMainMemory(const AVFrame* framePtr, AVPixelFormat desiredFormat);

#endif // ACCEL_H
