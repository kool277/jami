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

// Text preprocessing (ICU sentence splitting, emoji handling) and the public
// translate() / translateBatch() API.

#include "Translator.h"
#include "TranslatorHelpers.h"

#include "pluglog.h"
#include "translatelog.h"

#include "md4c-html.h"

// ICU C++ API (BreakIterator, UnicodeString) and several C API functions require
// Android API 31+. On older Android targets we compile simplified fallbacks.
#if !defined(__ANDROID__) || __ANDROID_API__ >= 31
#define JAMI_PLUGIN_HAVE_ICU_FULL 1
#include <unicode/brkiter.h>
#include <unicode/uchar.h>
#include <unicode/unistr.h>
#endif
#include <unicode/utf8.h>

#include <algorithm>
#include <cctype>
#include <cstddef>
#include <numeric>
#include <string>
#include <utility>
#include <vector>

namespace jami {

#pragma region Markdown -> HTML

    static std::string
    markdownToHtml(const std::string &md) {
        std::string html;
        const auto cb = [](const MD_CHAR *data, MD_SIZE size, void *ud) {
            static_cast<std::string *>(ud)->append(data, size);
        };
        constexpr unsigned flags = MD_FLAG_PERMISSIVEAUTOLINKS
                                   | MD_FLAG_NOINDENTEDCODEBLOCKS
                                   | MD_FLAG_TASKLISTS
                                   | MD_FLAG_STRIKETHROUGH
                                   | MD_FLAG_UNDERLINE;
        md_html(md.c_str(), static_cast<MD_SIZE>(md.size()), cb, &html, flags, 0);
        return html;
    }

#pragma endregion

#pragma region ICU sentence splitting

    // Split UTF-8 text into sentences using ICU BreakIterator (language-aware).
    // Paragraph boundaries (\n) are preserved as bare "\n" sentinel entries so the
    // translate() joiner loop can reconstruct them without changes.
    // icuLocale is derived from the NLLB source code (e.g. "fra" from "fra_Latn").
    static std::vector<std::string>
    splitSentences(const std::string_view text, const std::string &icuLocale) {
        std::vector<std::string> result;
        if (text.empty()) {
            return result;
        }

        // Step 1: Split on '\n' to isolate paragraph chunks; insert bare "\n" sentinels.
        std::vector<std::string> paragraphs;
        std::size_t pos = 0;
        std::size_t nl;
        while ((nl = text.find('\n', pos)) != std::string::npos) {
            paragraphs.emplace_back(text.substr(pos, nl - pos));
            paragraphs.emplace_back("\n");
            pos = nl + 1;
        }
        paragraphs.emplace_back(text.substr(pos));

#ifdef JAMI_PLUGIN_HAVE_ICU_FULL
        // Step 2: For each paragraph chunk, run ICU sentence splitting.
        // Create the BreakIterator once and reuse it across paragraphs.
        UErrorCode status = U_ZERO_ERROR;
        const std::unique_ptr<icu::BreakIterator> bi(
            icu::BreakIterator::createSentenceInstance(icu::Locale(icuLocale.c_str()), status));

        for (const auto &para: paragraphs) {
            if (para == "\n") {
                result.emplace_back("\n");
                continue;
            }
            if (para.empty()) { continue; }

            if (U_FAILURE(status)) {
                result.push_back(para);
                continue;
            }

            const icu::UnicodeString unicode_text = icu::UnicodeString::fromUTF8(para);
            bi->setText(unicode_text);

            int32_t start = bi->first();
            int32_t end;
            while ((end = bi->next()) != icu::BreakIterator::DONE) {
                std::string seg;
                unicode_text.tempSubStringBetween(start, end).toUTF8String(seg);
                // Trim trailing spaces/tabs (no '\n' here — paragraphs have no newlines).
                if (const auto last = seg.find_last_not_of(" \t");
                    last != std::string::npos) {
                    result.push_back(seg.substr(0, last + 1));
                }
                start = end;
            }
        }
#else
        // Fallback: no ICU C++ API. Return each paragraph as one sentence.
        (void) icuLocale;
        for (const auto &para: paragraphs) {
            if (para == "\n") {
                result.push_back("\n");
            } else if (!para.empty()) {
                result.push_back(para);
            }
        }
#endif

        return result;
    }

