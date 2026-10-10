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

#pragma once

#include "LanguageCodes.h"

#include <onnxruntime_cxx_api.h>

#include <array>
#include <atomic>
#include <condition_variable>
#include <memory>
#include <mutex>
#include <string>
#include <filesystem>
#include <thread>
#include <unordered_map>
#include <vector>

namespace sentencepiece {
    class SentencePieceProcessor;
}

namespace fasttext {
    class FastText;
}

namespace jami {
    // Wraps ONNX Runtime + SentencePiece for local seq2seq translation.
    // Supports three models selected at compile time via JAMI_PLUGIN_TRANSLATION_MODEL:
    //   nllb200    — facebook/nllb-200-distilled-600M (default)
    //   m2m100     — facebook/m2m100_418M
    //   mbart50    — facebook/mbart-large-50-many-to-many-mmt
    //
    // Models must be exported via data/models/download_model.py.
    // GPU support: Device::AUTO probes execution providers at startup in order:
    //   Linux:   CUDA (NVIDIA) → MIGraphX (AMD) → ROCm (AMD) → OpenVINO (Intel) → CoreML (Apple) → CPU
    //   Windows: CUDA (NVIDIA) → DirectML (AMD/Intel/NVIDIA via DX12) → OpenVINO (Intel) → CPU
    //   Android: QNN (Qualcomm) → NNAPI → CPU
    // Each EP falls back gracefully if unavailable or if the ORT build lacks it.
    // CoreML is only compiled in when JAMI_PLUGIN_EP_COREML=1 (macOS / coreml EP build).
    class Translator {
    public:
        enum class Device { AUTO, CUDA, MIGraphX, ROCm, OpenVINO, CoreML, DirectML, NNAPI, QNN, CPU };

        // Quantization override. AUTO applies the default priority per EP:
        //   CUDA/MIGraphX/ROCm/DirectML: FP16 > FP32 > INT8
        //   OpenVINO/NNAPI/QNN: INT8 > FP32   CoreML: FP32 only   CPU: INT8 > FP32
        // Setting FP32/INT8/FP16 forces that variant (falls back to FP32 if not available).
        enum class Quant { AUTO, FP32, INT8, FP16 };

        // device=AUTO selects the best available EP at runtime (recommended).
        // device=CPU forces CPU unconditionally.
        // quant=AUTO applies the default priority for the selected EP.
        Translator(const std::string &modelsDir,
                   const std::string &targetLang,
                   Device device = Device::AUTO,
                   Quant quant = Quant::AUTO);

        ~Translator();

        // Returns translated text, or original text on failure / model not loaded.
        std::string translate(const std::string &text);

        // Batch translate multiple texts (GPU: vectorized, CPU: sequential).
        // Returns results in same order as input.
        std::vector<std::string> translateBatch(const std::vector<std::string> &texts);

        // Update target language without reloading the model.
        void setTargetLanguage(const std::string &lang);

        // Signal all currently-running Session::Run calls to terminate early.
        // Safe to call from any thread. Used by TranslationWorker to unblock the
        // worker thread when shutting down so thread_.join() returns promptly.
        void terminate() noexcept;

        // Clear the terminate flag so this Translator can be reused after a
        // terminate() call (e.g. when setupWorker() rebuilds the worker).
        void resetTerminate();

        // Returns true if terminate() has been called and resetTerminate() has not
        // been called since. Checked before each ORT Session::Run() so we never
        // start a new kernel call after shutdown has been requested.
        bool isTerminated() const { return terminated_.load(std::memory_order_acquire); }

        // Block until loading completes (ready_ == true), terminate() is called, or the
        // loader thread exits for any reason (loaderDone_ == true).  Returns true only if
        // the model loaded successfully.  Always unblocks, even after resetTerminate().
        bool waitReady();

        bool isReady() const { return ready_.load(std::memory_order_acquire); }
        std::string targetToken() const { return targetToken_; }

        std::size_t tokenCount(const std::string &text) const;

        int beam() const { return beam_; }
        bool hasKvCache() const { return static_cast<bool>(decoderWithPast_); }
        static constexpr int maxDecodeSteps() { return MAX_DECODE_STEPS; }
        Quant quant() const { return quant_; }

        // Short string identifying the compiled-in model: "nllb200", "m2m100", "mbart50".
        static const char *modelName() { return translationModelName(); }

    private:
        // Translate a single sentence (no splitting).
        // srcLangHint: pre-detected language token; if empty, detection is run on `text` itself.
        std::string translateOne(const std::string &text, const std::string &srcLangHint = {});

        // Greedy decode with KV cache (O(n) attention). Used when decoder_with_past_model.onnx
        // and decoder_init_kv_model.onnx are available. Falls back to translateOne otherwise.
        std::string translateOneKV(const std::string &text, const std::string &srcLangHint = {});

        // Build kvPresentNames_ / kvPastNames_ / their c_str() pointer arrays after
        // numKvLayers_ is set. Must be called once after loading KV sessions.
        void buildKvNames();

