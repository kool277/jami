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

// Neural-network inference: language detection, KV-cache greedy decode,
// batched beam-search decoder, and translateOne().

#include "Translator.h"
#include "TranslatorHelpers.h"

#include "pluglog.h"
#include "translatelog.h"

#include <sentencepiece_processor.h>
#include <fasttext/fasttext.h>

#include <algorithm>
#include <cassert>
#include <limits>
#include <ranges>
#include <sstream>
#include <string>
#include <string_view>
#include <vector>

namespace jami {

#pragma region Language detection

    std::string
    detectSourceLang(const fasttext::FastText *lid, const std::string &text, const std::string &fallback) {
        // Use model-appropriate English fallback when no explicit fallback is given.
        std::string eff_fallback = fallback.empty() ? modelFallbackLang() : fallback;

        if (!lid || text.empty()) {
            return eff_fallback;
        }

        // Check whether the text is pure ASCII. Non-ASCII text (CJK, Arabic, Cyrillic, etc.)
        // is script-unambiguous even in a single character, so a low LID confidence is still
        // meaningful. Pure-ASCII short strings (e.g. "test", "ok") are highly ambiguous across
        // languages and should fall back when confidence is low.
        const bool isAsciiOnly = std::ranges::none_of(text, [](const unsigned char c) {
            return c > 0x7F;
        });

        std::istringstream iss(text);
        std::vector<std::pair<fasttext::real, std::string> > preds;
        const float threshold = (isAsciiOnly && text.size() < 20) ? 0.8f : 0.5f;
        lid->predictLine(iss, preds, 5, threshold);

        if (preds.empty() || preds[0].first < threshold) {
            return eff_fallback;
        }

        // Strip "__label__" prefix to get ISO 639-1 code, then convert to compiled model's token.
        auto label = preds[0].second;
        if (label.rfind("__label__", 0) == 0) {
            label = label.substr(9);
        }

        return toModelCode(label);
    }

    // Numerically stable log-softmax over logits[0..n).
    static std::vector<float>
    logSoftmax(const float *logits, const int64_t n) {
        const float mx = *std::max_element(logits, logits + n);
        float sum = 0.f;
        for (int64_t i = 0; i < n; ++i) {
            sum += std::exp(logits[i] - mx);
        }
        const float lsm = mx + std::log(sum);
        std::vector<float> out(n);
        for (int64_t i = 0; i < n; ++i) {
            out[i] = logits[i] - lsm;
        }
        return out;
    }

#pragma endregion

#pragma region KV-cache helpers

    std::vector<int64_t>
    Translator::buildKvInputIds_(const std::string &text, const std::string &srcLang) const {
        std::vector<int64_t> inputIds;
#if defined(JAMI_PLUGIN_TRANSLATION_MODEL_M2M100)
        std::vector<std::string> encPieces;
        srcSpm_->Encode(text, &encPieces);
        inputIds.push_back(lookupToken(srcLang));
        for (const auto &piece: encPieces) {
            inputIds.push_back(lookupToken(piece));
        }
#else
        std::vector<int> rawIds;
        srcSpm_->Encode(text, &rawIds);
        inputIds.push_back(lookupToken(srcLang));
        for (int id: rawIds) {
            inputIds.push_back(static_cast<int64_t>(id) + SPM_OFFSET);
        }
#endif
        inputIds.push_back(EOS_ID);
        return inputIds;
    }

    bool
    Translator::hasRepeatingTrigram_(const std::vector<int64_t> &ids) {
        const std::size_t nd = ids.size();
        if (nd < 6) {
            return false;
        }
        const std::array<int64_t, 3> trigram = {ids[nd - 3], ids[nd - 2], ids[nd - 1]};
        // Search haystack up to ids[nd-2] so we only count prior occurrences of the trigram.
        const auto end = ids.cend() - 1;
        const auto first = std::search(ids.cbegin(), end, trigram.cbegin(), trigram.cend());
        if (first == end) {
            return false;
        }
        return std::search(first + 1, end, trigram.cbegin(), trigram.cend()) != end;
    }