    // Returns true only if the text contains at least one alphabetic codepoint.
    static bool
    hasTranslatableText(const std::string &text) {
#ifdef JAMI_PLUGIN_HAVE_ICU_FULL
        // ICU UCHAR_ALPHABETIC covers every script: Latin, CJK, Arabic, Devanagari, etc.
        const char *s = text.c_str();
        const auto len = static_cast<int32_t>(text.size());
        for (int32_t i = 0; i < len;) {
            UChar32 cp;
            U8_NEXT(s, i, len, cp);
            if (cp >= 0 && u_hasBinaryProperty(cp, UCHAR_ALPHABETIC)) {
                return true;
            }
        }
        return false;
#else
        // Fallback: any ASCII letter or high byte (multi-byte UTF-8 = non-ASCII script).
        for (unsigned char c: text) {
            if (std::isalpha(c) || c > 0x7F)
                return true;
        }
        return false;
#endif
    }

#pragma endregion

#pragma region Preserved-token extraction

    // Replaces HTML tags, code blocks, and bare URLs with <N> placeholders.
    // <pre>...</pre> and <code>...</code> are captured whole (content included).
    // Other HTML tags are captured individually. Appends extracted strings to placeholders.
    static std::string
    extractCodeAndUrls(const std::string &text, std::vector<std::string> &placeholders) {
        std::string result;
        result.reserve(text.size());
        const std::size_t len = text.size();
        std::size_t i = 0;
        while (i < len) {
            if (text[i] == '<' && i + 1 < len) {
                // <pre>...</pre> — entire fenced code block as one placeholder.
                if (text.compare(i, 5, "<pre>") == 0 || text.compare(i, 5, "<pre ") == 0) {
                    const auto close = text.find("</pre>", i + 4);
                    if (close != std::string::npos) {
                        result += "<" + std::to_string(placeholders.size()) + ">";
                        placeholders.push_back(text.substr(i, close + 6 - i));
                        i = close + 6;
                        continue;
                    }
                }
                // <code>...</code> — inline code as one placeholder.
                if (text.compare(i, 6, "<code>") == 0 || text.compare(i, 6, "<code ") == 0) {
                    const auto close = text.find("</code>", i + 5);
                    if (close != std::string::npos) {
                        result += "<" + std::to_string(placeholders.size()) + ">";
                        placeholders.push_back(text.substr(i, close + 7 - i));
                        i = close + 7;
                        continue;
                    }
                }
                // <p> and </p> — stripped entirely (no placeholder, no output).
                if (text.compare(i, 3, "<p>") == 0) {
                    i += 3;
                    continue;
                }
                if (text.compare(i, 4, "</p>") == 0) {
                    i += 4;
                    continue;
                }
                if (text.compare(i, 3, "<p ") == 0) {
                    const auto close = text.find('>', i + 2);
                    if (close != std::string::npos && text.find('<', i + 2) > close) {
                        i = close + 1;
                        continue;
                    }
                }
                // Generic HTML tag: <tagname ...> or </tagname> or <tagname .../>
                // Must start with letter (or / then letter) to avoid matching our <N> placeholders.
                {
                    std::size_t j = i + 1;
                    if (j < len && text[j] == '/') { ++j; }
                    if (j < len && std::isalpha(static_cast<unsigned char>(text[j]))) {
                        const auto close = text.find('>', j);
                        // Reject if another '<' appears before '>' — not a valid tag.
                        if (close != std::string::npos && text.find('<', j) > close) {
                            result += "<" + std::to_string(placeholders.size()) + ">";
                            placeholders.push_back(text.substr(i, close + 1 - i));
                            i = close + 1;
                            continue;
                        }
                    }
                }
            }
            // Bare URL: https://, http://, ftp://
            if (text.compare(i, 8, "https://") == 0
                || text.compare(i, 7, "http://") == 0
                || text.compare(i, 6, "ftp://") == 0) {
                const std::size_t start = i;
                while (i < len && text[i] != ' ' && text[i] != '\t' && text[i] != '\n') {
                    ++i;
                }
                result += "<" + std::to_string(placeholders.size()) + ">";
                placeholders.push_back(text.substr(start, i - start));
                continue;
            }
            result += text[i++];
        }
        return result;
    }