        // Set numKvLayers_ from decoderInitKv_ output count, call buildKvNames(),
        // and pin beam_/beamBatch_ to 1 (greedy). Call after KV sessions are loaded.
        void setupKvDecoder_();

        // Sub-split a segment that exceeds maxTokens into token-bounded chunks,
        // snapping cuts to the nearest preceding whitespace.
        std::vector<std::string> subSplitByTokens(const std::string &text, int maxTokens) const;
        std::size_t binarySearchMaxPrefix_(const std::string &s, int maxTokens) const;
        static std::size_t findCutPoint_(const std::string &s, std::size_t lo);
        std::pair<std::string, std::string> splitStep_(const std::string &s, int maxTokens) const;
        std::vector<std::string> expandSentences_(const std::vector<std::string> &sentences) const;
        std::string joinSentences_(const std::vector<std::string> &sentences,
                                   const std::string &srcLang);

        // Batch decoder forward pass; returns one log-softmax per beam (all same length).
        std::vector<std::vector<float> > runDecoderBatch(const std::vector<std::vector<int64_t> > &batchIds,
                                                         float *hidden,
                                                         const std::array<int64_t, 3> &hShape,
                                                         const std::vector<int64_t> &attnMask,
                                                         int64_t srcLen);

        // Load shared_vocabulary.json (array format: index == token ID).
        // NLLB-200 / MBart-50: we store only language-code tokens.
        // M2M-100: HF token IDs do not equal SentencePiece IDs + constant offset, so we store
        // the full HF vocabulary here and decode/encode via token strings instead of raw SP IDs.
        void loadVocab(const std::string &vocabPath);

        // Return the integer ID of a token string (language code or special token).
        int64_t lookupToken(const std::string &piece) const;

        // Reload all ONNX sessions on CPU after a GPU OOM during inference.
        // Returns true on success; on failure ready_ remains false and an error is logged.
        bool reloadOnCPU_();

        // All session-loading work extracted from the constructor so it can run on
        // loaderThread_ without blocking Jami's plugin-init path.
        void load_(const std::string &modelsDir, const std::string &targetLang, Device device);

        // Append the best available EP to opts based on the requested device.
        // Sets effectiveOut to the EP that actually succeeded (or CPU if none did).
        // Returns false when CPU is selected (no EP appended).
        static bool appendEP_(const Ort::SessionOptions &opts, Device requested, Device &effectiveOut);

        // Helpers for load_(): model-file selection, session creation, session loading.
        std::filesystem::path pickModel_(const std::filesystem::path &modelPath, const std::string &base,
                                         Device effectiveDevice) const;

        std::filesystem::path pickKvModel_(const std::filesystem::path &modelPath, const std::string &base) const;

        std::unique_ptr<Ort::Session> loadSession_(const std::filesystem::path &modelPath, const std::string &base,
                                                   const Ort::SessionOptions &opts, Device effectiveDevice);

        std::unique_ptr<Ort::Session> loadKvCompatSession_(const std::filesystem::path &modelPath,
                                                           const std::string &base, const Ort::SessionOptions &opts);

        bool loadKvSessions_(const std::filesystem::path &modelPath, const Ort::SessionOptions &opts);

        void loadSessionsInner_(const std::filesystem::path &modelPath, const std::string &targetLang,
                                const Ort::SessionOptions &opts, Device effectiveDevice, bool hasKvFiles);

        void loadSessions_(const std::filesystem::path &modelPath, const std::string &targetLang,
                           Ort::SessionOptions &opts, Device &effectiveDevice, bool hasKvFiles);

        std::unique_ptr<Ort::Session> reloadCpuSession_(const std::filesystem::path &modelPath, const std::string &base,
                                                        const Ort::SessionOptions &opts);

        std::vector<int64_t> buildKvInputIds_(const std::string &text, const std::string &srcLang) const;
        std::vector<int64_t> kvGreedyLoop_(int64_t firstTok, std::vector<Ort::Value> &&kvCache,
                                           std::vector<int64_t> &attnMask, int64_t srcLen, int64_t vocabSize);
        std::string decodeKvIds_(const std::vector<int64_t> &ids, const std::string &fallback) const;
        static bool hasRepeatingTrigram_(const std::vector<int64_t> &ids);

        struct BeamState {
            std::vector<int64_t> ids;
            float score;
            bool done;
        };

        // Non-owning view into encoder output — valid only while EncoderResult is alive.
        struct EncoderOut {
            float *hidden;
            std::array<int64_t, 3> hShape;
            const std::vector<int64_t> *attnMask;
            int64_t srcLen() const { return hShape[1]; }
        };

        // Owned encoder output returned by runEncoder_().
        struct EncoderResult {
            std::vector<Ort::Value> encOut;
            std::vector<int64_t> attnMask;
            std::array<int64_t, 3> hShape;
            float *hidden() { return encOut[0].GetTensorMutableData<float>(); }
            int64_t srcLen() const { return hShape[1]; }
            int64_t hidDim() const { return hShape[2]; }
            EncoderOut view() { return {hidden(), hShape, &attnMask}; }
        };