    std::vector<int64_t>
    Translator::kvGreedyLoop_(const int64_t firstTok,
                              std::vector<Ort::Value> &&kvCache,
                              std::vector<int64_t> &attnMask,
                              const int64_t srcLen,
                              const int64_t vocabSize) {
        std::vector<int64_t> decodedIds = {firstTok};

        std::vector wpOutNames = {"logits"};
        wpOutNames.insert(wpOutNames.end(), kvPresentNamePtrs_.begin(), kvPresentNamePtrs_.end());
        // Input names: "input_ids" + encoder_attention_mask + past KV.
        // encoder_hidden_states and cache_position are not ONNX inputs: cross-attn KVs are
        // fully cached, so encoder_hidden_states is never accessed, and cache_position was
        // optimized away at export time.
        std::vector wpInNames = {"input_ids", "encoder_attention_mask"};
        wpInNames.insert(wpInNames.end(), kvPastNamePtrs_.begin(), kvPastNamePtrs_.end());

        const std::array<int64_t, 2> srcShape = {1, srcLen};

        for (int step = 0; step < MAX_DECODE_STEPS - 1; ++step) {
            const int64_t lastTok = decodedIds.back();
            std::array<int64_t, 2> tokShape = {1, 1};
            std::vector tokVec = {lastTok};

            std::vector<Ort::Value> wpIn;
            wpIn.reserve(2 + kvCache.size());
            wpIn.push_back(Ort::Value::CreateTensor<int64_t>(memInfo_, tokVec.data(), 1, tokShape.data(), 2));
            wpIn.push_back(Ort::Value::CreateTensor<int64_t>(memInfo_, attnMask.data(), srcLen, srcShape.data(), 2));
            for (auto &kv: kvCache) {
                wpIn.push_back(std::move(kv));
            }

            if (terminated_.load()) {
                throw std::runtime_error("Translation terminated before decoderWithPast Run");
            }
            auto wpOut = decoderWithPast_->Run(runOptions_,
                                               wpInNames.data(),
                                               wpIn.data(),
                                               wpIn.size(),
                                               wpOutNames.data(),
                                               wpOutNames.size());

            const auto *stepLogits = wpOut[0].GetTensorData<float>();
            const int64_t nextTok = std::max_element(stepLogits, stepLogits + vocabSize) - stepLogits;

            if (nextTok != EOS_ID) {
                decodedIds.push_back(nextTok);
            }
            if (nextTok == EOS_ID || hasRepeatingTrigram_(decodedIds)) {
                break;
            }

            kvCache.clear();
            for (std::size_t i = 1; i < wpOut.size(); ++i) {
                kvCache.push_back(std::move(wpOut[i]));
            }
        }
        return decodedIds;
    }

    std::string
    Translator::decodeKvIds_(const std::vector<int64_t> &ids, const std::string &fallback) const {
#if defined(JAMI_PLUGIN_TRANSLATION_MODEL_M2M100)
        std::vector<std::string> outPieces;
        outPieces.reserve(ids.size());
        for (const int64_t hfId: ids) {
            if (hfId < 0 || static_cast<std::size_t>(hfId) >= idToPiece_.size()) {
                continue;
            }
            const auto &piece = idToPiece_[static_cast<std::size_t>(hfId)];
            if (piece == "<s>" || piece == "<pad>" || piece == "</s>" || piece == "<unk>") {
                continue;
            }
            if (piece.size() >= 4 && piece[0] == '_' && piece[1] == '_'
                && piece[piece.size() - 1] == '_' && piece[piece.size() - 2] == '_') {
                continue;
            }
            outPieces.push_back(piece);
        }
        const std::string result = srcSpm_->DecodePieces(outPieces);
        return result.empty() ? fallback : result;
#else
        const int spVocab = srcSpm_->GetPieceSize();
        std::vector<int> spmIds;
        spmIds.reserve(ids.size());
        for (const int64_t hfId: ids) {
            if (hfId > 3 && hfId <= spVocab) {
                spmIds.push_back(static_cast<int>(hfId - SPM_OFFSET));
            }
        }
        std::string result;
        srcSpm_->Decode(spmIds, &result);
        return result.empty() ? fallback : result;
#endif
    }

#pragma endregion

#pragma region Encoder

