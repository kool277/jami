/**
 *  Copyright (C) 2026 Savoir-faire Linux Inc.
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

/**
 * LanguageCodes.h — compile-time language-token dispatch for NLLB-200, M2M-100, MBart-50.
 *
 * Each model uses a different token format for target-language identification:
 *   NLLB-200:  "fra_Latn"  (ISO 639-3 + script)
 *   M2M-100:   "__fr__"    (ISO 639-1 flanked by double underscores)
 *   MBart-50:  "fr_XX"     (ISO 639-1 + region code)
 *
 * CMake sets exactly one of:
 *   -DJAMI_PLUGIN_TRANSLATION_MODEL_NLLB200=1
 *   -DJAMI_PLUGIN_TRANSLATION_MODEL_M2M100=1
 *   -DJAMI_PLUGIN_TRANSLATION_MODEL_MBART50=1
 *
 * All functions are inlined so they compile to zero cost at -O3.
 */

#include <string>
#include <unordered_map>

// Fallback: default to NLLB-200 for backward compatibility.
#if !defined(JAMI_PLUGIN_TRANSLATION_MODEL_NLLB200) \
    && !defined(JAMI_PLUGIN_TRANSLATION_MODEL_M2M100) \
    && !defined(JAMI_PLUGIN_TRANSLATION_MODEL_MBART50)
#define JAMI_PLUGIN_TRANSLATION_MODEL_NLLB200 1
#endif

// ICU includes for Unicode script detection (detectByScript).
// uscript_getScript requires Android API 31+; guard for older Android targets.
#if !defined(__ANDROID__) || __ANDROID_API__ >= 31
#define JAMI_PLUGIN_HAVE_USCRIPT 1
#include <unicode/uscript.h>
#endif
#include <unicode/uchar.h>
#include <unicode/utf8.h>

