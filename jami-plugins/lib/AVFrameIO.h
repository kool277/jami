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

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libavfilter/buffersrc.h>
#include <libavutil/channel_layout.h>
#include <libavutil/common.h>
#include <libavutil/frame.h>
#include <libavutil/samplefmt.h>
#include <libavutil/rational.h>
}

#include "pluglog.h"

#include <observer.h>

namespace av_utils
{

const AVCodec*
openDecoder(AVCodecContext*& decCodecCtx,
            AVFormatContext*& decFormatCtx,
            const std::string& file,
            AVStream*& decStream,
            const AVMediaType& mediaType)
{

    // Open
    Plog::log(Plog::LogPriority::INFO, __FILE__ + std::string(":") + std::to_string(__LINE__), "Opening decoder input" + file);
    int ret = avformat_open_input(&decFormatCtx, file.c_str(), NULL, NULL);
    if (ret != 0) {
        char errbuf[AV_ERROR_MAX_STRING_SIZE];
        av_strerror(ret, errbuf, AV_ERROR_MAX_STRING_SIZE);
        Plog::log(Plog::LogPriority::INFO, __FILE__ + std::string(":") + std::to_string(__LINE__),
                  "Couldn't open input stream: " + std::string(errbuf));
        return nullptr;
    }
    // Retrieve stream information
    if (avformat_find_stream_info(decFormatCtx, NULL) < 0) {
        Plog::log(Plog::LogPriority::INFO, __FILE__ + std::string(":") + std::to_string(__LINE__), "Couldn't find stream information.");
        return nullptr;
    }
    // Dump valid information onto standard error
    av_dump_format(decFormatCtx, 0, file.c_str(), false);

    // Find the first audio/video stream
    const AVCodec* decCodec;
    auto stream = av_find_best_stream(decFormatCtx, mediaType, -1, -1, &decCodec, 0);

    if (stream < 0) {
        Plog::log(Plog::LogPriority::INFO, __FILE__ + std::string(":") + std::to_string(__LINE__), "Didn't find an audio stream.");
        return nullptr;
    }
    decStream = decFormatCtx->streams[stream];

    if (decCodec == NULL) {
        Plog::log(Plog::LogPriority::INFO, __FILE__ + std::string(":") + std::to_string(__LINE__), "Decoder not found.");
        return nullptr;
    }

    decCodecCtx = avcodec_alloc_context3(decCodec);
    if (avcodec_parameters_to_context(decCodecCtx, decStream->codecpar) < 0) {
        Plog::log(Plog::LogPriority::INFO, __FILE__ + std::string(":") + std::to_string(__LINE__), "Failed to copy decoder parameters to decoder context.");
        return nullptr;
    }

    if (decCodecCtx->codec_type == AVMEDIA_TYPE_VIDEO)
        decCodecCtx->framerate = av_guess_frame_rate(decFormatCtx, decStream, NULL);

    // Open codec
    if (avcodec_open2(decCodecCtx, decCodec, NULL) < 0) {
        Plog::log(Plog::LogPriority::INFO, __FILE__ + std::string(":") + std::to_string(__LINE__), "Could not open codec.");
        return nullptr;
    }
    return decCodec;
}

const AVCodec*
openEncoder(AVCodecContext*& encCodecCtx,
            AVCodecContext*& decCodecCtx,
            AVFormatContext*& encFormatCtx,
            AVStream*& encStream,
            const std::string& rFile,
            AVStream*& decStream,
            const AVMediaType& mediaType)
{
    avformat_alloc_output_context2(&encFormatCtx, NULL, NULL, rFile.c_str());
    if (!encFormatCtx) {
        Plog::log(Plog::LogPriority::INFO, __FILE__ + std::string(":") + std::to_string(__LINE__), "Could not create output context.");
        return nullptr;
    }

    encStream = avformat_new_stream(encFormatCtx, NULL);
    if (!encStream) {
        return nullptr;
    }

    const AVCodec* encCodec = avcodec_find_encoder(decStream->codecpar->codec_id);
    if (encCodec == NULL) {
        Plog::log(Plog::LogPriority::INFO, __FILE__ + std::string(":") + std::to_string(__LINE__), "Encoder not found.");
        return nullptr;
    }
    encCodecCtx = avcodec_alloc_context3(encCodec);
    if (encCodecCtx == NULL) {
        Plog::log(Plog::LogPriority::INFO, __FILE__ + std::string(":") + std::to_string(__LINE__), "Could not allocate audio codec context.");
        return nullptr;
    }

    if (mediaType == AVMEDIA_TYPE_AUDIO) {
        encCodecCtx->sample_rate    = decCodecCtx->sample_rate;
        encCodecCtx->ch_layout = decCodecCtx->ch_layout;
        encCodecCtx->ch_layout.nb_channels = decCodecCtx->ch_layout.nb_channels;
        encCodecCtx->sample_fmt = decCodecCtx->sample_fmt;
        encCodecCtx->time_base = AVRational{1, encCodecCtx->sample_rate};
    } else if (mediaType == AVMEDIA_TYPE_VIDEO) {
        encCodecCtx->height = decCodecCtx->height;
        encCodecCtx->width = decCodecCtx->width;
        encCodecCtx->sample_aspect_ratio = decCodecCtx->sample_aspect_ratio;
        encCodecCtx->pix_fmt = decCodecCtx->pix_fmt;
        encCodecCtx->time_base = decStream->time_base;
        encCodecCtx->bit_rate = decCodecCtx->bit_rate;
    } else {
        Plog::log(Plog::LogPriority::INFO, __FILE__ + std::string(":") + std::to_string(__LINE__), "Unsupported media type");
        return nullptr;
    }

    if (avcodec_open2(encCodecCtx, encCodec, NULL) < 0) {
        Plog::log(Plog::LogPriority::INFO, __FILE__ + std::string(":") + std::to_string(__LINE__), "Could not open codec.");
        return nullptr;
    }
    if (avcodec_parameters_from_context(encStream->codecpar, encCodecCtx) < 0) {
        return nullptr;
    }
    encStream->time_base = encCodecCtx->time_base;

    av_dump_format(encFormatCtx, 0, rFile.c_str(), 1);

    if (!(encFormatCtx->oformat->flags & AVFMT_NOFILE)) {
        if (avio_open(&encFormatCtx->pb, rFile.c_str(), AVIO_FLAG_WRITE) < 0) {
            Plog::log(Plog::LogPriority::INFO, __FILE__ + std::string(":") + std::to_string(__LINE__), "Could not open output file.");
            return nullptr;
        }
    }

    if (avformat_write_header(encFormatCtx, NULL) < 0) {
        Plog::log(Plog::LogPriority::INFO, __FILE__ + std::string(":") + std::to_string(__LINE__), "Could not open output file.");
        return nullptr;
    }
    return encCodec;
}

void
readAndNotifyAVFrame(const std::string& file, jami::PublishObservable<AVFrame*>* subject, const std::string& rFile, const AVMediaType mediaType)
{
    // Open Decoder
    Plog::log(Plog::LogPriority::INFO, __FILE__ + std::string(":") + std::to_string(__LINE__), "Opening decoder input" + file+ " rfile : " + rFile + "" + AV_TOSTRING(mediaType));
    AVCodecContext* decCodecCtx;
    AVFormatContext* decFormatCtx = avformat_alloc_context();
    AVStream* decStream;
    const AVCodec* decCodec = openDecoder(decCodecCtx, decFormatCtx, file, decStream, mediaType);
    if (!decCodec) {
        avcodec_close(decCodecCtx);
        avcodec_free_context(&decCodecCtx);
        avformat_close_input(&decFormatCtx);
        avformat_free_context(decFormatCtx);
        return;
    }

    // Open Encoder
    AVCodecContext* encCodecCtx;
    AVFormatContext* encFormatCtx;
    AVStream* encStream;
    if (!rFile.empty()) {
        const AVCodec* encCodec = openEncoder(encCodecCtx, decCodecCtx, encFormatCtx, encStream, rFile, decStream, mediaType);
        if (!encCodec) {
            avcodec_close(decCodecCtx);
            avcodec_free_context(&decCodecCtx);
            avformat_close_input(&decFormatCtx);
            avformat_free_context(decFormatCtx);

            avio_closep(&encFormatCtx->pb);
            avcodec_close(encCodecCtx);
            avcodec_free_context(&encCodecCtx);
            avformat_close_input(&encFormatCtx);
            avformat_free_context(encFormatCtx);
            return;
        }
    }

    AVPacket* packet = av_packet_alloc();
    AVFrame* pFrame = av_frame_alloc();

    while (av_read_frame(decFormatCtx, packet) == 0) {
        av_frame_unref(pFrame);
        av_frame_free(&pFrame);
        pFrame = av_frame_alloc();
        if (packet->stream_index == decStream->index) {
            if (avcodec_send_packet(decCodecCtx, packet) < 0) {
                Plog::log(Plog::LogPriority::INFO, __FILE__ + std::string(":") + std::to_string(__LINE__), "Error submitting the packet to the decoder");
                break;
            }

            // Read frames from decoder
            while (avcodec_receive_frame(decCodecCtx, pFrame) == 0) {
                // Publish frames for the plugin subscriber
                pFrame->time_base.num = decCodecCtx->framerate.den;
                pFrame->time_base.den = decCodecCtx->framerate.num;
                subject->publish(pFrame);

                if (!rFile.empty()) {
                    // Send frame to encoder
                    if (avcodec_send_frame(encCodecCtx, pFrame) < 0) {
                        break;
                    }

                    // Read packet from encoder
                    AVPacket *enc_pkt = av_packet_alloc();
                    while (avcodec_receive_packet(encCodecCtx, enc_pkt) == 0) {
                        enc_pkt->stream_index = 0; // 0 -> we only created one stream in the encoder
                        av_packet_rescale_ts(enc_pkt,
                                            encCodecCtx->time_base,
                                            encFormatCtx->streams[0]->time_base);

                        av_interleaved_write_frame(encFormatCtx, enc_pkt);
                    }
                    av_packet_unref(enc_pkt);
                    av_packet_free(&enc_pkt);
                }
            }
        }
        av_packet_unref(packet);
    }

    if (!rFile.empty())
        av_write_trailer(encFormatCtx);

    av_frame_unref(pFrame);
    av_frame_free(&pFrame);
    av_packet_unref(packet);
    av_packet_free(&packet);

    avcodec_close(decCodecCtx);
    avcodec_free_context(&decCodecCtx);
    avformat_close_input(&decFormatCtx);
    avformat_free_context(decFormatCtx);

    if (!rFile.empty()) {
        avio_closep(&encFormatCtx->pb);
        avcodec_close(encCodecCtx);
        avcodec_free_context(&encCodecCtx);
        avformat_close_input(&encFormatCtx);
        avformat_free_context(encFormatCtx);
    }
}
} //av_utils