    Translator::EncoderResult
    Translator::runEncoder_(const std::string &text, const std::string &srcLang) const {
        auto inputIds = buildKvInputIds_(text, srcLang);
        const auto srcLen = static_cast<int64_t>(inputIds.size());
        std::vector<int64_t> attnMask(srcLen, 1);
        const std::array<int64_t, 2> srcShape = {1, srcLen};

        std::vector<Ort::Value> encIn;
        encIn.reserve(2);
        encIn.push_back(Ort::Value::CreateTensor<int64_t>(memInfo_, inputIds.data(), srcLen, srcShape.data(), 2));
        encIn.push_back(Ort::Value::CreateTensor<int64_t>(memInfo_, attnMask.data(), srcLen, srcShape.data(), 2));

        constexpr std::array encInNames = {"input_ids", "attention_mask"};
        constexpr std::array encOutNames = {"last_hidden_state"};
        if (terminated_.load()) {
            throw std::runtime_error("Translation terminated before encoder Run");
        }
        auto encOut = encoder_->Run(runOptions_, encInNames.data(), encIn.data(), 2, encOutNames.data(), 1);

        const auto hShape3 = encOut[0].GetTensorTypeAndShapeInfo().GetShape();
        const std::array<int64_t, 3> hShape = {hShape3[0], hShape3[1], hShape3[2]};
        return {std::move(encOut), std::move(attnMask), hShape};
    }

#pragma endregion

#pragma region KV greedy decoder

