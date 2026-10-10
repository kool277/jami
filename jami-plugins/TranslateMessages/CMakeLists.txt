# Copyright (C) 2023-2026 Savoir-faire Linux Inc.

# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation; either version 3 of the License, or
# (at your option) any later version.

# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301 USA.

cmake_minimum_required(VERSION 3.10)

set(ProjectName TranslateMessages)
set(Version 1.0.1)

project(${ProjectName} VERSION ${Version})

# Translation model variant (default: m2m100). Options: nllb200 | m2m100 | mbart50.
set(JAMI_PLUGIN_TRANSLATION_MODEL "m2m100" CACHE STRING
        "Translation model variant: nllb200 | m2m100 | mbart50")
set_property(CACHE JAMI_PLUGIN_TRANSLATION_MODEL PROPERTY STRINGS
        "nllb200" "m2m100" "mbart50")

if (JAMI_PLUGIN_TRANSLATION_MODEL STREQUAL "m2m100")
    add_compile_definitions(JAMI_PLUGIN_TRANSLATION_MODEL_M2M100=1)
elseif (JAMI_PLUGIN_TRANSLATION_MODEL STREQUAL "mbart50")
    add_compile_definitions(JAMI_PLUGIN_TRANSLATION_MODEL_MBART50=1)
else ()
    add_compile_definitions(JAMI_PLUGIN_TRANSLATION_MODEL_NLLB200=1)
endif ()

message(STATUS "Translation model: ${JAMI_PLUGIN_TRANSLATION_MODEL}")

# EP selection is fully automatic at runtime — no compile-time flag needed.
# The plugin ships all ORT variants found during the build and a small shim
# (ort_selector/) picks the right one at load time:
#   CUDA (NVIDIA) → ROCm (AMD) → OpenVINO (Intel) → CoreML (Apple) → CPU
#
# To bundle multiple EP variants, point cmake at additional ORT package dirs:
#   cmake -DORT_CUDA_PYDIR=.venv-cuda/lib/python3.x/site-packages/onnxruntime \
#         -DORT_ROCM_PYDIR=.venv-rocm/lib/python3.x/site-packages/onnxruntime ...
# See cmake/setup_contrib.cmake and BUILDING.md §4 for details.

configure_file(
        ${CMAKE_CURRENT_SOURCE_DIR}/manifest.json.in
        ${CMAKE_CURRENT_BINARY_DIR}/manifest_configured.json
        @ONLY
)

option(DEBUG "Build in debug mode" OFF)

set(PLATFORM_TYPE $ENV{PLATFORM_TYPE}) # can be LINUX, ANDROID, MACOS, or WINDOWS
if (PLATFORM_TYPE STREQUAL "ANDROID")
    set(PLATFORM $ENV{ANDROID_ABI}) # can be arm64-v8a, armeabi-v7a or x86_64
elseif (PLATFORM_TYPE STREQUAL "LINUX")
    set(PLATFORM x86_64-linux-gnu)
elseif (PLATFORM_TYPE STREQUAL "MACOS")
    set(PLATFORM x86_64-apple-darwin)
elseif (PLATFORM_TYPE STREQUAL "WINDOWS" OR WIN32)
    set(PLATFORM_TYPE "WINDOWS")
    set(PLATFORM x64-windows)
else ()
    message(FATAL_ERROR "PLATFORM_TYPE not set. Use LINUX, ANDROID, MACOS, or WINDOWS.")
endif ()

# Desktop: CONTRIB_PLATFORM == PLATFORM; Android needs explicit mapping.
set(CONTRIB_PLATFORM ${PLATFORM})
set(distribution     ${PLATFORM})
if (PLATFORM STREQUAL "arm64-v8a")
    set(CONTRIB_PLATFORM aarch64-linux-android)
    set(distribution     android)
elseif (PLATFORM STREQUAL "armeabi-v7a")
    set(CONTRIB_PLATFORM arm-linux-androideabi)
    set(distribution     android)
elseif (PLATFORM STREQUAL "x86_64")
    set(CONTRIB_PLATFORM x86_64-linux-android)
    set(distribution     android)
endif ()

message("PLATFORM_TYPE: ${PLATFORM_TYPE}")
message("PLATFORM: ${PLATFORM}")
message("CONTRIB_PLATFORM: ${CONTRIB_PLATFORM}")
message("distribution: ${distribution}")

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED True)
if(NOT DEFINED DAEMON OR NOT DAEMON)
    get_filename_component(DAEMON "${PROJECT_SOURCE_DIR}/../daemon" ABSOLUTE)