    // Strips code blocks, URLs, and emoji clusters from text, replacing each with
    // a <N> placeholder. Returns {stripped_text, [placeholder_0, placeholder_1, ...]}.
    // ZWJ (U+200D), variation selectors, and combining keycap (U+20E3) stay sticky
    // so multi-codepoint emoji sequences (🇫🇷, 👨‍💻, 1️⃣) are treated as one cluster.
    static std::pair<std::string, std::vector<std::string>>
    stripPreserved(const std::string &text) {
#ifdef JAMI_PLUGIN_HAVE_ICU_FULL
        std::vector<std::string> placeholders;

        // Phase 1: extract code blocks and URLs.
        const std::string afterCodeUrls = extractCodeAndUrls(text, placeholders);

        // Phase 2: extract emoji clusters (ICU codepoint walk).
        // Indices continue from where phase 1 left off.
        std::string stripped;
        std::string curCluster;
        bool inEmoji = false;

        const char *s = afterCodeUrls.c_str();
        const auto len = static_cast<int32_t>(afterCodeUrls.size());

        for (int32_t i = 0; i < len;) {
            const int32_t prev = i;
            UChar32 codepoint;
            U8_NEXT(s, i, len, codepoint);
            if (codepoint < 0) {
                (inEmoji ? curCluster : stripped) += afterCodeUrls.substr(prev, i - prev);
                continue;
            }

            // Sticky modifiers attach to whichever run is current.
            if (codepoint == 0x200D  // ZWJ
                || codepoint == 0x20E3  // combining enclosing keycap (1️⃣)
                || u_hasBinaryProperty(codepoint, UCHAR_VARIATION_SELECTOR)) {
                (inEmoji ? curCluster : stripped) += afterCodeUrls.substr(prev, i - prev);
                continue;
            }

            const bool isEmoji = codepoint > 0x7F
                                 && u_hasBinaryProperty(codepoint, UCHAR_EMOJI)
                                 && !u_hasBinaryProperty(codepoint, UCHAR_ALPHABETIC);

            if (isEmoji) {
                if (!inEmoji) {
                    inEmoji = true;
                    stripped += "<" + std::to_string(placeholders.size()) + ">";
                    curCluster.clear();
                }
                curCluster += afterCodeUrls.substr(prev, i - prev);
            } else {
                if (inEmoji) {
                    placeholders.push_back(std::move(curCluster));
                    inEmoji = false;
                }
                stripped += afterCodeUrls.substr(prev, i - prev);
            }
        }
        if (inEmoji) {
            placeholders.push_back(std::move(curCluster));
        }

        return {std::move(stripped), std::move(placeholders)};
#else
        return {text, {}};
#endif
    }

    // Restores placeholders into translated text by replacing <N> tokens.
    // Any placeholder the model dropped is appended at the end.
    static std::string
    restorePreserved(std::string translated, const std::vector<std::string> &placeholders) {
        if (placeholders.empty()) {
            return translated;
        }
        std::string orphans;
        for (int i = 0; i < static_cast<int>(placeholders.size()); ++i) {
            const std::string token = "<" + std::to_string(i) + ">";
            const auto pos = translated.find(token);
            if (pos != std::string::npos) {
                translated.replace(pos, token.size(), placeholders[i]);
            } else {
                orphans += placeholders[i];
            }
        }
        if (!orphans.empty()) {
            translated += " " + orphans;
        }
        return translated;
    }

#pragma endregion

#pragma region Token-bounded splitting