        EncoderResult runEncoder_(const std::string &text, const std::string &srcLang) const;

        std::vector<BeamState> beamSearch_(const EncoderOut &enc);
        void expandBeamChunk_(std::vector<BeamState> &candidates,
                              const std::vector<BeamState> &beams,
                              const std::vector<std::size_t> &activeIdx,
                              std::size_t chunkStart, std::size_t chunkEnd,
                              const EncoderOut &enc);
        static std::array<std::pair<int64_t, float>, 5> findTopK_(const std::vector<float> &logProbs, int k);

        // Preallocated buffers to reduce allocations in hot loops
        struct DecoderBuffers {
            std::vector<int64_t> flatIds;
            std::vector<float> tiledHidden;
            std::vector<int64_t> tiledMask;
            std::vector<Ort::Value> decIn;
        };

        DecoderBuffers decoderBufCache_;

        // ONNX Runtime sessions
        // Both are null-constructed here; load_() initialises them on the loader thread
        // so that Ort::Env's first-time CUDA/EP probing doesn't block the plugin-init path.
        Ort::Env ortEnv_{nullptr};
        std::unique_ptr<Ort::Session> encoder_;
        std::unique_ptr<Ort::Session> decoder_; // beam search (no KV cache)
        std::unique_ptr<Ort::Session> decoderInitKv_; // KV greedy: first step
        std::unique_ptr<Ort::Session> decoderWithPast_; // KV greedy: subsequent steps
        Ort::MemoryInfo memInfo_{nullptr};
        // Shared run-options used by all Session::Run calls, kept as a member so
        // that terminate() can call SetTerminate() on it to abort an in-flight
        // inference.  Checked by the pre-Run() guard via isTerminated() as well.
        Ort::RunOptions runOptions_;
        // Atomic flag set by terminate(); checked before every Run() call so we
        // never submit a new kernel after shutdown has been requested.  Using a
        // plain atomic avoids relying solely on ORT's SetTerminate() which can
        // crash in some ORT builds when the flag is already set on Run() entry.
        std::atomic<bool> terminated_{false};

        // Loader thread: runs load_() in the background so the constructor returns
        // immediately.  loaderCv_ wakes waitReady() when ready_, terminated_, or loaderDone_.
        // loaderDone_ is set once by load_() when it exits (success, model-not-found, or
        // exception) and is never cleared, so waitReady() always unblocks even after
        // resetTerminate() clears terminated_.
        std::mutex loaderMutex_;
        std::condition_variable loaderCv_;
        std::jthread loaderThread_;
        std::atomic<bool> loaderDone_{false};

        // KV cache name arrays (set by buildKvNames after numKvLayers_ is determined).
        int numKvLayers_{0};
        std::vector<std::string> kvPresentNames_;
        std::vector<std::string> kvPastNames_;
        std::vector<const char *> kvPresentNamePtrs_;
        std::vector<const char *> kvPastNamePtrs_;

        // Token → HF ID lookup.
        // NLLB-200: only language tokens are stored (regular SP ids use fairseq offset).
        // M2M-100: the full HF vocab is stored because token ids are not SP ids + 1.
        // MBart-50: only language tokens are stored.
        std::unordered_map<std::string, int64_t> vocab_;
        // HF ID → token string, populated for M2M-100 to support decode via token strings.
        std::vector<std::string> idToPiece_;
        int64_t targetLangId_{0};

        // EOS / PAD token IDs (fairseq </s> shared by all supported models).
        static constexpr int64_t EOS_ID = 2; // fairseq </s>
        static constexpr int64_t PAD_ID = 0; // unused but kept for uniformity

        static constexpr int MAX_DECODE_STEPS = 128;
        static constexpr int MAX_INPUT_TOKENS = 50;

        // Fairseq-style SentencePiece offset: HF token ID = SP piece ID + SPM_OFFSET.
        // NLLB-200, M2M-100, and MBart-50 prepend {<s>, <pad>, </s>, <unk>} at ids 0..3.
        static constexpr int64_t SPM_OFFSET = 1;

        // Beam width and decoder batch size — set in constructor based on device.
        int beam_{5};
        int beamBatch_{5};

        // NOTE: setTargetLanguage() is not thread-safe with respect to a concurrent
        // translate() call from a *different* thread.  Calling it from the worker thread
        // itself — sequentially before the translate() it configures — is safe.  External
        // callers (e.g. TranslationChatHandler::setPreferenceAttribute) must ensure the
        // worker thread is joined first; setupWorker() guarantees this.
        std::unique_ptr<fasttext::FastText> lid_;
        std::shared_ptr<sentencepiece::SentencePieceProcessor> srcSpm_;
        std::shared_ptr<sentencepiece::SentencePieceProcessor> tgtSpm_;
        std::string targetToken_; // language token in the compiled model's format
        std::string modelsPath_; // full path to the loaded model directory (for reload on fallback)
        Device device_{Device::AUTO};
        Quant quant_{Quant::AUTO};
        std::atomic<bool> ready_{false};
    };
} // namespace jami