endif()
set(CONTRIB_PATH      ${DAEMON}/contrib)
set(PLUGINS_LIB       ${PROJECT_SOURCE_DIR}/../lib)
set(MD4C_SRC          ${PROJECT_SOURCE_DIR}/../deps/md4c/src)
set(CONTRIB_ROOT_PATH ${CONTRIB_PATH}/${CONTRIB_PLATFORM})
set(SDK_PATH          ${PROJECT_SOURCE_DIR}/../SDK)

if (NOT WIN32)
    # $ORIGIN keeps runtime lib paths relative inside the JPL on ELF platforms.
    set(CMAKE_BUILD_WITH_INSTALL_RPATH TRUE)
    set(CMAKE_INSTALL_RPATH "$ORIGIN")
    # The Android NDK toolchain leaves CMAKE_SHARED_LIBRARY_RUNTIME_CXX_FLAG
    # empty, which makes CMake silently drop CMAKE_INSTALL_RPATH (no -rpath is
    # emitted). Re-enable it so $ORIGIN is baked into the .so and CMake handles
    # the per-generator $ escaping for us.
    if (CMAKE_SYSTEM_NAME STREQUAL "Android")
        set(CMAKE_SHARED_LIBRARY_RUNTIME_CXX_FLAG "-Wl,-rpath,")
        set(CMAKE_SHARED_LIBRARY_RUNTIME_CXX_FLAG_SEP ":")
    endif ()
    # -Bsymbolic binds internal symbol references locally (ELF/ld only).
    # --enable-new-dtags emits DT_RUNPATH (not DT_RPATH): Android's bionic linker
    # honors DT_RUNPATH for resolving a library's own DT_NEEDED deps but ignores
    # DT_RPATH, so this is required for $ORIGIN sibling resolution on Android.
    set(CMAKE_SHARED_LINKER_FLAGS "-Wl,-Bsymbolic -Wl,--enable-new-dtags")
endif ()
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

list(APPEND CMAKE_FIND_ROOT_PATH ${CONTRIB_ROOT_PATH})
set(CMAKE_FIND_ROOT_PATH_MODE_PACKAGE BOTH)
list(APPEND CMAKE_PREFIX_PATH ${CONTRIB_ROOT_PATH})

add_compile_definitions(MSGPACK_NO_BOOST)

if (MSVC)
    # sentencepiece.lib and fasttext.lib are always built with /MD (Release CRT).
    # Replace /MDd with /MD in every config's flags so the linker sees a uniform CRT.
    foreach(_f CMAKE_CXX_FLAGS_DEBUG CMAKE_CXX_FLAGS_RELEASE
            CMAKE_CXX_FLAGS_MINSIZEREL CMAKE_CXX_FLAGS_RELWITHDEBINFO
            CMAKE_C_FLAGS_DEBUG CMAKE_C_FLAGS_RELEASE
            CMAKE_C_FLAGS_MINSIZEREL CMAKE_C_FLAGS_RELWITHDEBINFO)
        string(REGEX REPLACE "/MDd?" " /MD" ${_f} "${${_f}}")
    endforeach()
    add_compile_options(/utf-8 /W3 /Zc:preprocessor)
    add_compile_options($<$<CONFIG:Debug>:/Od> $<$<NOT:$<CONFIG:Debug>>:/O2>)
    add_compile_definitions($<$<CONFIG:Debug>:__DEBUG__>)
else ()
    if (DEBUG)
        set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -g -fsanitize=address -Wall -Wextra -Wno-unused-parameter")
        add_definitions(-D__DEBUG__)
    else ()
        set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -O3 -Wall -Wextra -Wno-unused-parameter")
    endif ()
endif ()

# ORT_CONTRIB_DIR: where setup_contrib.cmake places libonnxruntime_ep_*.so files.
# ORT_INC:         ORT C++ headers (fetched once by setup_contrib.cmake).
# SPM_ROOT:        SentencePiece root (lib/ + include/ symlinked by hand).
set(ORT_CONTRIB_DIR ${CONTRIB_ROOT_PATH}/lib/onnxruntime)
set(ORT_INC         ${CONTRIB_ROOT_PATH}/include/onnxruntime/session)
set(SPM_ROOT        ${CONTRIB_ROOT_PATH})