    // Binary search for the largest byte prefix of s with token count <= maxTokens.
    // Returns lo=0 when no valid split point exists.
    std::size_t
    Translator::binarySearchMaxPrefix_(const std::string &s, const int maxTokens) const {
        std::size_t lo = 0;
        std::size_t hi = s.size();
        while (lo + 1 < hi) {
            const std::size_t orig_mid = std::midpoint(lo, hi);
            std::size_t mid = orig_mid;
            // Snap to a UTF-8 character boundary (skip continuation bytes 10xxxxxx).
            while (mid < s.size()
                   && (std::byte{static_cast<unsigned char>(s[mid])} & std::byte{0xC0}) == std::byte{0x80}) {
                ++mid;
            }
            if (mid < s.size() && static_cast<int>(tokenCount(s.substr(0, mid))) <= maxTokens) {
                lo = mid;
            } else {
                hi = orig_mid;
            }
        }
        return lo;
    }

    // Find the best byte offset to cut s at or before lo.
    // Prefers clause punctuation (,;:), falls back to word boundary, then lo itself.
    std::size_t
    Translator::findCutPoint_(const std::string &s, const std::size_t lo) {
        const std::size_t searchBack = lo / 5;
        const std::size_t searchFloor = lo > searchBack ? lo - searchBack : 1;
        for (std::size_t k = lo; k >= searchFloor; --k) {
            if (const char c = s[k - 1]; c == ',' || c == ';' || c == ':') {
                return k;
            }
        }
        std::size_t cut = lo;
        while (cut > 0 && s[cut - 1] != ' ' && s[cut - 1] != '\t') {
            --cut;
        }
        return cut == 0 ? lo : cut;
    }

    // One split iteration: returns {chunk_to_emit, next_remainder}.
    // Empty next_remainder signals the caller to stop.
    std::pair<std::string, std::string>
    Translator::splitStep_(const std::string &s, const int maxTokens) const {
        // Fold a trailing fragment smaller than this into the preceding chunk.
        if (static_cast<int>(tokenCount(s)) <= maxTokens) {
            return {s, {}};
        }
        const auto lo = binarySearchMaxPrefix_(s, maxTokens);
        if (lo == 0) {
            return {s, {}};
        }
        const auto cut = findCutPoint_(s, lo);
        const auto tailStart = s.find_first_not_of(" \t", cut);
        const std::string tail = tailStart == std::string::npos ? "" : s.substr(tailStart);
        if (constexpr int min_fragment_tokens = 10;
            !tail.empty() && static_cast<int>(tokenCount(tail)) < min_fragment_tokens) {
            return {s, {}};
        }
        return {s.substr(0, cut), tail};
    }

    std::vector<std::string>
    Translator::subSplitByTokens(const std::string &text, const int maxTokens) const {
        std::vector<std::string> parts;
        std::string remainder = text;
        while (!remainder.empty()) {
            auto [chunk, next] = splitStep_(remainder, maxTokens);
            parts.push_back(std::move(chunk));
            remainder = std::move(next);
        }
        return parts;
    }

#pragma endregion

#pragma region translate API

    // Returns true for bare URLs (scheme present, no spaces) that should pass through untranslated.
    static bool
    isBareUrl(const std::string &text) {
        if (text.rfind("http://", 0) != 0 && text.rfind("https://", 0) != 0
            && text.rfind("ftp://", 0) != 0) {
            return false;
        }
        return text.find(' ') == std::string::npos;
    }

    // Strip the leading "- " artifact that NLLB injects for some target languages.
    static std::string
    stripNllbArtifact(std::string s) {
        if (s.size() >= 2 && s[0] == '-' && s[1] == ' ') {
            return s.substr(2);
        }
        return s;
    }

