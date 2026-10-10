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

#include "frameUtils.h"

extern "C" {
#include <libavutil/avutil.h>
}

void
moveFrom(AVFrame* dst, AVFrame* src)
{
    if (dst && src) {
        av_frame_copy_props(src, dst);
        av_frame_unref(dst);
        av_frame_move_ref(dst, src);
    }
}

void
frameFree(AVFrame* frame)
{
    if (frame)
        av_frame_unref(frame);
    av_frame_free(&frame);
}

uniqueFramePtr
getUniqueFrame() {
    uniqueFramePtr frame = {av_frame_alloc(), frameFree};
    return frame;
}