include(cmake/setup_contrib.cmake)

# ort_selector/ort_selector.cpp is compiled directly into the plugin rather
# than as a separate shim library. It defines OrtGetApiBase() — the one ORT
# symbol the plugin needs at link time — and installs a constructor that
# dlopen's the right libonnxruntime_ep_*.so before any ORT C++ calls are made.
set(plugin_SRC
        src/ort_selector/ort_selector.cpp
        src/main.cpp
        ${MD4C_SRC}/md4c.c
        ${MD4C_SRC}/md4c-html.c
        ${MD4C_SRC}/entity.c
        src/TranslationChatHandler.cpp
        src/TranslationPreferenceHandler.cpp
        src/TranslationChatSubscriber.cpp
        src/Translator.cpp          # lifecycle: EP setup, constructor, destructor, CPU reload
        src/TranslatorVocab.cpp     # vocabulary loading and tokenizer helpers
        src/TranslatorDecode.cpp    # KV-cache greedy decode and beam-search inference
        src/TranslatorText.cpp      # text preprocessing and public translate() API
        src/TranslationWorker.cpp
        ${PLUGINS_LIB}/common.cpp
)

if (NOT PLATFORM_TYPE STREQUAL "ANDROID")
    find_package(ICU REQUIRED COMPONENTS uc i18n)
endif ()

find_package(PkgConfig REQUIRED)
pkg_search_module(jsoncpp REQUIRED IMPORTED_TARGET jsoncpp)

add_library(${ProjectName} SHARED ${plugin_SRC})

target_include_directories(${ProjectName} PUBLIC
        ${PROJECT_SOURCE_DIR}/src
        ${DAEMON}/src
        ${CONTRIB_PATH}/${CONTRIB_PLATFORM}/include
        ${ORT_INC}
        ${SPM_ROOT}/include
        ${PLUGINS_LIB}
        ${MD4C_SRC}
)

link_directories(
        ${CONTRIB_PATH}/${CONTRIB_PLATFORM}/lib
        ${SPM_ROOT}/lib
)

# No explicit ORT lib: ort_selector.cpp defines OrtGetApiBase() directly,
# so there is no DT_NEEDED for libonnxruntime.so/dll.
if (WIN32)
    set(_spm_lib ${SPM_ROOT}/lib/sentencepiece.lib)
    set(_ft_lib  ${CONTRIB_ROOT_PATH}/lib/fasttext.lib)
else ()
    set(_spm_lib ${SPM_ROOT}/lib/libsentencepiece.so)
    set(_ft_lib  ${CONTRIB_ROOT_PATH}/lib/libfasttext.so)
endif ()
target_link_libraries(${ProjectName} PUBLIC
        ${_spm_lib}
        ${_ft_lib}
        PkgConfig::jsoncpp
        $<$<NOT:$<STREQUAL:${PLATFORM_TYPE},ANDROID>>:ICU::i18n>
        $<$<NOT:$<STREQUAL:${PLATFORM_TYPE},ANDROID>>:ICU::uc>
        $<$<NOT:$<BOOL:${WIN32}>>:${CMAKE_DL_LIBS}>  # dlopen/dlsym — ELF only
)

set(_jpl_lib_dir "${PROJECT_BINARY_DIR}/jpl/lib/${PLATFORM}")
set_target_properties(${ProjectName} PROPERTIES
        # Jami's plugin loader looks for lib<PLUGIN_ID>.so / <PLUGIN_ID>.dll.
        OUTPUT_NAME "${ProjectName}"
        LIBRARY_OUTPUT_DIRECTORY                "${_jpl_lib_dir}"
        LIBRARY_OUTPUT_DIRECTORY_RELEASE        "${_jpl_lib_dir}"
        LIBRARY_OUTPUT_DIRECTORY_DEBUG          "${_jpl_lib_dir}"
        LIBRARY_OUTPUT_DIRECTORY_RELWITHDEBINFO "${_jpl_lib_dir}"
        LIBRARY_OUTPUT_DIRECTORY_MINSIZEREL     "${_jpl_lib_dir}"
        # On Windows the DLL goes to RUNTIME_OUTPUT_DIRECTORY (not LIBRARY_OUTPUT_DIRECTORY).
        # Per-config variants must be set explicitly — MSVC multi-config generators
        # append the config name (Release/, Debug/) unless overridden here.
        RUNTIME_OUTPUT_DIRECTORY                "${_jpl_lib_dir}"
        RUNTIME_OUTPUT_DIRECTORY_RELEASE        "${_jpl_lib_dir}"
        RUNTIME_OUTPUT_DIRECTORY_DEBUG          "${_jpl_lib_dir}"
        RUNTIME_OUTPUT_DIRECTORY_RELWITHDEBINFO "${_jpl_lib_dir}"
        RUNTIME_OUTPUT_DIRECTORY_MINSIZEREL     "${_jpl_lib_dir}"
)