    // Greedily decode using KV cache — O(n) attention instead of O(n²).
    // Requires decoderInitKv_ and decoderWithPast_ to be loaded.
    // srcLangHint may be pre-detected by the caller (e.g. on the full unsplit text);
    // if empty, detection is run on `text` itself.
    std::string
    Translator::translateOneKV(const std::string &text, const std::string &srcLangHint)
    {
        if (text.empty()) {
            return text;
        }

        try {
            // If the caller already identified the full message as the target language, trust
            // that result rather than re-running LID on a short sentence (short Latin-script
            // segments are frequently misidentified with high confidence).
            if (srcLangHint == targetToken_) {
                return text;
            }
            const std::string srcLang = detectSourceLang(lid_.get(), text, srcLangHint);
            PLOG(Plog::LogPriority::INFO, TRANS_TAG, "KV decode — detected lang: {}: {}", srcLang, text);
            if (srcLang == targetToken_) {
                return text;
            }

            auto enc = runEncoder_(text, srcLang);
            const auto srcLen = enc.srcLen();
            const auto hidDim = enc.hidDim();
            const std::array<int64_t, 2> srcShape = {1, srcLen};
            const std::array<int64_t, 3> hidShape = {1, srcLen, hidDim};

            // Decoder init step: [EOS, lang_id] → logits + all KV tensors
            std::vector initIds = {EOS_ID, targetLangId_};
            constexpr std::array<int64_t, 2> initShape = {1, 2};
            std::vector initOutNames = {"logits"};
            initOutNames.insert(initOutNames.end(), kvPresentNamePtrs_.begin(), kvPresentNamePtrs_.end());

            std::vector<Ort::Value> initIn;
            initIn.reserve(3);
            initIn.push_back(Ort::Value::CreateTensor<int64_t>(memInfo_, initIds.data(), initIds.size(), initShape.data(), 2));
            initIn.push_back(Ort::Value::CreateTensor<float>(memInfo_, enc.hidden(), srcLen * hidDim, hidShape.data(), 3));
            initIn.push_back(Ort::Value::CreateTensor<int64_t>(memInfo_, enc.attnMask.data(), srcLen, srcShape.data(), 2));

            constexpr std::array initInNames = {"input_ids", "encoder_hidden_states", "encoder_attention_mask"};
            if (terminated_.load()) {
                throw std::runtime_error("Translation terminated before decoderInitKv Run");
            }
            auto initOut = decoderInitKv_->Run(runOptions_, initInNames.data(), initIn.data(), 3,
                                               initOutNames.data(), initOutNames.size());

            const auto *logits = initOut[0].GetTensorData<float>();
            const int64_t vocabSize = initOut[0].GetTensorTypeAndShapeInfo().GetShape()[2];
            const int64_t firstTok = std::max_element(logits, logits + vocabSize) - logits;

            if (firstTok == EOS_ID) {
                return "";
            }

            // KV tensors from init step become past KV for subsequent steps (Ort::Value is move-only).
            std::vector<Ort::Value> kvCache(std::make_move_iterator(initOut.begin() + 1),
                                            std::make_move_iterator(initOut.end()));

            const auto decodedIds = kvGreedyLoop_(firstTok, std::move(kvCache), enc.attnMask, srcLen, vocabSize);
            return decodeKvIds_(decodedIds, text);

        } catch (const Ort::Exception &e) {
            const char *msg = e.what();
            if (const std::string_view sv(msg ? msg : "");
                device_ != Device::CPU
                && (sv.find("allocate") != std::string_view::npos
                    || sv.find("out of memory") != std::string_view::npos
                    || sv.find("OOM") != std::string_view::npos)
                && reloadOnCPU_()) {
                return translateOne(text, srcLangHint);
            }
            PLOG(Plog::LogPriority::ERR, TRANS_TAG, "ORT exception in KV translation: {}", e.what());
            return text;
        } catch (const std::exception &e) {
            PLOG(Plog::LogPriority::ERR, TRANS_TAG, "Exception in KV translation: {}", e.what());
            return text;
        }
    }

#pragma endregion

#pragma region Beam-search decoder

