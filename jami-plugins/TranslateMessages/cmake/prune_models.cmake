# Prune unneeded files from the JPL staging area before archiving.
# Called by CMakeLists.txt POST_BUILD with -DMODELS_DIR=<path>
# and -DMODEL_VARIANT=<nllb200|m2m100|mbart50>.
#
# Rules:
#  - All model subdirectories except the active one are removed (may be gigabytes).
#  - decoder_model.onnx + .data are removed when both KV cache models exist.
#  - FP32 base (.onnx + .onnx.data) is removed when an INT8 variant exists
#    (INT8 is used on CPU; shipping INT8-only is correct for CPU-only JPLs).
#  - test_*.onnx are development artefacts that must never ship.
#  - HuggingFace metadata files (tokenizer.json, tokenizer_config.json, config.json,
#    vocab.json, added_tokens.json) and the download script are not used at runtime.
#  - shared_vocabulary.json is kept: all three models need it at runtime to
#    resolve language-token IDs.

# ── 1. Remove inactive model variant subdirectories ──────────────────────────
if (MODEL_VARIANT)
    set(_ALL_VARIANTS "nllb200" "m2m100" "mbart50")
    foreach (_variant ${_ALL_VARIANTS})
        if (NOT "${_variant}" STREQUAL "${MODEL_VARIANT}")
            set(_variant_dir "${MODELS_DIR}/${_variant}")
            if (EXISTS "${_variant_dir}")
                message(STATUS "Pruning variant directory (not active): ${_variant_dir}")
                file(REMOVE_RECURSE "${_variant_dir}")
            endif ()
        endif ()
    endforeach ()
    set(_MODEL_SUBDIR "${MODELS_DIR}/${MODEL_VARIANT}")
else ()
    set(_MODEL_SUBDIR "")
endif ()

# ── 2. Intra-model pruning rules ─────────────────────────────────────────────
macro(prune_model_dir dir)
    set(KV_INIT     "${dir}/decoder_init_kv_model.onnx")
    set(KV_PAST     "${dir}/decoder_with_past_model.onnx")
    set(KV_INIT_INT8 "${dir}/decoder_init_kv_model_int8.onnx")
    set(KV_PAST_INT8 "${dir}/decoder_with_past_model_int8.onnx")

    # Drop the beam-search fallback decoder when KV cache models are present.
    if ((EXISTS "${KV_INIT}" OR EXISTS "${KV_INIT_INT8}") AND
    (EXISTS "${KV_PAST}" OR EXISTS "${KV_PAST_INT8}"))
        foreach (f
                "${dir}/decoder_model.onnx"
                "${dir}/decoder_model.onnx.data"
                "${dir}/decoder_model_int8.onnx"
                "${dir}/decoder_model_int8.onnx.data")
            if (EXISTS "${f}")
                message(STATUS "Pruning (superseded by KV cache): ${f}")
                file(REMOVE "${f}")
            endif ()
        endforeach ()
    endif ()

    # Drop FP32 base + sidecar when a smaller INT8 variant is available.
    foreach (stem encoder_model decoder_init_kv_model decoder_with_past_model)
        if (EXISTS "${dir}/${stem}_int8.onnx")
            foreach (f
                    "${dir}/${stem}.onnx"
                    "${dir}/${stem}.onnx.data")
                if (EXISTS "${f}")
                    message(STATUS "Pruning (superseded by INT8): ${f}")
                    file(REMOVE "${f}")
                endif ()
            endforeach ()
        endif ()
    endforeach ()

    # Drop HuggingFace metadata and download script — not used at runtime.
    foreach (f
            "${dir}/tokenizer.json"
            "${dir}/tokenizer_config.json"
            "${dir}/config.json"
            "${dir}/download_model.py"
            "${dir}/vocab.json"
            "${dir}/added_tokens.json")
        if (EXISTS "${f}")
            message(STATUS "Pruning (not needed at runtime): ${f}")
            file(REMOVE "${f}")
        endif ()
    endforeach ()

    file(REMOVE_RECURSE "${dir}/__pycache__")

    # Drop test artefacts.
    file(GLOB _test_models "${dir}/test_*.onnx")
    foreach (f ${_test_models})
        message(STATUS "Pruning (test artefact): ${f}")
        file(REMOVE "${f}")
    endforeach ()
endmacro()

# ── 3. Install model-specific preferences files ───────────────────────────────
# preferences_<variant>.json overrides preferences.json so each model exposes
# only the languages it handles correctly (e.g. m2m100 omits languages that
# produce garbage output).
if (MODEL_VARIANT)
    set(_prefs_src "${CMAKE_CURRENT_LIST_DIR}/data/preferences_${MODEL_VARIANT}.json")
    set(_prefs_dst "${MODELS_DIR}/../preferences.json")
    if (EXISTS "${_prefs_src}" AND EXISTS "${_prefs_dst}")
        file(COPY_FILE "${_prefs_src}" "${_prefs_dst}")
        message(STATUS "[prune] Installed ${MODEL_VARIANT}-specific preferences.json")
    endif ()

    set(_acc_prefs_src "${CMAKE_CURRENT_LIST_DIR}/data/accountpreferences_${MODEL_VARIANT}.json")
    set(_acc_prefs_dst "${MODELS_DIR}/../accountpreferences.json")
    if (EXISTS "${_acc_prefs_src}" AND EXISTS "${_acc_prefs_dst}")
        file(COPY_FILE "${_acc_prefs_src}" "${_acc_prefs_dst}")
        message(STATUS "[prune] Installed ${MODEL_VARIANT}-specific accountpreferences.json")
    endif ()
endif ()

# ── 4. Apply pruning to active variant subdirectory ───────────────────────────
if (_MODEL_SUBDIR AND EXISTS "${_MODEL_SUBDIR}")
    prune_model_dir("${_MODEL_SUBDIR}")
endif ()

# ── 5. Apply pruning to flat root path (legacy / nllb200 layout) ─────────────
prune_model_dir("${MODELS_DIR}")