namespace jami {

// ── Model identification ───────────────────────────────────────────────────────

/// Short string identifying the compiled-in model ("nllb200", "m2m100", "mbart50").
inline const char*
translationModelName()
{
#if defined(JAMI_PLUGIN_TRANSLATION_MODEL_M2M100)
    return "m2m100";
#elif defined(JAMI_PLUGIN_TRANSLATION_MODEL_MBART50)
    return "mbart50";
#else
    return "nllb200";
#endif
}

// ── Per-model ISO 639-1 → token-format tables ─────────────────────────────────

/**
 * Maps FastText LID-176 codes to NLLB-200 language tokens ("fra_Latn", …).
 * Only LID-176 codes that have a corresponding token in NLLB-200 are listed.
 * Codes already in NLLB-200 format (e.g. from preferences) pass through unchanged.
 */
static inline std::string
toNllbCode(const std::string& iso)
{
    static const std::unordered_map<std::string, std::string> table = {
        // ── A ──────────────────────────────────────────────────────────────────
        {"af", "afr_Latn"},  // Afrikaans
        {"als", "als_Latn"}, // Tosk Albanian  (LID uses "als", not "sq")
        {"am", "amh_Ethi"},  // Amharic
        {"ar", "arb_Arab"},  // Modern Standard Arabic
        {"arz", "arz_Arab"}, // Egyptian Arabic
        {"as", "asm_Beng"},  // Assamese
        {"ast", "ast_Latn"}, // Asturian
        {"az", "azj_Latn"},  // North Azerbaijani
        {"azb", "azb_Arab"}, // South Azerbaijani
        // ── B ──────────────────────────────────────────────────────────────────
        {"ba", "bak_Cyrl"}, // Bashkir
        {"be", "bel_Cyrl"}, // Belarusian
        {"bg", "bul_Cyrl"}, // Bulgarian
        {"bn", "ben_Beng"}, // Bengali
        {"bo", "bod_Tibt"}, // Tibetan
        {"bs", "bos_Latn"}, // Bosnian
        // ── C ──────────────────────────────────────────────────────────────────
        {"ca", "cat_Latn"},  // Catalan
        {"ceb", "ceb_Latn"}, // Cebuano
        {"ckb", "ckb_Arab"}, // Central Kurdish (Sorani)
        {"cs", "ces_Latn"},  // Czech
        {"cy", "cym_Latn"},  // Welsh
        // ── D ──────────────────────────────────────────────────────────────────
        {"da", "dan_Latn"}, // Danish
        {"de", "deu_Latn"}, // German
        // ── E ──────────────────────────────────────────────────────────────────
        {"el", "ell_Grek"}, // Greek
        {"en", "eng_Latn"}, // English
        {"eo", "epo_Latn"}, // Esperanto
        {"es", "spa_Latn"}, // Spanish
        {"et", "est_Latn"}, // Estonian
        {"eu", "eus_Latn"}, // Basque
        // ── F ──────────────────────────────────────────────────────────────────
        {"fa", "pes_Arab"}, // Persian
        {"fi", "fin_Latn"}, // Finnish
        {"fr", "fra_Latn"}, // French
        // ── G ──────────────────────────────────────────────────────────────────
        {"ga", "gle_Latn"}, // Irish
        {"gd", "gla_Latn"}, // Scottish Gaelic
        {"gl", "glg_Latn"}, // Galician
        {"gn", "grn_Latn"}, // Guaraní
        {"gu", "guj_Gujr"}, // Gujarati
        // ── H ──────────────────────────────────────────────────────────────────
        {"he", "heb_Hebr"}, // Hebrew
        {"hi", "hin_Deva"}, // Hindi
        {"hr", "hrv_Latn"}, // Croatian
        {"ht", "hat_Latn"}, // Haitian Creole
        {"hu", "hun_Latn"}, // Hungarian
        {"hy", "hye_Armn"}, // Armenian
        // ── I ──────────────────────────────────────────────────────────────────
        {"id", "ind_Latn"},  // Indonesian
        {"ilo", "ilo_Latn"}, // Ilocano
        {"is", "isl_Latn"},  // Icelandic
        {"it", "ita_Latn"},  // Italian
        // ── J ──────────────────────────────────────────────────────────────────
        {"ja", "jpn_Jpan"}, // Japanese
        {"jv", "jav_Latn"}, // Javanese
        // ── K ──────────────────────────────────────────────────────────────────
        {"ka", "kat_Geor"}, // Georgian
        {"kk", "kaz_Cyrl"}, // Kazakh
        {"km", "khm_Khmr"}, // Khmer
        {"kn", "kan_Knda"}, // Kannada
        {"ko", "kor_Hang"}, // Korean
        {"ku", "kmr_Latn"}, // Kurmanji Kurdish
        {"ky", "kir_Cyrl"}, // Kyrgyz
        // ── L ──────────────────────────────────────────────────────────────────
        {"lb", "ltz_Latn"},  // Luxembourgish
        {"li", "lim_Latn"},  // Limburgish
        {"lmo", "lmo_Latn"}, // Lombard
        {"lo", "lao_Laoo"},  // Lao
        {"lt", "lit_Latn"},  // Lithuanian
        {"lv", "lvs_Latn"},  // Latvian
        // ── M ──────────────────────────────────────────────────────────────────
        {"mai", "mai_Deva"}, // Maithili
        {"mg", "plt_Latn"},  // Malagasy
        {"min", "min_Latn"}, // Minangkabau
        {"mk", "mkd_Cyrl"},  // Macedonian
        {"ml", "mal_Mlym"},  // Malayalam
        {"mn", "khk_Cyrl"},  // Mongolian (Khalkha)
        {"mr", "mar_Deva"},  // Marathi
        {"ms", "zsm_Latn"},  // Malay
        {"mt", "mlt_Latn"},  // Maltese
        {"my", "mya_Mymr"},  // Burmese
        // ── N ──────────────────────────────────────────────────────────────────
        {"ne", "npi_Deva"}, // Nepali
        {"nl", "nld_Latn"}, // Dutch
        {"nn", "nno_Latn"}, // Nynorsk
        {"no", "nob_Latn"}, // Bokmål
        // ── O ──────────────────────────────────────────────────────────────────
        {"oc", "oci_Latn"}, // Occitan
        {"or", "ory_Orya"}, // Odia
        // ── P ──────────────────────────────────────────────────────────────────
        {"pa", "pan_Guru"}, // Punjabi
        {"pl", "pol_Latn"}, // Polish
        {"ps", "pbt_Arab"}, // Pashto
        {"pt", "por_Latn"}, // Portuguese
        // ── Q ──────────────────────────────────────────────────────────────────
        {"qu", "quy_Latn"}, // Quechua
        // ── R ──────────────────────────────────────────────────────────────────
        {"ro", "ron_Latn"}, // Romanian
        {"ru", "rus_Cyrl"}, // Russian
        // ── S ──────────────────────────────────────────────────────────────────
        {"sa", "san_Deva"},  // Sanskrit
        {"sc", "srd_Latn"},  // Sardinian
        {"scn", "scn_Latn"}, // Sicilian
        {"sd", "snd_Arab"},  // Sindhi
        {"si", "sin_Sinh"},  // Sinhala
        {"sk", "slk_Latn"},  // Slovak
        {"sl", "slv_Latn"},  // Slovenian
        {"so", "som_Latn"},  // Somali
        {"sq", "als_Latn"},  // Albanian (Gheg; maps same as "als")
        {"sr", "srp_Cyrl"},  // Serbian
        {"su", "sun_Latn"},  // Sundanese
        {"sv", "swe_Latn"},  // Swedish
        {"sw", "swh_Latn"},  // Swahili
        // ── T ──────────────────────────────────────────────────────────────────
        {"ta", "tam_Taml"}, // Tamil
        {"te", "tel_Telu"}, // Telugu
        {"tg", "tgk_Cyrl"}, // Tajik
        {"th", "tha_Thai"}, // Thai
        {"tk", "tuk_Latn"}, // Turkmen
        {"tl", "tgl_Latn"}, // Tagalog
        {"tr", "tur_Latn"}, // Turkish
        {"tt", "tat_Cyrl"}, // Tatar
        // ── U ──────────────────────────────────────────────────────────────────
        {"ug", "uig_Arab"}, // Uyghur
        {"uk", "ukr_Cyrl"}, // Ukrainian
        {"ur", "urd_Arab"}, // Urdu
        {"uz", "uzn_Latn"}, // Uzbek
        // ── V ──────────────────────────────────────────────────────────────────
        {"vec", "vec_Latn"}, // Venetian
        {"vi", "vie_Latn"},  // Vietnamese
        // ── W ──────────────────────────────────────────────────────────────────
        {"war", "war_Latn"}, // Waray
        // ── Y ──────────────────────────────────────────────────────────────────
        {"yi", "ydd_Hebr"},  // Yiddish
        {"yo", "yor_Latn"},  // Yoruba
        {"yue", "yue_Hant"}, // Cantonese
        // ── Z ──────────────────────────────────────────────────────────────────
        {"zh", "zho_Hans"}, // Chinese (Simplified)
    };
    const auto it = table.find(iso);
    return it != table.end() ? it->second : iso;
}

/**
 * Maps ISO 639-1 codes to M2M-100 language tokens ("__fr__", "__zh__", …).
 * Codes are wrapped in double underscores; no translation table needed for most langs.
 */
static inline std::string
toM2mCode(const std::string& iso)
{
    return "__" + iso + "__";
}

/**
 * Maps FastText LID-176 codes to MBart-50 language tokens ("ar_AR", "en_XX", …).
 * Only LID-176 codes that have a corresponding token in MBart-50 are listed.
 * Unknown codes (including tokens already in MBart-50 format) are returned unchanged.
 */
static inline std::string
toMbartCode(const std::string& iso)
{
    static const std::unordered_map<std::string, std::string> table = {
        {"af", "af_ZA"}, {"ar", "ar_AR"}, {"az", "az_AZ"}, {"bn", "bn_IN"}, {"cs", "cs_CZ"},
        {"de", "de_DE"}, {"en", "en_XX"}, {"es", "es_XX"}, {"et", "et_EE"}, {"fa", "fa_IR"},
        {"fi", "fi_FI"}, {"fr", "fr_XX"}, {"gl", "gl_ES"}, {"gu", "gu_IN"}, {"he", "he_IL"},
        {"hi", "hi_IN"}, {"hr", "hr_HR"}, {"id", "id_ID"}, {"it", "it_IT"}, {"ja", "ja_XX"},
        {"ka", "ka_GE"}, {"kk", "kk_KZ"}, {"km", "km_KH"}, {"ko", "ko_KR"}, {"lt", "lt_LT"},
        {"lv", "lv_LV"}, {"mk", "mk_MK"}, {"ml", "ml_IN"}, {"mn", "mn_MN"}, {"mr", "mr_IN"},
        {"my", "my_MM"}, {"ne", "ne_NP"}, {"nl", "nl_XX"}, {"pl", "pl_PL"}, {"ps", "ps_AF"},
        {"pt", "pt_XX"}, {"ro", "ro_RO"}, {"ru", "ru_RU"}, {"si", "si_LK"}, {"sl", "sl_SI"},
        {"sv", "sv_SE"}, {"sw", "sw_KE"}, {"ta", "ta_IN"}, {"te", "te_IN"}, {"th", "th_TH"},
        {"tl", "tl_XX"}, {"tr", "tr_TR"}, {"uk", "uk_UA"}, {"ur", "ur_PK"}, {"vi", "vi_VN"},
        {"zh", "zh_CN"},
    };
    const auto it = table.find(iso);
    return it != table.end() ? it->second : iso;
}

// ── Compile-time dispatcher ────────────────────────────────────────────────────

/**
 * Convert ISO 639-1 (or native model token) to the compiled model's token format.
 * This is the single point of entry for all language-code conversions.
 */
inline std::string
toModelCode(const std::string& iso)
{
#if defined(JAMI_PLUGIN_TRANSLATION_MODEL_M2M100)
    return toM2mCode(iso);
#elif defined(JAMI_PLUGIN_TRANSLATION_MODEL_MBART50)
    return toMbartCode(iso);
#else
    return toNllbCode(iso);
#endif
}

/**
 * Default fallback language token (English) for the compiled model.
 * Returned when language detection fails or confidence is too low.
 */
inline std::string
modelFallbackLang()
{
#if defined(JAMI_PLUGIN_TRANSLATION_MODEL_M2M100)
    return "__en__";
#elif defined(JAMI_PLUGIN_TRANSLATION_MODEL_MBART50)
    return "en_XX";
#else
    return "eng_Latn";
#endif
}

/**
 * Extract a 2-3 character ICU locale code from a model-specific language token.
 * Used to select the ICU BreakIterator locale for sentence segmentation.
 *
 *   NLLB-200:  "fra_Latn" → "fra"
 *   M2M-100:   "__fr__"   → "fr"
 *   MBart-50:  "fr_XX"    → "fr"
 */
inline std::string
extractIcuLocale(const std::string& token)
{
#if defined(JAMI_PLUGIN_TRANSLATION_MODEL_M2M100)
    // "__fr__" → strip leading __ and trailing __
    if (token.size() >= 4 && token[0] == '_' && token[1] == '_' && token[token.size() - 1] == '_'
        && token[token.size() - 2] == '_')
        return token.substr(2, token.size() - 4);
    return token.empty() ? "en" : token;
#elif defined(JAMI_PLUGIN_TRANSLATION_MODEL_MBART50)
    // "ar_AR" / "en_XX" → strip the _XX / _AR country suffix
    const auto pos = token.find('_');
    if (pos != std::string::npos) {
        return token.substr(0, pos);
    }
    return token.empty() ? "en" : token;
#else
    // "fra_Latn" → first 3 chars (ISO 639-3, valid ICU locale)
    return token.size() >= 3 ? token.substr(0, 3) : token;
#endif
}

// ── Unicode script → ISO 639-1 detection (shared) ────────────────────────────

#ifdef JAMI_PLUGIN_HAVE_USCRIPT
/**
 * Detect the dominant Unicode script in `text` and return the most likely
 * ISO 639-1 language code ("en", "zh", "ja", "ar", …).  Returns "en" when no
 * distinctive non-Latin script is found.  Used as a fast pre-filter fallback when
 * FastText LID confidence is below threshold.
 */
static inline std::string
detectScriptIso(const std::string& text)
{
    std::unordered_map<int, int> counts;
    const char* s = text.c_str();
    const int32_t len = static_cast<int32_t>(text.size());
    for (int32_t i = 0; i < len;) {
        UChar32 cp;
        U8_NEXT(s, i, len, cp);
        if (cp < 0)
            continue;
        UErrorCode err = U_ZERO_ERROR;
        const int sc = static_cast<int>(uscript_getScript(cp, &err));
        if (U_FAILURE(err) || sc == USCRIPT_COMMON || sc == USCRIPT_INHERITED || sc == USCRIPT_LATIN)
            continue;
        counts[sc]++;
    }
    if (counts.empty())
        return "en";

    int dom = USCRIPT_LATIN, domCnt = 0;
    for (const auto& [sc, cnt] : counts)
        if (cnt > domCnt) {
            domCnt = cnt;
            dom = sc;
        }

    switch (static_cast<UScriptCode>(dom)) {
    case USCRIPT_HAN:
        // Kana alongside kanji → Japanese; otherwise default to Simplified Chinese.
        if (counts.count(USCRIPT_HIRAGANA) || counts.count(USCRIPT_KATAKANA))
            return "ja";
        return "zh";
    case USCRIPT_HIRAGANA:
    case USCRIPT_KATAKANA:
        return "ja";
    case USCRIPT_HANGUL:
        return "ko";
    case USCRIPT_ARABIC:
        return "ar";
    case USCRIPT_HEBREW:
        return "he";
    case USCRIPT_CYRILLIC:
        // Known limitation: maps all Cyrillic script to Russian. Ukrainian, Bulgarian,
        // Serbian, Kazakh, and 40+ other languages share this script. FastText LID
        // confidence threshold handles most real-world cases before this fallback is reached.
        return "ru";
    case USCRIPT_GREEK:
        return "el";
    case USCRIPT_THAI:
        return "th";
    case USCRIPT_DEVANAGARI:
        return "hi";
    case USCRIPT_GEORGIAN:
        return "ka";
    case USCRIPT_ARMENIAN:
        return "hy";
    case USCRIPT_TAMIL:
        return "ta";
    case USCRIPT_TELUGU:
        return "te";
    case USCRIPT_KANNADA:
        return "kn";
    case USCRIPT_MALAYALAM:
        return "ml";
    case USCRIPT_SINHALA:
        return "si";
    case USCRIPT_MYANMAR:
        return "my";
    case USCRIPT_KHMER:
        return "km";
    case USCRIPT_LAO:
        return "lo";
    case USCRIPT_TIBETAN:
        return "bo";
    case USCRIPT_ETHIOPIC:
        return "am";
    case USCRIPT_GURMUKHI:
        return "pa";
    case USCRIPT_GUJARATI:
        return "gu";
    case USCRIPT_ORIYA:
        return "or";
    case USCRIPT_BENGALI:
        return "bn";
    default:
        return "en";
    }
}
#else
// Android API < 31: uscript_getScript unavailable; fall back to returning "en".
static inline std::string
detectScriptIso(const std::string&) { return "en"; }
#endif

/**
 * Map the dominant Unicode script of `text` to the compiled model's language token.
 * Returns the model's English fallback when no distinctive non-Latin script is found.
 */
static inline std::string
detectByScript(const std::string& text)
{
    return toModelCode(detectScriptIso(text));
}

} // namespace jami