add_custom_command(
        TARGET ${ProjectName}
        PRE_BUILD
        COMMAND ${Python3_EXECUTABLE} ${SDK_PATH}/jplManipulation.py --preassemble --build-dir ${PROJECT_BINARY_DIR} --plugin=${ProjectName} --distribution=${distribution} --data-subdir=models/${JAMI_PLUGIN_TRANSLATION_MODEL}
        COMMENT "Assembling plugin files"
)
add_custom_command(
        TARGET ${ProjectName}
        PRE_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy
        ${CMAKE_CURRENT_BINARY_DIR}/manifest_configured.json
        ${PROJECT_BINARY_DIR}/jpl/manifest.json
        COMMENT "Installing model-specific manifest.json"
)

if (WIN32)
    set(_spm_runtime  ${SPM_ROOT}/bin/sentencepiece.dll)
    set(_ft_runtime   ${CONTRIB_ROOT_PATH}/bin/fasttext.dll)
    set(_spm_dst_name sentencepiece.dll)
    set(_ft_dst_name  fasttext.dll)
else ()
    set(_spm_runtime  ${SPM_ROOT}/lib/libsentencepiece.so)
    set(_ft_runtime   ${CONTRIB_ROOT_PATH}/lib/libfasttext.so)
    set(_spm_dst_name libsentencepiece.so)
    set(_ft_dst_name  libfasttext.so)
endif ()
if(EXISTS "${_spm_runtime}")
    add_custom_command(TARGET ${ProjectName} POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E copy
            ${_spm_runtime}
            ${_jpl_lib_dir}/${_spm_dst_name}
            COMMENT "Copying sentencepiece runtime lib into JPL"
    )
endif()
if(EXISTS "${_ft_runtime}")
    add_custom_command(TARGET ${ProjectName} POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E copy
            ${_ft_runtime}
            ${_jpl_lib_dir}/${_ft_dst_name}
            COMMENT "Copying fasttext runtime lib into JPL"
    )
endif()
if (NOT WIN32)
    # Copy versioned SONAME symlinks only when they exist — Android builds use
    # unversioned SONAMEs so .so.0 files are absent there.
    if(EXISTS "${SPM_ROOT}/lib/libsentencepiece.so.0")
        add_custom_command(TARGET ${ProjectName} POST_BUILD
                COMMAND ${CMAKE_COMMAND} -E copy
                ${SPM_ROOT}/lib/libsentencepiece.so.0
                ${_jpl_lib_dir}/libsentencepiece.so.0
                COMMENT "Copying libsentencepiece.so.0 into JPL"
        )
    endif()
    if(EXISTS "${CONTRIB_ROOT_PATH}/lib/libfasttext.so.0")
        add_custom_command(TARGET ${ProjectName} POST_BUILD
                COMMAND ${CMAKE_COMMAND} -E copy
                ${CONTRIB_ROOT_PATH}/lib/libfasttext.so.0
                ${_jpl_lib_dir}/libfasttext.so.0
                COMMENT "Copying libfasttext.so.0 into JPL"
        )
    endif()
endif ()

# Bundle all EP variant libs into the JPL root.
# Root-level entries are extracted to the plugin directory — $ORIGIN dlopen works correctly.
if (WIN32)
    file(GLOB _all_ort_libs "${ORT_CONTRIB_DIR}/*.dll")
else ()
    file(GLOB _all_ort_libs "${ORT_CONTRIB_DIR}/lib*.so*")
endif ()
foreach (_plib ${_all_ort_libs})
    get_filename_component(_pname "${_plib}" NAME)
    add_custom_command(TARGET ${ProjectName} POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E copy_if_different
            "${_plib}"
            "${PROJECT_BINARY_DIR}/jpl/${_pname}"
            COMMENT "Bundling ORT lib: ${_pname}"
    )
endforeach ()