    std::vector<std::vector<float> >
    Translator::runDecoderBatch(const std::vector<std::vector<int64_t> > &batchIds,
                                float *hidden,
                                const std::array<int64_t, 3> &hShape,
                                const std::vector<int64_t> &attnMask,
                                const int64_t srcLen) {
        const auto B = static_cast<int64_t>(batchIds.size());
        const auto decLen = static_cast<int64_t>(batchIds[0].size());
        const int64_t hidDim = hShape[2];
        const int64_t stateEl = srcLen * hidDim;

        // Reuse cached buffers to avoid allocations
        decoderBufCache_.flatIds.assign(B * decLen, 0);
        decoderBufCache_.tiledHidden.assign(B * stateEl, 0.f);
        decoderBufCache_.tiledMask.assign(B * srcLen, 0);

        for (int64_t b = 0; b < B; ++b)
            std::ranges::copy(batchIds[b],
                              decoderBufCache_.flatIds.data() + b * decLen);

        for (int64_t b = 0; b < B; ++b) {
            std::copy_n(hidden, stateEl, decoderBufCache_.tiledHidden.data() + b * stateEl);
            std::ranges::copy(attnMask, decoderBufCache_.tiledMask.data() + b * srcLen);
        }

        const std::array<int64_t, 2> idsShape = {B, decLen};
        const std::array<int64_t, 3> stateShape = {B, srcLen, hidDim};
        const std::array<int64_t, 2> maskShape = {B, srcLen};

        decoderBufCache_.decIn.clear();
        decoderBufCache_.decIn.reserve(3);
        decoderBufCache_.decIn.push_back(
            Ort::Value::CreateTensor<int64_t>(memInfo_,
                                              decoderBufCache_.flatIds.data(),
                                              B * decLen,
                                              idsShape.data(),
                                              2));
        decoderBufCache_.decIn.push_back(
            Ort::Value::CreateTensor<float>(memInfo_,
                                            decoderBufCache_.tiledHidden.data(),
                                            B * stateEl,
                                            stateShape.data(),
                                            3));
        decoderBufCache_.decIn.push_back(
            Ort::Value::CreateTensor<int64_t>(memInfo_,
                                              decoderBufCache_.tiledMask.data(),
                                              B * srcLen,
                                              maskShape.data(),
                                              2));

        constexpr std::array inNames = {"input_ids", "encoder_hidden_states", "encoder_attention_mask"};
        constexpr std::array outNames = {"logits"};
        if (terminated_.load()) {
            throw std::runtime_error("Translation terminated before decoder batch Run");
        }
        const auto out = decoder_
                ->Run(runOptions_, inNames.data(), decoderBufCache_.decIn.data(), 3, outNames.data(), 1);

        const auto *allLogits = out[0].GetTensorData<float>();
        const auto outShape = out[0].GetTensorTypeAndShapeInfo().GetShape();
        // New models output [B, 1, V] (last position only); old models output [B, decLen, V].
        const int64_t outDecLen = outShape[1];
        const int64_t vocabSize = outShape[2];

        std::vector<std::vector<float> > results(B);
        for (int64_t b = 0; b < B; ++b) {
            const float *beamLogits = allLogits + b * outDecLen * vocabSize;
            results[b] = logSoftmax(beamLogits + (outDecLen - 1) * vocabSize, vocabSize);
        }
        return results;
    }

#pragma endregion

#pragma region Beam search helpers

    std::array<std::pair<int64_t, float>, 5>
    Translator::findTopK_(const std::vector<float> &logProbs, const int k) {
        assert(k <= 5 && "beam_ must not exceed 5");
        std::array<std::pair<int64_t, float>, 5> top;
        top.fill({-1LL, -std::numeric_limits<float>::infinity()});
        for (int64_t v = 0; v < static_cast<int64_t>(logProbs.size()); ++v) {
            if (const float val = logProbs[v];
                val > top[k - 1].second) {
                int pos = k - 2;
                while (pos >= 0 && val > top[pos].second) {
                    --pos;
                }
                ++pos;
                for (int j = k - 1; j > pos; --j) {
                    top[j] = top[j - 1];
                }
                top[pos] = {v, val};
            }
        }
        return top;
    }

    void
    Translator::expandBeamChunk_(std::vector<BeamState> &candidates,
                                 const std::vector<BeamState> &beams,
                                 const std::vector<std::size_t> &activeIdx,
                                 const std::size_t chunkStart, const std::size_t chunkEnd,
                                 const EncoderOut &enc) {
        const int BEAM = beam_;
        std::vector<std::vector<int64_t> > batchIds;
        batchIds.reserve(chunkEnd - chunkStart);
        for (std::size_t ci = chunkStart; ci < chunkEnd; ++ci) {
            batchIds.push_back(beams[activeIdx[ci]].ids);
        }

        const auto batchLogProbs = runDecoderBatch(batchIds, enc.hidden, enc.hShape, *enc.attnMask, enc.srcLen());

        for (std::size_t ci = 0; ci < batchIds.size(); ++ci) {
            const auto &beam = beams[activeIdx[chunkStart + ci]];
            const auto top = findTopK_(batchLogProbs[ci], BEAM);
            for (int k = 0; k < BEAM; ++k) {
                if (top[k].first < 0) {
                    break;
                }
                const int64_t tok = top[k].first;
                const bool done = (tok == EOS_ID);
                auto newIds = beam.ids;
                if (!done) {
                    newIds.push_back(tok);
                }
                candidates.emplace_back(std::move(newIds), beam.score + top[k].second, done);
            }
        }
    }

