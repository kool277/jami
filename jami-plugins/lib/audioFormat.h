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

#ifndef AUDIOFORMAT_H
#define AUDIOFORMAT_H

extern "C" {
#include <libavutil/samplefmt.h>
struct AVFrame;
}

/**
 * Structure to hold sample rate and channel number associated with audio data.
 */
struct AudioFormat
{
    unsigned sample_rate;
    unsigned nb_channels;
    AVSampleFormat sampleFormat;

    constexpr AudioFormat(unsigned sr, unsigned c)
        : sample_rate(sr)
        , nb_channels(c)
        , sampleFormat(AV_SAMPLE_FMT_S16)
    {}

    constexpr AudioFormat(unsigned sr, unsigned c, AVSampleFormat f)
        : sample_rate(sr)
        , nb_channels(c)
        , sampleFormat(f)
    {}

    static const constexpr unsigned DEFAULT_SAMPLE_RATE = 48000;
    static const constexpr AudioFormat DEFAULT() { return AudioFormat {16000, 1}; }
    static const constexpr AudioFormat NONE() { return AudioFormat {0, 0}; }
    static const constexpr AudioFormat MONO() { return AudioFormat {DEFAULT_SAMPLE_RATE, 1}; }
    static const constexpr AudioFormat STEREO() { return AudioFormat {DEFAULT_SAMPLE_RATE, 2}; }
};

#endif // AUDIOFORMAT_H