if (PLATFORM_TYPE STREQUAL "MACOS")
    target_compile_definitions(${ProjectName} PRIVATE JAMI_PLUGIN_EP_COREML=1)
endif ()

add_custom_command(TARGET ${ProjectName} POST_BUILD
        COMMAND ${CMAKE_COMMAND}
        -DMODELS_DIR=${PROJECT_BINARY_DIR}/jpl/data/models
        -DMODEL_VARIANT=${JAMI_PLUGIN_TRANSLATION_MODEL}
        -P ${PROJECT_SOURCE_DIR}/cmake/prune_models.cmake
        COMMENT "Pruning unneeded ONNX models from JPL staging area"
)

add_custom_command(TARGET ${ProjectName} POST_BUILD
        COMMAND ${Python3_EXECUTABLE} ${SDK_PATH}/jplManipulation.py --assemble --build-dir ${PROJECT_BINARY_DIR} --plugin=${ProjectName} --distribution=${distribution}
        COMMENT "Generating JPL archive: ${ProjectName}.jpl"
)

# ---------------------------------------------------------------------------
# Optional test executable — configure with -DBUILD_TEST=ON
# ---------------------------------------------------------------------------
option(BUILD_TEST "Build standalone translate_test executable" OFF)

if (BUILD_TEST)
    add_executable(translate_test
            src/ort_selector/ort_selector.cpp
            test/test_main.cpp
            src/Translator.cpp
            src/TranslatorVocab.cpp
            src/TranslatorDecode.cpp
            src/TranslatorText.cpp
            ${MD4C_SRC}/md4c.c
            ${MD4C_SRC}/md4c-html.c
            ${MD4C_SRC}/entity.c
    )
    target_include_directories(translate_test PRIVATE
            ${PROJECT_SOURCE_DIR}/src
            ${DAEMON}/src
            ${CONTRIB_PATH}/${CONTRIB_PLATFORM}/include
            ${ORT_INC}
            ${SPM_ROOT}/include
            ${PLUGINS_LIB}
            ${MD4C_SRC}
    )
    target_link_libraries(translate_test PRIVATE
            ${_spm_lib}
            ${_ft_lib}
            PkgConfig::jsoncpp
            ICU::i18n
            ICU::uc
            $<$<NOT:$<BOOL:${WIN32}>>:${CMAKE_DL_LIBS}>
    )
    if (NOT WIN32)
        set_target_properties(translate_test PROPERTIES BUILD_RPATH "$ORIGIN")
        if(EXISTS "${SPM_ROOT}/lib/libsentencepiece.so.0")
            add_custom_command(TARGET translate_test POST_BUILD
                    COMMAND ${CMAKE_COMMAND} -E copy_if_different
                    ${SPM_ROOT}/lib/libsentencepiece.so.0
                    $<TARGET_FILE_DIR:translate_test>/libsentencepiece.so.0
                    COMMENT "Copying libsentencepiece.so.0 next to translate_test"
            )
        endif()
        if(EXISTS "${CONTRIB_ROOT_PATH}/lib/libfasttext.so.0")
            add_custom_command(TARGET translate_test POST_BUILD
                    COMMAND ${CMAKE_COMMAND} -E copy_if_different
                    ${CONTRIB_ROOT_PATH}/lib/libfasttext.so.0
                    $<TARGET_FILE_DIR:translate_test>/libfasttext.so.0
                    COMMENT "Copying libfasttext.so.0 next to translate_test"
            )
        endif()
    else ()
        if (EXISTS "${_ft_runtime}")
            add_custom_command(TARGET translate_test POST_BUILD
                    COMMAND ${CMAKE_COMMAND} -E copy_if_different
                    ${_ft_runtime}
                    $<TARGET_FILE_DIR:translate_test>/fasttext.dll
                    COMMENT "Copying fasttext.dll next to translate_test"
            )
        endif ()
    endif ()
    foreach (_plib ${_all_ort_libs})
        get_filename_component(_pname "${_plib}" NAME)
        add_custom_command(TARGET translate_test POST_BUILD
                COMMAND ${CMAKE_COMMAND} -E copy_if_different
                "${_plib}"
                "$<TARGET_FILE_DIR:translate_test>/${_pname}"
        )
    endforeach ()
    if (PLATFORM_TYPE STREQUAL "MACOS")
        target_compile_definitions(translate_test PRIVATE JAMI_PLUGIN_EP_COREML=1)
    endif ()
endif ()