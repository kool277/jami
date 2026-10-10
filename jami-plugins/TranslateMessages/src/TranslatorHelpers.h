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

// Internal header shared between Translator*.cpp translation units.
// NOT a public interface — include only within the plugin's own source files.

#include <string>

namespace fasttext {
    class FastText;
}

namespace jami {
    /// Log tag used across all Translator TUs.
    inline constexpr auto TRANS_TAG = "TranslateMessages";

    /// Detect source language via the fastText LID model.
    /// Returns a model-specific language token (e.g. "fra_Latn" for NLLB-200).
    /// Falls back to modelFallbackLang() when the model is absent or confidence is low.
    /// Defined in TranslatorDecode.cpp.
    std::string detectSourceLang(const fasttext::FastText *lid,
                                 const std::string &text,
                                 const std::string &fallback = {});
} // namespace jami
