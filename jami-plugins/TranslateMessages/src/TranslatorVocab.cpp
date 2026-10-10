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

// Vocabulary loading, token lookup, KV-name construction, and tokenizer helpers.

#include "Translator.h"
#include "TranslatorHelpers.h"

#include "pluglog.h"
#include "translatelog.h"

#include <sentencepiece_processor.h>
#include <json/json.h>

#include <algorithm>
#include <array>
#include <fstream>
#include <string>
#include <vector>

namespace jami {
#pragma region Vocabulary loading

    void
    Translator::loadVocab(const std::string &vocabPath) {
        // shared_vocabulary.json is a JSON array where index == token ID.
        std::ifstream f(vocabPath);
        if (!f) {
            return;
        }

        Json::Value j;
        Json::CharReaderBuilder rbuilder;
        rbuilder["collectComments"] = false;
        std::string errs;
        if (!Json::parseFromStream(rbuilder, f, &j, &errs)) {
            PLOG(Plog::LogPriority::WARN, TRANS_TAG, "Failed to parse vocabulary JSON: {}", vocabPath);
            return;
        }
        if (!j.isArray()) {
            return;
        }

        vocab_.clear();
        idToPiece_.clear();

        for (Json::ArrayIndex i = 0; i < j.size(); ++i) {
            if (!j[i].isString()) {
                continue;
            }
            const auto &token = j[i].asString();
            const auto idx = static_cast<int64_t>(i);

#if defined(JAMI_PLUGIN_TRANSLATION_MODEL_M2M100)
            // M2M-100: store the full HF vocab.  Regular piece ids are not SP ids + constant offset,
            // so runtime encoding/decoding must go through token strings.
            vocab_[token] = idx;
            idToPiece_.push_back(token);
#elif defined(JAMI_PLUGIN_TRANSLATION_MODEL_MBART50)
            // MBart-50 language tokens: "xx_XX" (2 lowercase + '_' + 2 uppercase, total 5 chars)
            if (token.size() == 5 && token[2] == '_'
                && std::islower(static_cast<unsigned char>(token[0]))
                && std::islower(static_cast<unsigned char>(token[1]))
                && std::isupper(static_cast<unsigned char>(token[3]))
                && std::isupper(static_cast<unsigned char>(token[4]))) {
                vocab_[token] = idx;
            }
#else
            // NLLB-200 language tokens: "xxx_Xxxx"
            if (token.size() >= 7 && token[3] == '_'
                && std::islower(static_cast<unsigned char>(token[0]))
                && std::islower(static_cast<unsigned char>(token[1]))
                && std::islower(static_cast<unsigned char>(token[2]))
                && std::isupper(static_cast<unsigned char>(token[4]))) {
                vocab_[token] = idx;
            }
#endif
        }

#if defined(JAMI_PLUGIN_TRANSLATION_MODEL_M2M100)
        constexpr const char *tokenKind = "full tokens";
#else
        constexpr const char *tokenKind = "language tokens";
#endif
        PLOG(Plog::LogPriority::INFO, TRANS_TAG, "Vocab loaded {} {} [model={}]",
             vocab_.size(), tokenKind, modelName());
    }

#pragma endregion

#pragma region Token lookup

    int64_t
    Translator::lookupToken(const std::string &piece) const {
        // Check the vocabulary JSON first (covers NLLB language codes added as special tokens).
        if (const auto it = vocab_.find(piece); it != vocab_.end()) {
            return it->second;
        }
        // Fall back to SentencePiece for any token embedded in the .bpe.model.
        if (srcSpm_) {
            if (const int id = srcSpm_->PieceToId(piece); id > 0) {
                return id;
            }
        }
        PLOG(Plog::LogPriority::WARN, TRANS_TAG, "Token not found in vocab: {}", piece);
        return EOS_ID;
    }

    void
    Translator::setTargetLanguage(const std::string &lang) {
        // NOTE: Not thread-safe with respect to translate(); callers must ensure the
        // translation worker is joined before invoking this (single-worker invariant).
        targetToken_ = toModelCode(lang);
        targetLangId_ = lookupToken(targetToken_);
        // lookupToken() returns EOS_ID when the token is absent from the model vocab.
        // Log a clear warning so the user knows the language is not supported; translate()
        // will return the original text unchanged rather than using EOS as a language token
        // (which produces garbage or degenerate decoder behaviour).
        if (targetLangId_ == EOS_ID && targetToken_ != modelFallbackLang()) {
            PLOG(Plog::LogPriority::WARN,
                 TRANS_TAG,
                 "Target language not supported by this model: \"{}\" — translation will be skipped",
                 lang);
        }
    }

#pragma endregion

#pragma region KV-name construction

    void
    Translator::buildKvNames() {
        // KV types per layer, matching download_model.py's KV_TYPES order.
        static constexpr std::array types = {"self.key", "self.val", "cross.key", "cross.val"};
        kvPresentNames_.clear();
        kvPastNames_.clear();
        for (int i = 0; i < numKvLayers_; ++i) {
            for (const auto *t: types) {
                kvPresentNames_.push_back(std::format("present.{}.{}", i, t));
                kvPastNames_.push_back(std::format("past.{}.{}", i, t));
            }
        }
        // Build stable c_str() pointer arrays (valid as long as the string vectors aren't modified).
        kvPresentNamePtrs_.clear();
        kvPastNamePtrs_.clear();
        std::ranges::transform(kvPresentNames_, std::back_inserter(kvPresentNamePtrs_),
                               [](const std::string &s) { return s.c_str(); });
        std::ranges::transform(kvPastNames_, std::back_inserter(kvPastNamePtrs_),
                               [](const std::string &s) { return s.c_str(); });
    }

#pragma endregion

#pragma region Tokenizer

    std::size_t
    Translator::tokenCount(const std::string &text) const {
        if (!srcSpm_ || text.empty()) {
            return 0;
        }
        std::vector<std::string> tokens;
        srcSpm_->Encode(text, &tokens);
        return tokens.size();
    }

#pragma endregion

} // namespace jami