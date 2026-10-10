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
 *  Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301
 * USA.
 */

#include "pluginProcessor.h"

#include <opencv2/imgproc.hpp>
extern "C" {
#include <libavutil/display.h>
}
#include <frameUtils.h>
#include <pluglog.h>
#include <common.h>

const char sep = separator();

const std::string TAG = "FORESEG";

namespace jami {

PluginProcessor::PluginProcessor(const std::string& model, bool acc)
{
    initModel(model, acc);
}

PluginProcessor::~PluginProcessor()
{
    mainFilter_.clean();
    Plog::log(Plog::LogPriority::INFO, TAG, "~pluginprocessor");
    if (session_) {
        delete session_;
        session_ = nullptr;
    }
    // OrtEnv::~OrtEnv crashes during Jami's shutdown sequence (global state teardown
    // races with the env's internal thread synchronisation). Null out the underlying
    // C pointer before the optional<Ort::Env> member destructor fires so that
    // ~Base<OrtEnv> calls OrtReleaseEnv(nullptr) — a no-op. The OrtEnv leaks, but
    // the OS reclaims all memory on process exit.
    if (env_)
        env_->release();
}

void
PluginProcessor::initModel(const std::string& modelPath, bool activateAcc)
{
    // Create the ORT env with a 1-thread global pool so OrtReleaseEnv does not try
    // to join background worker threads on destruction. By default Ort::Env spins up
    // N threads (one per CPU core); joining them during Jami's shutdown sequence
    // consistently segfaults inside OrtEnv::~OrtEnv.
    if (!env_) {
        Ort::ThreadingOptions tp;
        tp.SetGlobalIntraOpNumThreads(1);
        tp.SetGlobalInterOpNumThreads(1);
        env_.emplace(static_cast<const OrtThreadingOptions*>(tp), ORT_LOGGING_LEVEL_WARNING, "test");
    }

    try {
        auto allocator_info = Ort::MemoryInfo::CreateCpu(OrtArenaAllocator, OrtMemTypeDefault);
        input_tensor_ = Ort::Value::CreateTensor<float>(allocator_info,
                                                        input_image_.data(),
                                                        input_image_.size(),
                                                        input_shape_.data(),
                                                        input_shape_.size());
        output_tensor_ = Ort::Value::CreateTensor<float>(allocator_info,
                                                         results_.data(),
                                                         results_.size(),
                                                         output_shape_.data(),
                                                         output_shape_.size());
        sessOpt_ = Ort::SessionOptions();
        sessOpt_.SetIntraOpNumThreads(1);
        sessOpt_.DisablePerSessionThreads();

#ifdef NVIDIA
        if (activateAcc)
            Ort::ThrowOnError(OrtSessionOptionsAppendExecutionProvider_CUDA(sessOpt_, 0));
#endif
#ifdef __ANDROID__
        if (activateAcc)
            Ort::ThrowOnError(OrtSessionOptionsAppendExecutionProvider_Nnapi(sessOpt_, 0));
#endif

        sessOpt_.SetGraphOptimizationLevel(GraphOptimizationLevel::ORT_ENABLE_ALL);
#ifdef WIN32
        session_ = new Ort::Session(*env_, string_utils::to_wstring(modelPath).c_str(), sessOpt_);
#else
        session_ = new Ort::Session(*env_, modelPath.c_str(), sessOpt_);
#endif
        isAllocated_ = true;
        Plog::log(Plog::LogPriority::INFO, TAG, "Model is allocated");
    } catch (std::exception& e) {
        Plog::log(Plog::LogPriority::ERR, TAG, e.what());
    }
}

void
PluginProcessor::feedInput(AVFrame* input)
{
    cv::Mat frame = cv::Mat {
        input->height,
        input->width,
        CV_8UC3,
        input->data[0],
        static_cast<size_t>(
            input->linesize[0])}; // not zero input->linesize[0] leads to non continuous data
    cvFrame_ = frame.clone();     // this is done to have continuous data
    cv::Mat temp(modelInputDimensions.first,
                 modelInputDimensions.second,
                 CV_32FC3,
                 input_image_.data());
    cvFrame_.convertTo(temp, CV_32FC3);
}

void
PluginProcessor::computePredictions()
{
    if (count_ == 0) {
        // Run the graph
        session_->Run(Ort::RunOptions {nullptr},
                      modelInputNames,
                      &input_tensor_,
                      1,
                      modelOutputNames,
                      &output_tensor_,
                      1);
        computedMask_ = std::vector(results_.begin(), results_.end());
    }
}

void
PluginProcessor::printMask()
{
    std::ostringstream oss;
    for (size_t i = 0; i < computedMask_.size(); i++) {
        // Log the predictions
        if (computedMask_[i] > 2) {
            oss << computedMask_[i] << " " << std::endl;
        }
    }
    Plog::log(Plog::LogPriority::INFO, TAG, oss.str());
}

void
PluginProcessor::resetInitValues()
{
    previousMasks_[0] = previousMasks_[1] = cv::Mat(modelInputDimensions.first,
                                                    modelInputDimensions.second,
                                                    CV_32FC1,
                                                    double(0.));
    kSize_ = cv::Size(modelInputDimensions.first * kernelSize_,
                      modelInputDimensions.second * kernelSize_);
    if (kSize_.height % 2 == 0) {
        kSize_.height -= 1;
    }
    if (kSize_.width % 2 == 0) {
        kSize_.width -= 1;
    }
    count_ = 0;
    grabCutMode_ = cv::GC_INIT_WITH_MASK;
    grabCutIterations_ = 4;
}

void
PluginProcessor::drawMaskOnFrame(AVFrame* frame, AVFrame* frameReduced, int angle)
{
    if (computedMask_.empty() || !mainFilter_.initialized_)
        return;

    if (count_ == 0) {
        int maskSize = static_cast<int>(std::sqrt(computedMask_.size()));
        cv::Mat maskImg(maskSize, maskSize, CV_32FC1, computedMask_.data());

        cv::resize(maskImg,
                   maskImg,
                   cv::Size(modelInputDimensions.first, modelInputDimensions.second));

        double m, M;
        cv::minMaxLoc(maskImg, &m, &M);
        bool improveMask = !isBlur_;
        if (M < 2) { // avoid detection if there isn't anyone in frame
            maskImg = 0. * maskImg;
            improveMask = false;
        } else {
            for (int i = 0; i < maskImg.cols; i++) {
                for (int j = 0; j < maskImg.rows; j++) {
                    maskImg.at<float>(j, i) = (maskImg.at<float>(j, i) - m) / (M - m);

                    if (maskImg.at<float>(j, i) < 0.4)
                        maskImg.at<float>(j, i) = 0.;
                    else if (maskImg.at<float>(j, i) < 0.7) {
                        float value = maskImg.at<float>(j, i) * smoothFactors_[0]
                                      + previousMasks_[0].at<float>(j, i) * smoothFactors_[1]
                                      + previousMasks_[1].at<float>(j, i) * smoothFactors_[2];
                        maskImg.at<float>(j, i) = 0.;
                        if (value > 0.7)
                            maskImg.at<float>(j, i) = 1.;
                    } else
                        maskImg.at<float>(j, i) = 1.;
                }
            }
        }

        if (improveMask) {
            cv::Mat dilate;
            cv::dilate(maskImg,
                       dilate,
                       cv::getStructuringElement(cv::MORPH_ELLIPSE, kSize_),
                       cv::Point(-1, -1),
                       2);
            cv::erode(maskImg,
                      maskImg,
                      cv::getStructuringElement(cv::MORPH_ELLIPSE, kSize_),
                      cv::Point(-1, -1),
                      2);
            for (int i = 0; i < maskImg.cols; i++) {
                for (int j = 0; j < maskImg.rows; j++) {
                    if (dilate.at<float>(j, i) != maskImg.at<float>(j, i))
                        maskImg.at<float>(j, i) = grabcutClass_;
                }
            }
            cv::Mat applyMask = cvFrame_.clone();
            maskImg.convertTo(maskImg, CV_8UC1);
            applyMask.convertTo(applyMask, CV_8UC1);
            cv::Rect rect(1, 1, maskImg.rows, maskImg.cols);
            cv::grabCut(applyMask,
                        maskImg,
                        rect,
                        bgdModel_,
                        fgdModel_,
                        grabCutIterations_,
                        grabCutMode_);

            grabCutMode_ = cv::GC_EVAL;
            grabCutIterations_ = 1;

            maskImg = maskImg & 1;
            maskImg.convertTo(maskImg, CV_32FC1);
            maskImg *= 255.;
            blur(maskImg, maskImg, cv::Size(7, 7)); // float mask from 0 to 255.
            maskImg = maskImg / 255.;
        }

        previousMasks_[1] = previousMasks_[0].clone();
        previousMasks_[0] = maskImg.clone();
    }

    cv::Mat roiMaskImg = previousMasks_[0].clone() * 255.;
    roiMaskImg.convertTo(roiMaskImg, CV_8UC1);

    uniqueFramePtr maskFrame = {av_frame_alloc(), frameFree};
    maskFrame->format = AV_PIX_FMT_GRAY8;
    maskFrame->width = roiMaskImg.cols;
    maskFrame->height = roiMaskImg.rows;
    maskFrame->linesize[0] = roiMaskImg.step;
    if (av_frame_get_buffer(maskFrame.get(), 0) < 0)
        return;

    maskFrame->data[0] = roiMaskImg.data;
    maskFrame->pts = 1;
    mainFilter_.feedInput(maskFrame.get(), "mask");
    maskFrame.reset();

    if (isBlur_)
        mainFilter_.feedInput(frameReduced, "input");
    mainFilter_.feedInput(frame, "input2");
    AVFrame* filteredFrame;
    if ((filteredFrame = mainFilter_.readOutput())) {
        moveFrom(frame, filteredFrame);
        frameFree(filteredFrame);
    }
    count_++;
    count_ = count_ % frameCount_;
}

MediaStream
PluginProcessor::getbgAVFrameInfos()
{
    // Reset the stream index so a stale value from a previous background can never
    // leak into loadBackground() and be used as an out-of-range stream index.
    videoStream_ = -1;
    AVFormatContext* ctx = avformat_alloc_context();
    // Open
    if (avformat_open_input(&ctx, backgroundPath_.c_str(), NULL, NULL) != 0) {
        avformat_free_context(ctx);
        Plog::log(Plog::LogPriority::INFO, TAG, "Couldn't open input stream.");
        return {};
    }
    pFormatCtx_.reset(ctx);
    // Retrieve stream information
    if (avformat_find_stream_info(pFormatCtx_.get(), NULL) < 0) {
        Plog::log(Plog::LogPriority::INFO, TAG, "Couldn't find stream information.");
        return {};
    }

    // Dump valid information onto standard error
    av_dump_format(pFormatCtx_.get(), 0, backgroundPath_.c_str(), false);

    // Find the video stream
    for (int i = 0; i < static_cast<int>(pFormatCtx_->nb_streams); i++)
        if (pFormatCtx_->streams[i]->codecpar->codec_type == AVMEDIA_TYPE_VIDEO) {
            videoStream_ = i;
            break;
        }

    if (videoStream_ == -1) {
        Plog::log(Plog::LogPriority::INFO, TAG, "Didn't find a video stream.");
        return {};
    }

    rational<int> fr = pFormatCtx_->streams[videoStream_]->r_frame_rate;
    return MediaStream("background",
                       pFormatCtx_->streams[videoStream_]->codecpar->format,
                       1 / fr,
                       pFormatCtx_->streams[videoStream_]->codecpar->width,
                       pFormatCtx_->streams[videoStream_]->codecpar->height,
                       0,
                       fr);
}

void
PluginProcessor::loadBackground()
{
    if (backgroundPath_.empty())
        return;

    auto bgStream_ = getbgAVFrameInfos();
    // getbgAVFrameInfos() returns an empty MediaStream and leaves videoStream_ == -1
    // whenever the background media can't be opened/probed (missing file, bad path,
    // unsupported format...). Bail out here instead of dereferencing pFormatCtx_->
    // streams[videoStream_] below, which would be a null/out-of-range access and
    // crash the whole daemon.
    if (!bgStream_.isValid() || videoStream_ < 0 || !pFormatCtx_ || !pFormatCtx_->streams) {
        pFormatCtx_.reset();
        Plog::log(Plog::LogPriority::ERR,
                  TAG,
                  "Couldn't load background '" + backgroundPath_
                      + "', background replacement is disabled.");
        return;
    }

    if (mainFilter_.initialize(mainFilterDescription_, {maskms_, bgStream_, ims2_}) < 0)
        return;

    AVCodecContext* pCodecCtx;
    AVPacket* packet;

    const AVCodec* pCodec = avcodec_find_decoder(
        pFormatCtx_->streams[videoStream_]->codecpar->codec_id);
    if (pCodec == nullptr) {
        mainFilter_.clean();
        pFormatCtx_.reset();
        Plog::log(Plog::LogPriority::INFO, TAG, "Codec not found.");
        return;
    }

    pCodecCtx = avcodec_alloc_context3(pCodec);
    // Open codec
    if (avcodec_open2(pCodecCtx, pCodec, NULL) < 0) {
        mainFilter_.clean();
        pFormatCtx_.reset();
        Plog::log(Plog::LogPriority::INFO, TAG, "Could not open codec.");
        return;
    }

    packet = av_packet_alloc();
    if (av_read_frame(pFormatCtx_.get(), packet) < 0) {
        mainFilter_.clean();
        avcodec_close(pCodecCtx);
        av_packet_free(&packet);
        pFormatCtx_.reset();
        Plog::log(Plog::LogPriority::INFO, TAG, "Could not read packet from context.");
        return;
    }

    if (avcodec_send_packet(pCodecCtx, packet) < 0) {
        avcodec_close(pCodecCtx);
        av_packet_free(&packet);
        pFormatCtx_.reset();
        Plog::log(Plog::LogPriority::INFO, TAG, "Could not send packet no codec.");
        return;
    }

    AVFrame* bgImage = av_frame_alloc();
    if (avcodec_receive_frame(pCodecCtx, bgImage) < 0) {
        avcodec_close(pCodecCtx);
        av_packet_free(&packet);
        pFormatCtx_.reset();
        mainFilter_.clean();
        Plog::log(Plog::LogPriority::INFO, TAG, "Could not read packet from codec.");
        return;
    }

    mainFilter_.feedInput(bgImage, "background");
    mainFilter_.feedEOF("background");

    frameFree(bgImage);
    avcodec_close(pCodecCtx);
    avcodec_free_context(&pCodecCtx);
    av_packet_unref(packet);
    av_packet_free(&packet);
    pFormatCtx_.reset();
}

void
PluginProcessor::initFilters(const std::pair<int, int>& inputSize, int format, int angle)
{
    resetInitValues();
    mainFilter_.clean();

    std::string rotateSides = "";
    std::string scaleSize = std::to_string(inputSize.first) + ":"
                            + std::to_string(inputSize.second);
    Plog::log(Plog::LogPriority::INFO, TAG, scaleSize);
    if (std::abs(angle) == 90) {
        rotateSides = ":out_w=ih:out_h=iw";
        scaleSize = std::to_string(inputSize.second) + ":" + std::to_string(inputSize.first);
    }

    rational<int> fr(1, 1);
    ims_ = MediaStream("input",
                       AV_PIX_FMT_RGB24,
                       1 / fr,
                       modelInputDimensions.first,
                       modelInputDimensions.second,
                       0,
                       fr);
    ims2_ = MediaStream("input2", format, 1 / fr, inputSize.first, inputSize.second, 0, fr);

    maskms_ = MediaStream("mask",
                          AV_PIX_FMT_GRAY8,
                          1 / fr,
                          modelInputDimensions.first,
                          modelInputDimensions.second,
                          0,
                          fr);

    if (isBlur_) {
        mainFilterDescription_ = "[mask]negate[negated],[input][negated]alphamerge,boxblur="
                                 + blurLevel_ + ",scale=" + scaleSize
                                 + "[blured],[input2]format=rgb24,rotate=" + rotation[-angle]
                                 + rotateSides
                                 + "[input2formated],[input2formated][blured]overlay,rotate="
                                 + rotation[angle] + rotateSides;
        Plog::log(Plog::LogPriority::INFO, TAG, mainFilterDescription_);
        mainFilter_.initialize(mainFilterDescription_, {maskms_, ims_, ims2_});
    } else {
        mainFilterDescription_ = "[mask]scale=" + scaleSize
                                 + "[fgmask],[fgmask]split=2[bg][fg],[bg]negate[bgn],"
                                 + "[background]scale=" + scaleSize + "[backgroundformated],"
                                 + "[backgroundformated][bgn]alphamerge[background2],"
                                 + "[input2]rotate=" + rotation[-angle] + rotateSides
                                 + "[input2formated],[input2formated][fg]alphamerge[foreground],"
                                 + "[foreground][background2]overlay," + "rotate=" + rotation[angle]
                                 + rotateSides;
        Plog::log(Plog::LogPriority::INFO, TAG, mainFilterDescription_);
        loadBackground();
    }
}
} // namespace jami
