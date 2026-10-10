/**
 *  Copyright (C) 2023-2026 Savoir-faire Linux Inc.
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

// Translator lifecycle: constructor (EP selection + model loading),
// GPU-shutdown probes, destructor, and CPU-fallback reload.
//
// Other responsibilities are split into:
//   TranslatorVocab.cpp  — vocabulary loading and tokenizer helpers
//   TranslatorDecode.cpp — KV-cache greedy decode and beam-search inference
//   TranslatorText.cpp   — text preprocessing and the public translate() API

#include "Translator.h"
#include "TranslatorHelpers.h"

#include "pluglog.h"
#include "translatelog.h"

#include <sentencepiece_processor.h>
#include <fasttext/fasttext.h>

#ifdef __ANDROID__
// NNAPI symbol is resolved at runtime via dlsym (see NNAPI case below) rather
// than declared via <onnxruntime/providers/nnapi/nnapi_provider_factory.h> and
// linked directly. This lets the plugin build/run against an ORT contrib that
// hasn't been rebuilt with --use_nnapi yet (see daemon rules.mak), falling
// back to the next EP candidate instead of failing to build or link.
using OrtNnapiProviderFn = OrtStatus *(ORT_API_CALL *)(OrtSessionOptions *, uint32_t);
#endif

#ifndef _WIN32
#  include <dlfcn.h>
#endif
#include <bit>
#include <filesystem>
#include <thread>

namespace jami {
#pragma region EP name helper

    static const char *
    epName(const Translator::Device d) {
        switch (d) {
                using enum Translator::Device;
            case CUDA:
                return "CUDA";
            case MIGraphX:
                return "MIGraphX";
            case ROCm:
                return "ROCm";
            case OpenVINO:
                return "OpenVINO";
            case CoreML:
                return "CoreML";
            case DirectML:
                return "DirectML";
            case NNAPI:
                return "NNAPI";
            case QNN:
                return "QNN";
            case CPU:
                return "CPU";
            default:
                return "AUTO";
        }
    }

#pragma endregion

#pragma region Execution provider selection
    bool
    Translator::appendEP_(const Ort::SessionOptions &opts, const Device requested, Device &effectiveOut) {
        if (requested == Device::CPU) {
            effectiveOut = Device::CPU;
            return false;
        }

        const bool isAuto = (requested == Device::AUTO);
        std::vector<Device> candidates;
        if (isAuto) {
            using enum jami::Translator::Device;
#ifdef __ANDROID__
            candidates = {QNN, NNAPI};
#else
            candidates = {
                CUDA,
#ifdef __linux__
                MIGraphX,
#endif
                ROCm,
                OpenVINO,
#ifdef _WIN32
                DirectML,
#endif
#ifdef JAMI_PLUGIN_EP_COREML
                CoreML,
#endif
            };
#endif
        } else {
            candidates = {requested};
        }

        for (const Device ep: candidates) {
            try {
                switch (ep) {
                    case Device::CUDA: {
                        OrtCUDAProviderOptionsV2 *cudaOpts = nullptr;
                        Ort::ThrowOnError(Ort::GetApi().CreateCUDAProviderOptions(&cudaOpts));
                        constexpr std::array keys = {
                            "device_id",
                            "arena_extend_strategy",
                            "cudnn_conv_algo_search",
                            "do_copy_in_default_stream",
                            "cudnn_conv_use_max_workspace",
                            "cudnn_conv1d_pad_to_nc1d",
                        };
                        constexpr std::array vals = {"0", "kSameAsRequested", "HEURISTIC", "1", "0", "1"};
                        Ort::ThrowOnError(Ort::GetApi().UpdateCUDAProviderOptions(cudaOpts,
                            keys.data(),
                            vals.data(),
                            keys.size()));
                        Ort::ThrowOnError(Ort::GetApi().SessionOptionsAppendExecutionProvider_CUDA_V2(
                            static_cast<OrtSessionOptions *>(opts), cudaOpts));
                        Ort::GetApi().ReleaseCUDAProviderOptions(cudaOpts);
                        PLOG(Plog::LogPriority::INFO, TRANS_TAG, "CUDA execution provider enabled");
                        effectiveOut = Device::CUDA;
                        return true;
                    }
                    case Device::ROCm: {
                        OrtROCMProviderOptions rocmOpts{};
                        rocmOpts.device_id = 0;
                        Ort::ThrowOnError(Ort::GetApi().SessionOptionsAppendExecutionProvider_ROCM(
                            static_cast<OrtSessionOptions *>(opts), &rocmOpts));
                        PLOG(Plog::LogPriority::INFO, TRANS_TAG, "ROCm execution provider enabled");
                        effectiveOut = Device::ROCm;
                        return true;
                    }
#ifdef __linux__
                    case Device::MIGraphX: {
                        OrtMIGraphXProviderOptions mgxOpts{};
                        mgxOpts.device_id = 0;
                        Ort::ThrowOnError(Ort::GetApi().SessionOptionsAppendExecutionProvider_MIGraphX(
                            static_cast<OrtSessionOptions *>(opts), &mgxOpts));
                        PLOG(Plog::LogPriority::INFO, TRANS_TAG, "MIGraphX execution provider enabled");
                        effectiveOut = Device::MIGraphX;
                        return true;
                    }
#endif
#ifdef _WIN32
                    case Device::DirectML: {
                        Ort::ThrowOnError(Ort::GetApi().SessionOptionsAppendExecutionProvider(
                            static_cast<OrtSessionOptions *>(opts), "DML", nullptr, nullptr, 0));
                        PLOG(Plog::LogPriority::INFO, TRANS_TAG, "DirectML execution provider enabled");
                        effectiveOut = Device::DirectML;
                        return true;
                    }
#endif
#ifdef __ANDROID__
                    case Device::NNAPI: {
                        static const auto nnapiFn = reinterpret_cast<OrtNnapiProviderFn>(
                            dlsym(RTLD_DEFAULT, "OrtSessionOptionsAppendExecutionProvider_Nnapi"));
                        if (!nnapiFn) {
                            throw Ort::Exception(
                                "NNAPI provider not available (ORT contrib built without --use_nnapi)",
                                ORT_FAIL);
                        }
                        Ort::ThrowOnError(nnapiFn(static_cast<OrtSessionOptions *>(opts), 0u));
                        PLOG(Plog::LogPriority::INFO, TRANS_TAG, "NNAPI execution provider enabled");
                        effectiveOut = Device::NNAPI;
                        return true;
                    }
                    case Device::QNN: {
                        const char *keys[] = {"backend_path"};
                        const char *values[] = {"libQnnHtp.so"};
                        Ort::ThrowOnError(Ort::GetApi().SessionOptionsAppendExecutionProvider(
                            static_cast<OrtSessionOptions *>(opts), "QNN", keys, values, 1));
                        PLOG(Plog::LogPriority::INFO, TRANS_TAG, "QNN execution provider enabled");
                        effectiveOut = Device::QNN;
                        return true;
                    }
#endif
                    case Device::OpenVINO: {
                        OrtOpenVINOProviderOptions ovOpts{};
                        ovOpts.device_type = "GPU";
                        Ort::ThrowOnError(Ort::GetApi().SessionOptionsAppendExecutionProvider_OpenVINO(
                            static_cast<OrtSessionOptions *>(opts), &ovOpts));
                        PLOG(Plog::LogPriority::INFO,
                             TRANS_TAG,
                             "OpenVINO execution provider enabled (GPU)");
                        effectiveOut = Device::OpenVINO;
                        return true;
                    }
#ifdef JAMI_PLUGIN_EP_COREML
                    case Device::CoreML: {
                        Ort::ThrowOnError(Ort::GetApi().SessionOptionsAppendExecutionProvider_CoreML(
                            static_cast<OrtSessionOptions *>(opts), 0u));
                        PLOG(Plog::LogPriority::INFO, TRANS_TAG, "CoreML execution provider enabled");
                        effectiveOut = Device::CoreML;
                        return true;
                    }
#endif
                    default:
                        break;
                }
            } catch (const Ort::Exception &e) {
                PLOG(Plog::LogPriority::WARN, TRANS_TAG,
                     "{} EP unavailable: {}{}", epName(ep), e.what(),
                     isAuto ? " — trying next" : " — falling back to CPU");
            }
        }

        PLOG(Plog::LogPriority::INFO,
             TRANS_TAG,
             isAuto ? "No accelerator EP available — using CPU"
             : "Requested EP unavailable — using CPU");
        effectiveOut = Device::CPU;
        return false;
    }

#pragma endregion

#pragma region Constructor

    Translator::Translator(const std::string &modelsDir,
                           const std::string &targetLang,
                           const Device device,
                           const Quant quant)
        : targetToken_(toModelCode(targetLang))
          , quant_(quant) {
        loaderThread_ = std::jthread(
            [this, modelsDir, targetLang, device] { load_(modelsDir, targetLang, device); });
    }

#pragma endregion

#pragma region Model loading

    static bool
    hasKvVariant_(const std::filesystem::path &modelPath, const std::filesystem::path &base) {
        const auto stem = base.stem().string();
        return std::filesystem::exists(modelPath / base)
               || std::filesystem::exists(modelPath / (stem + "_int8.onnx"))
               || std::filesystem::exists(modelPath / (stem + "_fp16.onnx"));
    }

    // Model precision priority per EP (overridden by quant_ when != AUTO):
    //   CUDA / MIGraphX / ROCm / DirectML:  FP16 > FP32 > INT8
    //   OpenVINO / NNAPI / QNN:             INT8 > FP32
    //   CoreML:                             FP32 only (ANE does not handle QDQ INT8)
    //   CPU:                                INT8 > FP32
    std::filesystem::path
    Translator::pickModel_(const std::filesystem::path &modelPath,
                           const std::string &base,
                           const Device effectiveDevice) const {
        namespace fs = std::filesystem;
        auto basePath = modelPath / base;
        const auto stem = basePath.stem().string();
        auto fp16 = modelPath / (stem + "_fp16.onnx");
        auto i8 = modelPath / (stem + "_int8.onnx");

        if (quant_ != Quant::AUTO) {
            if (quant_ == Quant::FP16) {
                if (fs::exists(fp16)) {
                    PLOG(Plog::LogPriority::INFO, TRANS_TAG,
                         "Using FP16 model (forced): {}", fp16.string());
                    return fp16;
                }
                PLOG(Plog::LogPriority::WARN, TRANS_TAG,
                     "FP16 model not found for {}, using FP32", base);
                return basePath;
            }
            if (quant_ == Quant::INT8) {
                if (fs::exists(i8)) {
                    PLOG(Plog::LogPriority::INFO, TRANS_TAG,
                         "Using INT8 model (forced): {}", i8.string());
                    return i8;
                }
                PLOG(Plog::LogPriority::WARN, TRANS_TAG,
                     "INT8 model not found for {}, using FP32", base);
            }
            PLOG(Plog::LogPriority::INFO, TRANS_TAG,
                 "Using FP32 model (forced): {}", basePath.string());
            return basePath;
        }

        // AUTO: apply default priority per EP.
        switch (effectiveDevice) {
            case Device::CUDA:
            case Device::MIGraphX:
            case Device::ROCm:
            case Device::DirectML: {
                if (fs::exists(fp16)) {
                    PLOG(Plog::LogPriority::INFO, TRANS_TAG, "Using FP16 model: {}", fp16.string());
                    return fp16;
                }
                if (fs::exists(basePath)) {
                    return basePath; // FP32 preferred over INT8 on GPU
                }
                break;
            }
            case Device::OpenVINO:
            case Device::NNAPI:
            case Device::QNN: {
                if (fs::exists(i8)) {
                    PLOG(Plog::LogPriority::INFO, TRANS_TAG, "Using INT8 model: {}", i8.string());
                    return i8;
                }
                if (fs::exists(basePath)) {
                    return basePath;
                }
                break;
            }
            case Device::CoreML: {
                if (fs::exists(basePath)) {
                    return basePath;
                }
                break;
            }
            default:
                break;
        }
        // CPU and fallback: INT8 > FP32
        if (fs::exists(i8)) {
            PLOG(Plog::LogPriority::INFO, TRANS_TAG, "Using INT8 model: {}", i8.string());
            return i8;
        }
        return basePath;
    }

    // pickKvModel_: selects INT8 > FP32 (never FP16) for split KV-cache sessions.
    //
    // NOTE: FP16 is intentionally skipped for every session in the KV-cache path.
    // ORT cannot automatically cast GPU tensors between sessions: the encoder
    // outputs float16 hidden states but the INT8/FP32 KV decoders expect float32
    // inputs, producing garbage output. All sessions (encoder + both decoders)
    // must therefore use the same numeric type, so we apply the no-FP16 policy
    // uniformly when split KV-cache files are present.
    std::filesystem::path
    Translator::pickKvModel_(const std::filesystem::path &modelPath, const std::string &base) const {
        namespace fs = std::filesystem;
        auto basePath = modelPath / base;
        const auto stem = basePath.stem().string();
        auto i8 = modelPath / (stem + "_int8.onnx");

        if (quant_ == Quant::INT8) {
            if (fs::exists(i8)) {
                return i8;
            }
            PLOG(Plog::LogPriority::WARN, TRANS_TAG,
                 "INT8 KV model not found for {}, using FP32", base);
            return basePath;
        }
        if (quant_ == Quant::FP16) {
            // FP16 is unsupported across split sessions — fall through to INT8 > FP32.
            PLOG(Plog::LogPriority::WARN, TRANS_TAG,
                 "FP16 is incompatible with split KV-cache sessions (ORT cannot "
                 "cast GPU tensors between sessions); using INT8/FP32 for {}", base);
        }
        if (quant_ == Quant::FP32) {
            return basePath;
        }
        // AUTO and FP16 override: INT8 > FP32 (GPU and CPU alike).
        if (fs::exists(i8)) {
            PLOG(Plog::LogPriority::INFO, TRANS_TAG, "Using INT8 KV model: {}", i8.string());
            return i8;
        }
        return basePath;
    }

    std::unique_ptr<Ort::Session>
    Translator::loadSession_(const std::filesystem::path &modelPath,
                             const std::string &base,
                             const Ort::SessionOptions &opts,
                             const Device effectiveDevice) {
        namespace fs = std::filesystem;
        const auto chosen = pickModel_(modelPath, base, effectiveDevice);
        const auto fp32 = modelPath / base;
        try {
            return std::make_unique<Ort::Session>(ortEnv_, chosen.c_str(), opts);
        } catch (const Ort::Exception &e) {
            if (chosen != fp32 && fs::exists(fp32)) {
                PLOG(Plog::LogPriority::WARN, TRANS_TAG,
                     "Quantized model failed, falling back to FP32 for {}: {}", base, e.what());
                return std::make_unique<Ort::Session>(ortEnv_, fp32.c_str(), opts);
            }
            throw;
        }
    }

    std::unique_ptr<Ort::Session>
    Translator::loadKvCompatSession_(const std::filesystem::path &modelPath,
                                     const std::string &base,
                                     const Ort::SessionOptions &opts) {
        namespace fs = std::filesystem;
        const auto chosen = pickKvModel_(modelPath, base);
        const auto fp32 = modelPath / base;
        try {
            return std::make_unique<Ort::Session>(ortEnv_, chosen.c_str(), opts);
        } catch (const Ort::Exception &e) {
            if (chosen != fp32) {
                PLOG(Plog::LogPriority::WARN, TRANS_TAG,
                     "KV quantized model failed, falling back to FP32 for {}: {}", base, e.what());
                return std::make_unique<Ort::Session>(ortEnv_, fp32.c_str(), opts);
            }
            throw;
        }
    }

    bool
    Translator::loadKvSessions_(const std::filesystem::path &modelPath,
                                const Ort::SessionOptions &opts) {
        namespace fs = std::filesystem;
        const auto initKvPath = pickKvModel_(modelPath, "decoder_init_kv_model.onnx");
        const auto withPastPath = pickKvModel_(modelPath, "decoder_with_past_model.onnx");
        const auto initKvFp32 = modelPath / "decoder_init_kv_model.onnx";
        const auto withPastFp32 = modelPath / "decoder_with_past_model.onnx";
        if (!fs::exists(initKvPath) || !fs::exists(withPastPath)) {
            return false;
        }

        auto tryLoadKv = [&](const fs::path &initPath, const fs::path &wpPath) {
            decoderInitKv_ = std::make_unique<Ort::Session>(ortEnv_, initPath.c_str(), opts);
            decoderWithPast_ = std::make_unique<Ort::Session>(ortEnv_, wpPath.c_str(), opts);
        };

        try {
            tryLoadKv(initKvPath, withPastPath);
            return true;
        } catch (const Ort::Exception &e) {
            decoderInitKv_.reset();
            decoderWithPast_.reset();
            const bool hasFp32 = fs::exists(initKvFp32) && fs::exists(withPastFp32);
            const bool canRetry = (initKvPath != initKvFp32 || withPastPath != withPastFp32) && hasFp32;
            if (!canRetry) {
                PLOG(Plog::LogPriority::WARN, TRANS_TAG,
                     "KV cache models failed (no usable variant), falling back to beam search: {}", e.what());
                return false;
            }
            PLOG(Plog::LogPriority::WARN, TRANS_TAG,
                 "KV quantized models failed, retrying with FP32: {}", e.what());
            try {
                tryLoadKv(initKvFp32, withPastFp32);
                return true;
            } catch (const Ort::Exception &e2) {
                decoderInitKv_.reset();
                decoderWithPast_.reset();
                PLOG(Plog::LogPriority::WARN, TRANS_TAG,
                     "KV FP32 models also failed, falling back to beam search: {}", e2.what());
                return false;
            }
        }
    }

    void
    Translator::setupKvDecoder_() {
        numKvLayers_ = (static_cast<int>(decoderInitKv_->GetOutputCount()) - 1) / 4;
        buildKvNames();
        beam_ = 1;
        beamBatch_ = 1;
    }

    void
    Translator::loadSessionsInner_(const std::filesystem::path &modelPath,
                                   const std::string &targetLang,
                                   const Ort::SessionOptions &opts,
                                   const Device effectiveDevice,
                                   const bool hasKvFiles) {
        namespace fs = std::filesystem;
        // Use KV-compatible loader (no FP16) when KV-cache files exist so that
        // all sessions share the same numeric type and GPU tensors are compatible.
        encoder_ = hasKvFiles
                       ? loadKvCompatSession_(modelPath, "encoder_model.onnx", opts)
                       : loadSession_(modelPath, "encoder_model.onnx", opts, effectiveDevice);

        // All supported models use SentencePiece; file name varies:
        //   NLLB / M2M / MBart-50:  sentencepiece.bpe.model
        //   legacy:                 source.spm
        srcSpm_ = std::make_shared<sentencepiece::SentencePieceProcessor>();
        sentencepiece::util::Status status;
        if (fs::exists(modelPath / "sentencepiece.bpe.model")) {
            status = srcSpm_->Load((modelPath / "sentencepiece.bpe.model").string());
        } else if (fs::exists(modelPath / "spiece.model")) {
            status = srcSpm_->Load((modelPath / "spiece.model").string());
        } else {
            status = srcSpm_->Load((modelPath / "source.spm").string());
        }
        if (!status.ok()) {
            throw std::runtime_error("Failed to load tokenizer: " + status.ToString());
        }
        tgtSpm_ = srcSpm_;

        if (fs::exists(modelPath / "shared_vocabulary.json")) {
            loadVocab((modelPath / "shared_vocabulary.json").string());
        }
        targetLangId_ = lookupToken(targetToken_);

        // KV cache models (greedy O(n)) — preferred when both files exist.
        // pickKvModel_ / loadKvCompatSession_ ensure all sessions share the same
        // numeric type (no FP16 mismatch between encoder and KV decoders).
        if (loadKvSessions_(modelPath, opts)) {
            setupKvDecoder_();
            PLOG(Plog::LogPriority::INFO, TRANS_TAG,
                 "KV cache enabled: {} layers, greedy decode (O(n) attention)", numKvLayers_);
        } else {
            // Beam search fallback (no KV cache files, or all variants failed).
            if (!hasKvVariant_(modelPath, "decoder_model.onnx")) {
                throw Ort::Exception(
                    std::format("No usable decoder found in {} — install decoder_model_int8.onnx or "
                                "decoder_model.onnx (+.onnx.data)", modelPath.string()),
                    OrtErrorCode::ORT_NO_MODEL);
            }
            decoder_ = loadSession_(modelPath, "decoder_model.onnx", opts, effectiveDevice);
        }

        device_ = effectiveDevice;
        PLOG(Plog::LogPriority::INFO, TRANS_TAG,
             "Sessions loaded: {} ({}) id={}", targetLang, targetToken_, targetLangId_);
    }

    void
    Translator::loadSessions_(const std::filesystem::path &modelPath,
                              const std::string &targetLang,
                              Ort::SessionOptions &opts,
                              Device &effectiveDevice,
                              const bool hasKvFiles) {
        for (;;) {
            try {
                loadSessionsInner_(modelPath, targetLang, opts, effectiveDevice, hasKvFiles);
                break;
            } catch (const Ort::Exception &e) {
                if (effectiveDevice != Device::CPU) {
                    PLOG(Plog::LogPriority::WARN, TRANS_TAG,
                         "GPU session load failed (OOM?), retrying on CPU: {}", e.what());
                    encoder_.reset();
                    decoderInitKv_.reset();
                    decoderWithPast_.reset();
                    decoder_.reset();
                    numKvLayers_ = 0;
                    ready_.store(false);
                    const auto cpuThreads = static_cast<int>(std::thread::hardware_concurrency());
                    Ort::SessionOptions cpuOpts;
                    cpuOpts.SetIntraOpNumThreads(cpuThreads);
                    cpuOpts.SetInterOpNumThreads(cpuThreads);
                    cpuOpts.SetExecutionMode(ExecutionMode::ORT_PARALLEL);
                    cpuOpts.SetGraphOptimizationLevel(GraphOptimizationLevel::ORT_ENABLE_ALL);
                    cpuOpts.SetLogSeverityLevel(3);
                    opts = std::move(cpuOpts);
                    effectiveDevice = Device::CPU;
                    beam_ = 4;
                    beamBatch_ = 4;
                } else {
                    throw;
                }
            }
        }
    }

    void
    Translator::load_(const std::string &modelsDir,
                      const std::string &targetLang,
                      const Device device) {
        // ORT environment and memory-info creation can trigger CUDA/driver probing on first
        // call — keep this on the loader thread so the plugin-init path stays non-blocking.
        ortEnv_ = Ort::Env(ORT_LOGGING_LEVEL_WARNING, "Translator");
        memInfo_ = Ort::MemoryInfo::CreateCpu(OrtArenaAllocator, OrtMemTypeDefault);

        namespace fs = std::filesystem;
        const auto modelPath = fs::path(modelsDir) / modelName();
        modelsPath_ = modelPath.string();
        PLOG(Plog::LogPriority::INFO, TRANS_TAG,
             "Loading translation model [{}] from {}", modelName(), modelPath.string());

        if (!fs::exists(modelPath / "encoder_model.onnx")
            && !fs::exists(modelPath / "encoder_model_int8.onnx")
            && !fs::exists(modelPath / "encoder_model_fp16.onnx")) {
            PLOG(Plog::LogPriority::WARN, TRANS_TAG,
                 "ONNX model not found at {} — run download_model.sh to export. Translation disabled.",
                 modelPath.string());
            terminated_.store(true);
            loaderDone_.store(true);
            loaderCv_.notify_all();
            return;
        }

        // GPU: small beam fits all beams in one ORT call per step.
        // CPU: larger beam for quality; beams batched together.
        beam_ = device == Device::CPU ? 4 : 2;
        beamBatch_ = beam_;

        auto effectiveDevice = Device::CPU;

        try {
            Ort::SessionOptions opts;
            const auto cpuThreads = static_cast<int>(std::thread::hardware_concurrency());
            opts.SetGraphOptimizationLevel(GraphOptimizationLevel::ORT_ENABLE_ALL);
            opts.SetLogSeverityLevel(3);

            if (const bool hasAccel = appendEP_(opts, device, effectiveDevice); !hasAccel) {
                opts.SetIntraOpNumThreads(cpuThreads);
                opts.SetInterOpNumThreads(cpuThreads);
                opts.SetExecutionMode(ExecutionMode::ORT_PARALLEL);
            } else {
                opts.SetIntraOpNumThreads(4);
            }

            const bool hasKvFiles = hasKvVariant_(modelPath, "decoder_init_kv_model.onnx")
                                    && hasKvVariant_(modelPath, "decoder_with_past_model.onnx");
            loadSessions_(modelPath, targetLang, opts, effectiveDevice, hasKvFiles);

            if (const auto lidPath = modelPath / "lid.176.ftz"; fs::exists(lidPath)) {
                lid_ = std::make_unique<fasttext::FastText>();
                lid_->loadModel(lidPath.string());
                PLOG(Plog::LogPriority::INFO, TRANS_TAG, "LID model loaded");
            } else {
                PLOG(Plog::LogPriority::WARN, TRANS_TAG,
                     "LID model not found — source lang defaults to {}", modelFallbackLang());
            }

            // All state (sessions, LID, device_) is fully initialised — signal ready.
            {
                std::lock_guard lk(loaderMutex_);
                ready_.store(true);
            }
            PLOG(Plog::LogPriority::INFO, TRANS_TAG,
                 "Translator ready: {} → {}", targetLang, targetToken_);
        } catch (const Ort::Exception &e) {
            PLOG(Plog::LogPriority::ERR, TRANS_TAG, "ORT init failed: {}", e.what());
        } catch (const std::exception &e) {
            PLOG(Plog::LogPriority::ERR, TRANS_TAG,
                 "Failed to load translation model: {}", e.what());
        }

        // Wake waitReady() regardless of success or failure so the worker never
        // blocks forever.  loaderDone_ ensures it also unblocks after resetTerminate()
        // has cleared terminated_ (e.g. when the worker is rebuilt after a pref change).
        loaderDone_.store(true);
        loaderCv_.notify_all();
    }

#pragma endregion

#pragma region GPU-shutdown probes
    // ORT is compiled with ORT_NO_EXCEPTIONS so ORT_CXX_API_THROW calls abort()
    // instead of throwing.  If the GPU driver is already shutting down when our
    // destructor runs (process exit), OrtRelease/ReleaseSession will abort().
    // We probe the driver *before* touching any ORT object so we can null out raw
    // handles (via Ort::Base::release()) and avoid calling OrtRelease on live GPU
    // objects after the driver is gone.

    static bool
    probeCuda() {
#ifdef _WIN32
        // Use the CUDA driver DLL — present on any machine with an NVIDIA driver.
        HMODULE h = LoadLibraryA("nvcuda.dll");
        if (!h)
            return false;
        FreeLibrary(h);
        return true;
#else
        using Fn = int (*)(int *); // cudaError_t cudaGetDeviceCount(int*)
        for (const char *name:
             {"libcudart.so.12", "libcudart.so.11.0", "libcudart.so.10.2", "libcudart.so"}) {
            void *h = dlopen(name, RTLD_NOLOAD | RTLD_LAZY);
            if (!h)
                continue;
            bool alive = false;
            if (const auto fn = std::bit_cast<Fn>(dlsym(h, "cudaGetDeviceCount"))) {
                int n = 0;
                alive = (fn(&n) == 0);
            }
            dlclose(h);
            return alive;
        }
        return false;
#endif
    }

    static bool
    probeRocm() {
#ifdef _WIN32
        return false; // ROCm is Linux-only
#else
        using Fn = int (*)(int *); // hipError_t hipGetDeviceCount(int*)
        for (const char *name: {"libamdhip64.so.6", "libamdhip64.so.5", "libamdhip64.so"}) {
            void *h = dlopen(name, RTLD_NOLOAD | RTLD_LAZY);
            if (!h)
                continue;
            bool alive = false;
            if (const auto fn = std::bit_cast<Fn>(dlsym(h, "hipGetDeviceCount"))) {
                int n = 0;
                alive = (fn(&n) == 0);
            }
            dlclose(h);
            return alive;
        }
        return false;
#endif
    }

    static bool
    isGpuBackendOperational(const Translator::Device device) {
        switch (device) {
                using enum Translator::Device;
            case CUDA:
                return probeCuda();
            case ROCm:
                return probeRocm();
            case AUTO:
                return probeCuda() || probeRocm(); // safety net
            case OpenVINO:
            case CoreML:
            case CPU:
            default:
                return true; // no CUDA/ROCm pinned memory involved
        }
    }

#pragma endregion

#pragma region Termination

    void
    Translator::terminate() noexcept {
        // Set our own flag first so the pre-Run() guard in TranslatorDecode.cpp
        // stops submitting new kernels immediately.
        terminated_.store(true);
        // Also request ORT to abort any Run() that is already in flight.
        // NOTE: on some ORT builds passing a pre-terminated RunOptions to Run()
        // causes a crash on entry.  Our pre-Run() guard (isTerminated() check in
        // TranslatorDecode.cpp) prevents that race window; SetTerminate() handles
        // only the case where Run() was entered before terminate() was called.
        try {
            runOptions_.SetTerminate();
        } catch (const Ort::Exception &e) {
            PLOG(Plog::LogPriority::WARN, TRANS_TAG,
                 "terminate: SetTerminate failed: {}", e.what());
        }
        // Wake any thread blocked in waitReady() so it can observe terminated_=true
        // and return without waiting for loading to complete.
        loaderCv_.notify_all();
    }

    bool
    Translator::waitReady() {
        std::unique_lock lk(loaderMutex_);
        loaderCv_.wait(lk, [this] {
            return ready_.load()
                   || terminated_.load()
                   || loaderDone_.load();
        });
        return ready_.load();
    }

    void
    Translator::resetTerminate() {
        terminated_.store(false);
        try {
            runOptions_.UnsetTerminate();
        } catch (const Ort::Exception &e) {
            PLOG(Plog::LogPriority::WARN, TRANS_TAG,
                 "resetTerminate: UnsetTerminate failed: {}", e.what());
        }
    }

#pragma endregion

#pragma region Destructor

    Translator::~Translator() {
        // Join the background loader before touching any ORT object.
        // terminate() is idempotent; if already called (e.g. from TranslationWorker
        // destructor), this is a no-op for the flag and just ensures loaderCv_ fires.
        if (loaderThread_.joinable()) {
            terminate();
            loaderThread_.join();
        }

        // GPU-shutdown crash prevention — see isGpuBackendOperational() above.
        // If the driver is still alive: destroy sessions normally (frees GPU memory).
        // If the driver is shutting down: call Ort::Base::release() to null out each
        // raw handle so ~Base() calls OrtRelease(nullptr) → delete nullptr → no-op.
        // The OS reclaims GPU memory on process exit anyway.

        decoderBufCache_.decIn.clear(); // CPU tensors — always safe

        const bool gpuShuttingDown = !isGpuBackendOperational(device_);

        auto safeResetSession = [&](std::unique_ptr<Ort::Session> &s) {
            if (!s)
                return;
            if (gpuShuttingDown)
                (void) s->release(); // Ort::Base::release() → p_ = nullptr
            s.reset(); // ~Session() → OrtRelease(p_); nullptr ⟹ no-op
        };

        safeResetSession(decoderWithPast_);
        safeResetSession(decoderInitKv_);
        safeResetSession(decoder_);
        safeResetSession(encoder_);

        // memInfo_ is CPU-only — always safe.
        {
            const Ort::MemoryInfo tmp(std::move(memInfo_));
            (void) tmp;
        }

        // ortEnv_ holds the GPU EP; same strategy.
        if (gpuShuttingDown)
            (void) ortEnv_.release();
        else {
            const Ort::Env tmp(std::move(ortEnv_));
            (void) tmp;
        }
    }

#pragma endregion

#pragma region CPU-fallback reload

    std::unique_ptr<Ort::Session>
    Translator::reloadCpuSession_(const std::filesystem::path &modelPath,
                                  const std::string &base,
                                  const Ort::SessionOptions &opts) {
        namespace fs = std::filesystem;
        auto basePath = modelPath / base;
        const auto stem = basePath.stem().string();
        const auto i8 = modelPath / (stem + "_int8.onnx");
        const auto chosen = fs::exists(i8) ? i8 : basePath;
        try {
            return std::make_unique<Ort::Session>(ortEnv_, chosen.c_str(), opts);
        } catch (const Ort::Exception &e) {
            if (chosen != basePath) {
                PLOG(Plog::LogPriority::WARN, TRANS_TAG,
                     "INT8 failed on CPU reload, trying FP32 for {}: {}", base, e.what());
                return std::make_unique<Ort::Session>(ortEnv_, basePath.c_str(), opts);
            }
            throw;
        }
    }

    bool
    Translator::reloadOnCPU_() {
        namespace fs = std::filesystem;
        if (modelsPath_.empty()) {
            return false;
        }

        PLOG(Plog::LogPriority::WARN,
             TRANS_TAG,
             "GPU OOM during inference — reloading all sessions on CPU");

        encoder_.reset();
        decoderInitKv_.reset();
        decoderWithPast_.reset();
        decoder_.reset();
        numKvLayers_ = 0;
        ready_.store(false);

        try {
            const auto modelPath = fs::path(modelsPath_);

            Ort::SessionOptions opts;
            const auto cpuThreads = static_cast<int>(std::thread::hardware_concurrency());
            opts.SetIntraOpNumThreads(cpuThreads);
            opts.SetInterOpNumThreads(cpuThreads);
            opts.SetExecutionMode(ExecutionMode::ORT_PARALLEL);
            opts.SetGraphOptimizationLevel(GraphOptimizationLevel::ORT_ENABLE_ALL);
            opts.SetLogSeverityLevel(3);

            encoder_ = reloadCpuSession_(modelPath, "encoder_model.onnx", opts);

            if (hasKvVariant_(modelPath, "decoder_init_kv_model.onnx")
                && hasKvVariant_(modelPath, "decoder_with_past_model.onnx")) {
                decoderInitKv_ = reloadCpuSession_(modelPath, "decoder_init_kv_model.onnx", opts);
                decoderWithPast_ = reloadCpuSession_(modelPath, "decoder_with_past_model.onnx", opts);
                setupKvDecoder_();
            } else {
                decoder_ = reloadCpuSession_(modelPath, "decoder_model.onnx", opts);
                beam_ = 4;
                beamBatch_ = 4;
            }

            ready_.store(true);
            device_ = Device::CPU;
            PLOG(Plog::LogPriority::INFO, TRANS_TAG, "CPU reload successful after GPU OOM");
            return true;
        } catch (const std::exception &e) {
            PLOG(Plog::LogPriority::ERR, TRANS_TAG, "CPU reload failed: {}", e.what());
            return false;
        }
    }
#pragma endregion
} // namespace jami