    // Sub-split any segment exceeding MAX_INPUT_TOKENS; preserve "\n" sentinels unchanged.
    std::vector<std::string>
    Translator::expandSentences_(const std::vector<std::string> &sentences) const {
        std::vector<std::string> expanded;
        expanded.reserve(sentences.size());
        for (const auto &seg: sentences) {
            if (seg == "\n" || static_cast<int>(tokenCount(seg)) <= MAX_INPUT_TOKENS) {
                expanded.push_back(seg);
            } else {
                for (auto &p: subSplitByTokens(seg, MAX_INPUT_TOKENS)) {
                    expanded.push_back(std::move(p));
                }
            }
        }
        return expanded;
    }

    // Translate and join multiple sentences, tracking newline/delimiter joiners.
    // Returns the joined result; if terminated_ fires, translateOne() throws and the
    // exception propagates to translate()'s catch block which returns the original text.
    std::string
    Translator::joinSentences_(const std::vector<std::string> &sentences,
                               const std::string &srcLang) {
        std::string result;
        char nextJoiner = '\0';
        for (const auto &sent: sentences) {
            const bool endsNewline = !sent.empty() && sent.back() == '\n';
            const bool endsDelim = !sent.empty()
                                   && (endsNewline || sent.back() == '?' || sent.back() == '!'
                                       || sent.back() == '.');
            const std::string clean = endsDelim ? sent.substr(0, sent.size() - 1) : sent;

            // Empty after stripping (e.g. bare "\n", "."): fold into joiner.
            if (clean.find_first_not_of(" \t\r\n") == std::string::npos && endsNewline) {
                if (result.empty()) {
                    result += '\n';
                } else if (nextJoiner == '\n') {
                    result += '\n';
                    result += '\n';
                    nextJoiner = '\0';
                } else {
                    nextJoiner = '\n';
                }
                continue;
            }

            if (!result.empty() && nextJoiner != '\0') {
                result += nextJoiner;
            }
            nextJoiner = endsNewline ? '\n' : ' ';
            // Skip model for placeholder-only segments (e.g. bare HTML tags from md4c
            // list/block structure) — the model corrupts tokens it cannot translate.
            if (!hasTranslatableText(clean)) {
                result += clean;
            } else {
                result += stripNllbArtifact(translateOne(clean, srcLang));
            }
        }
        return result;
    }

    std::string
    Translator::translate(const std::string &text) {
        if (!ready_ || text.empty()) { return text; }
        // Bail immediately if terminate() was called — avoids entering ORT at all.
        if (terminated_.load()) { return text; }
        // EOS_ID sentinel: target language not in model vocab, translation would produce garbage.
        if (targetLangId_ == EOS_ID) { return text; }
        // Pass through emoji-only / invisible-char-only messages unchanged.
        if (!hasTranslatableText(text)) { return text; }
        // Pass through bare URLs (no spaces after scheme) unchanged.
        if (isBareUrl(text)) { return text; }

        auto [workText, placeholders] = stripPreserved(markdownToHtml(text));
        try {
            const std::string srcLang = detectSourceLang(lid_.get(), workText, detectByScript(workText));
            if (srcLang == targetToken_) { return text; }
            const auto sentences = expandSentences_(splitSentences(workText, extractIcuLocale(srcLang)));
            std::string result;
            if (sentences.size() <= 1 && (sentences.empty() || sentences[0] != "\n")) {
                result = hasTranslatableText(workText)
                             ? stripNllbArtifact(translateOne(workText, srcLang))
                             : workText;
            } else {
                result = joinSentences_(sentences, srcLang);
            }
            return placeholders.empty() ? std::move(result) : restorePreserved(std::move(result), placeholders);
        } catch (const std::exception &e) {
            // Avoid string allocation in the catch block: a bad_alloc here would
            // throw again and escape translate(), terminating the worker thread.
            PLOG(Plog::LogPriority::ERR, TRANS_TAG, "Translation error: {}", e.what());
            return text;
        }
    }

    std::vector<std::string>
    Translator::translateBatch(const std::vector<std::string> &texts) {
        if (!ready_) { return texts; }
        std::vector<std::string> results;
        results.reserve(texts.size());
        std::ranges::transform(texts, std::back_inserter(results),
                               [this](const auto &t) { return translate(t); });
        return results;
    }

#pragma endregion
} // namespace jami