    std::vector<Translator::BeamState>
    Translator::beamSearch_(const EncoderOut &enc) {
        const int BEAM = beam_;
        const int beamBatch = beamBatch_;

        std::vector<BeamState> beams = {{{EOS_ID, targetLangId_}, 0.f, false}};
        std::vector<BeamState> candidates;
        candidates.reserve(BEAM * 2);

        for (int step = 0; step < MAX_DECODE_STEPS; ++step) {
            std::vector<std::size_t> activeIdx;
            activeIdx.reserve(beams.size());
            for (std::size_t i = 0; i < beams.size(); ++i) {
                if (!beams[i].done) {
                    activeIdx.push_back(i);
                }
            }
            if (activeIdx.empty()) {
                break;
            }

            candidates.clear();
            candidates.reserve(beams.size() - activeIdx.size() + activeIdx.size() * BEAM);
            std::ranges::copy_if(beams, std::back_inserter(candidates), &BeamState::done);

            for (std::size_t start = 0; start < activeIdx.size(); start += beamBatch) {
                const std::size_t end = std::min(start + static_cast<std::size_t>(beamBatch),
                                                 activeIdx.size());
                expandBeamChunk_(candidates, beams, activeIdx, start, end, enc);
            }

            const int keep = std::min(BEAM, static_cast<int>(candidates.size()));
            const auto scoreDesc = [](const BeamState &a, const BeamState &b) {
                return a.score > b.score;
            };
            if (keep < static_cast<int>(candidates.size())) {
                std::ranges::nth_element(candidates, candidates.begin() + keep, scoreDesc);
                std::ranges::sort(std::span(candidates).first(keep), scoreDesc);
            } else {
                std::ranges::sort(candidates, scoreDesc);
            }
            beams.assign(candidates.begin(), candidates.begin() + keep);
        }
        return beams;
    }

#pragma endregion

#pragma region translateOne

    std::string
    Translator::translateOne(const std::string &text, const std::string &srcLangHint) {
        if (text.empty()) {
            return text;
        }
        // Use KV cache path when available (greedy O(n)); otherwise fall through to beam search.
        if (decoderWithPast_) {
            return translateOneKV(text, srcLangHint);
        }

        try {
            // If the caller already identified the full message as the target language, trust
            // that result rather than re-running LID on a short sentence.
            if (srcLangHint == targetToken_) {
                return text;
            }
            const std::string srcLang = detectSourceLang(lid_.get(), text, srcLangHint);
            PLOG(Plog::LogPriority::INFO, TRANS_TAG, "Detected lang: {} for: {}", srcLang, text);
            if (srcLang == targetToken_) {
                return text;
            }

            auto enc = runEncoder_(text, srcLang);
            const auto beams = beamSearch_(enc.view());
            // ids[0..1] are the </s> + target lang prefix tokens — skip both when decoding.
            const std::vector<int64_t> bestIds(beams[0].ids.begin() + 2, beams[0].ids.end());
            return decodeKvIds_(bestIds, text);

        } catch (const Ort::Exception &e) {
            const char *msg = e.what();
            if (const std::string_view sv(msg ? msg : "");
                device_ != Device::CPU
                && (sv.find("allocate") != std::string_view::npos
                    || sv.find("out of memory") != std::string_view::npos
                    || sv.find("OOM") != std::string_view::npos)
                && reloadOnCPU_()) {
                return translateOne(text, srcLangHint);
            }
            PLOG(Plog::LogPriority::ERR, TRANS_TAG, "ORT exception in beam translation: {}", e.what());
            return text;
        } catch (const std::exception &e) {
            PLOG(Plog::LogPriority::ERR, TRANS_TAG, "Exception in beam translation: {}", e.what());
            return text;
        }
    }
#pragma endregion

} // namespace jami
