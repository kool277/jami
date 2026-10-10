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

#include "ExampleAudioSubscriber.h"

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
}
#include <frameUtils.h>

#include <pluglog.h>

const std::string TAG = "Example";
const char sep = separator();

namespace jami {

ExampleAudioSubscriber::ExampleAudioSubscriber(const std::string& dataPath, const std::string& irFile) // Construct the audio stream subscriber.
    : path_ {dataPath}
{
    setIRFile(irFile);
}

ExampleAudioSubscriber::~ExampleAudioSubscriber() // Deconstruct the audio stream subscriber.
{
    if(pFormatCtx_) {
        avformat_close_input(&pFormatCtx_);
        avformat_free_context(pFormatCtx_);
    }
    std::ostringstream oss;
    oss << "~ExampleMediaProcessor" << std::endl;
    Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
}

void
ExampleAudioSubscriber::setIRFile(const std::string& irFile) // Initialize a file to use for the reverb effect.
{
    irFile_ = path_ + "/" + irFile;
    firstRun = true;
    reverbExample_.clean();
}

void
ExampleAudioSubscriber::setExampleDescription(const int pSampleRate, const int pSamples, const int pFormat)
// Constructs a filter description string based on the sample rate, number of samples, and format of the incoming audio frames.
// This string describes how the audio should be processed (resampled and applied with the IR).
{
    int rSamples = 1024; // due to afir internal fifo
    int midSampleRate = pSampleRate * rSamples / pSamples;
    std::string outFormat = av_get_sample_fmt_name((AVSampleFormat)pFormat);
    filterDescription_
        = "[ input ] aformat=sample_fmts=s16:sample_rates=" + std::to_string(midSampleRate)
          + ":channel_layouts=stereo [ resample1 ] , "
          + "[ resample1 ] [ ir0 ] afir=maxir=1:wet=10:dry=10:irgain=1:irfmt=mono:maxp="
          + std::to_string(rSamples) + ":minp=" + std::to_string(rSamples) + " [ reverb ] , "
          + "[ reverb ] aformat=sample_fmts=" + outFormat + ":sample_rates="
          + std::to_string(pSampleRate) + ":channel_layouts=stereo ";
}

AudioFormat
ExampleAudioSubscriber::getIRAVFrameInfos() // Find the audio stream.
{
    AudioFormat rAudioFormat = AudioFormat(0, 0);
    int i;

    pFormatCtx_ = avformat_alloc_context();
    // Open
    if (avformat_open_input(&pFormatCtx_, irFile_.c_str(), NULL, NULL) != 0) {
        Plog::log(Plog::LogPriority::INFO, TAG, "Couldn't open input stream.");
        return rAudioFormat;
    }
    // Retrieve stream information
    if (avformat_find_stream_info(pFormatCtx_, NULL) < 0) {
        Plog::log(Plog::LogPriority::INFO, TAG, "Couldn't find stream information.");
        return rAudioFormat;
    }

    // Dump valid information onto standard error
    av_dump_format(pFormatCtx_, 0, irFile_.c_str(), false);

    // Find the first audio stream
    audioStream_ = -1;
    for (i = 0; i < static_cast<int>(pFormatCtx_->nb_streams); i++)
        if (pFormatCtx_->streams[i]->codecpar->codec_type == AVMEDIA_TYPE_AUDIO) {
            audioStream_ = i;
            break;
        }

    if (audioStream_ == -1) {
        Plog::log(Plog::LogPriority::INFO, TAG, "Didn't find a audio stream.");
        return rAudioFormat;
    }
    rAudioFormat = AudioFormat(pFormatCtx_->streams[audioStream_]->codecpar->sample_rate,
                               pFormatCtx_->streams[audioStream_]->codecpar->ch_layout.nb_channels,
                               static_cast<AVSampleFormat>(
                                   pFormatCtx_->streams[audioStream_]->codecpar->format));

    return rAudioFormat;
}

void
ExampleAudioSubscriber::setIRAVFrame() // Feed data into the reverb filter.
{
    AVCodecContext* pCodecCtx;

    const AVCodec* pCodec = avcodec_find_decoder(pFormatCtx_->streams[audioStream_]->codecpar->codec_id);
    if (pCodec == NULL) {
        Plog::log(Plog::LogPriority::INFO, TAG, "Codec not found.");
        return;
    }

    pCodecCtx = avcodec_alloc_context3(pCodec);
    if (avcodec_parameters_to_context(pCodecCtx, pFormatCtx_->streams[audioStream_]->codecpar) < 0) {
        Plog::log(Plog::LogPriority::INFO, __FILE__, "Failed to copy decoder parameters to decoder context.");
        return;
    }
    // Open codec
    if (avcodec_open2(pCodecCtx, pCodec, NULL) < 0) {
        Plog::log(Plog::LogPriority::INFO, TAG, "Could not open codec.");
        return;
    }

    AVPacket* packet = av_packet_alloc();
    AVFrame* pFrame = av_frame_alloc();

    int idx = 0;
    while (av_read_frame(pFormatCtx_, packet) == 0 && idx < 40) { // Limit for filter coefficients
        idx++;
        av_frame_unref(pFrame);
        av_frame_free(&pFrame);
        pFrame = av_frame_alloc();

        if (avcodec_send_packet(pCodecCtx, packet) < 0) {
            Plog::log(Plog::LogPriority::INFO, __FILE__, "Error submitting the packet to the decoder");
            break;
        }

        // Read frames from decoder
        while (avcodec_receive_frame(pCodecCtx, pFrame) == 0) {
            reverbExample_.feedInput(pFrame, "ir0");
        }
        av_packet_unref(packet);
    }

    reverbExample_.feedEOF("ir0");

    av_frame_unref(pFrame);
    av_frame_free(&pFrame);
    av_packet_unref(packet);
    av_packet_free(&packet);
    avcodec_close(pCodecCtx);
    avcodec_free_context(&pCodecCtx);
    avformat_close_input(&pFormatCtx_);
    avformat_free_context(pFormatCtx_);
}

void
ExampleAudioSubscriber::update(Observable<AVFrame*>*, AVFrame* const& pluginFrame) // Edit each audio frame with the application of the filter.
{
    if (!pluginFrame)
        return;

    if (firstRun) { // If this is the first run, initialize.
        setExampleDescription(pluginFrame->sample_rate, pluginFrame->nb_samples, pluginFrame->format);
        AudioFormat afmt_ = AudioFormat(pluginFrame->sample_rate,
                                        pluginFrame->ch_layout.nb_channels,
                                        static_cast<AVSampleFormat>(pluginFrame->format));
        AudioFormat irfmt_ = getIRAVFrameInfos();
        MediaStream ms_ = MediaStream("input", afmt_);
        MediaStream irms_ = MediaStream("ir0", irfmt_);
        reverbExample_.initialize(filterDescription_, {ms_, irms_});
        setIRAVFrame();
        firstRun = false;
    }

    if (!reverbExample_.initialized_)
        return;

    if (reverbExample_.feedInput(pluginFrame, "input") == 0) {
        AVFrame* filteredFrame = reverbExample_.readOutput();
        if (filteredFrame && filteredFrame->nb_samples == pluginFrame->nb_samples) {
            moveFrom(pluginFrame, filteredFrame); // Edit the frame, applying reverb.
            av_frame_unref(filteredFrame);
            av_frame_free(&filteredFrame);
        }
    }
}

void
ExampleAudioSubscriber::attached(Observable<AVFrame*>* observable)
{
    std::ostringstream oss;
    oss << "::Attached ! " << std::endl;
    Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
    observable_ = observable;
}

void
ExampleAudioSubscriber::detached(Observable<AVFrame*>*)
{
    reverbExample_.clean();
    firstRun = true;
    observable_ = nullptr;
    std::ostringstream oss;
    oss << "::Detached()" << std::endl;
    Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
}

void
ExampleAudioSubscriber::detach() // Detach from the audio stream.
{
    if (observable_) {
        reverbExample_.clean();
        firstRun = true;
        std::ostringstream oss;
        oss << "::Calling detach()" << std::endl;
        Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
        observable_->detach(this);
    }
}
} // namespace jami
