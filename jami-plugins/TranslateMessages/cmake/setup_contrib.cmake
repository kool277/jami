# Auto-provisions translation-plugin dependencies into daemon/contrib/<PLATFORM>/.
# Called via include(cmake/setup_contrib.cmake) after CONTRIB_ROOT_PATH / ORT_INC
# are set in CMakeLists.txt.
#
# ONNX Runtime — multi-EP support
# The plugin ships one libonnxruntime_ep_<name>.so per ORT variant so that the
# runtime selector shim (ort_selector/) can pick the right one at load time.
#
# Each variant is discovered from a Python package directory:
#   ORT_CUDA_PYDIR     — onnxruntime-gpu package   (e.g. .venv-cuda/lib/…/onnxruntime)
#   ORT_MIGRAPHX_PYDIR — onnxruntime-migraphx package
#   ORT_ROCM_PYDIR     — onnxruntime-rocm package
#   ORT_DIRECTML_PYDIR — onnxruntime-directml package (Windows)
#   ORT_OPENVINO_PYDIR — onnxruntime-openvino package
#   ORT_CPU_PYDIR      — onnxruntime (CPU) package
#
# If none are set, the active Python venv is probed and used as the sole variant.
# At least one variant must be found for the build to succeed.
#
# ORT_FORCE_EP (optional) — restrict bundling to a single EP:
#   cmake -DORT_FORCE_EP=cuda ...   # bundle CUDA only
#   cmake -DORT_FORCE_EP=cpu  ...   # bundle CPU only
#
# ORT C++ headers (§2) are fetched once from any variant's release archive.
# SentencePiece and fastText (§4, §5) are auto-built from submodules if missing.

# Absolute path to jami-plugins/ root — stable whether built standalone or as a workspace subdir.
get_filename_component(_PLUGINS_ROOT "${PROJECT_SOURCE_DIR}" DIRECTORY)
set(_DEPS_ROOT "${_PLUGINS_ROOT}/deps")

# ── Helper: initialize a submodule if not yet populated ──────────────────────
function(_ensure_submodule _rel_path)
    set(_abs_path "${_PLUGINS_ROOT}/${_rel_path}")
    if(NOT EXISTS "${_abs_path}/CMakeLists.txt")
        find_package(Git QUIET)
        if(NOT GIT_FOUND)
            message(FATAL_ERROR "[deps] Git not found — cannot initialize ${_rel_path} submodule")
        endif()
        message(STATUS "[deps] Initializing submodule: ${_rel_path}")
        execute_process(
            COMMAND ${GIT_EXECUTABLE} submodule update --init "${_rel_path}"
            WORKING_DIRECTORY "${_PLUGINS_ROOT}"
            RESULT_VARIABLE _sub_rc
        )
        if(NOT _sub_rc EQUAL 0)
            message(FATAL_ERROR "[deps] Failed to initialize submodule: ${_rel_path}")
        endif()
    endif()
endfunction()

if(NOT Python3_EXECUTABLE)
    find_package(Python3 REQUIRED COMPONENTS Interpreter)
endif()

# If the found Python doesn't have onnxruntime (e.g. IDEs that don't activate
# the project venv before running cmake), fall back to common venv locations.
# Set ORT_VENV_DIR to skip the search entirely:
#   cmake -DORT_VENV_DIR=/path/to/.venv ...
set(ORT_VENV_DIR "" CACHE PATH
    "Path to the Python venv that has onnxruntime installed (auto-detected if empty)")

execute_process(
    COMMAND ${Python3_EXECUTABLE} -c "import onnxruntime"
    RESULT_VARIABLE _ort_check_rc
    OUTPUT_QUIET ERROR_QUIET
)
if(NOT _ort_check_rc EQUAL 0)
    # Build a list of candidate venv roots to probe. Use get_filename_component
    # to normalize paths — cmake's EXISTS does not resolve ".." components.
    get_filename_component(_src_parent "${PROJECT_SOURCE_DIR}" DIRECTORY)
    get_filename_component(_bin_parent "${CMAKE_BINARY_DIR}" DIRECTORY)
    set(_venv_candidates "")
    if(ORT_VENV_DIR)
        list(APPEND _venv_candidates "${ORT_VENV_DIR}")
    endif()
    list(APPEND _venv_candidates
        "${_src_parent}/.venv"
        "${PROJECT_SOURCE_DIR}/.venv"
        "${_bin_parent}/.venv"
    )
    foreach(_venv ${_venv_candidates})
        if(WIN32)
            set(_venv_py "${_venv}/Scripts/python.exe")
        else()
            set(_venv_py "${_venv}/bin/python3")
        endif()
        if(EXISTS "${_venv_py}")
            execute_process(
                COMMAND "${_venv_py}" -c "import onnxruntime"
                RESULT_VARIABLE _venv_rc
                OUTPUT_QUIET ERROR_QUIET
            )
            if(_venv_rc EQUAL 0)
                message(STATUS "[deps] Using venv Python: ${_venv_py}")
                set(Python3_EXECUTABLE "${_venv_py}")
                break()
            endif()
        endif()
    endforeach()
endif()

# Infer EP name (cuda|rocm|openvino|cpu) from provider libs present in PKG_DIR/capi/.
function(infer_ep_name PKG_DIR EP_NAME_OUT)
    if(WIN32)
        if(EXISTS "${PKG_DIR}/capi/onnxruntime_providers_cuda.dll")
            set(${EP_NAME_OUT} "cuda" PARENT_SCOPE)
        else()
            set(${EP_NAME_OUT} "cpu" PARENT_SCOPE)
        endif()
    else()
        if(EXISTS "${PKG_DIR}/capi/libonnxruntime_providers_cuda.so")
            set(${EP_NAME_OUT} "cuda" PARENT_SCOPE)
        elseif(EXISTS "${PKG_DIR}/capi/libonnxruntime_providers_rocm.so")
            set(${EP_NAME_OUT} "rocm" PARENT_SCOPE)
        elseif(EXISTS "${PKG_DIR}/capi/libonnxruntime_openvino.so"
               OR EXISTS "${PKG_DIR}/capi/libonnxruntime_providers_openvino.so"
               OR EXISTS "${PKG_DIR}/capi/libonnxruntime_vitisai_ep.so")
            set(${EP_NAME_OUT} "openvino" PARENT_SCOPE)
        else()
            set(${EP_NAME_OUT} "cpu" PARENT_SCOPE)
        endif()
    endif()
endfunction()

# Register one ORT variant: symlinks libonnxruntime.so as libonnxruntime_ep_<EP>.so
# in ORT_CONTRIB_DIR, also symlinks provider sub-libs. Appends EP to ORT_EP_NAMES.
function(register_ort_ep PKG_DIR EP_NAME)
    set(_capi "${PKG_DIR}/capi")
    file(MAKE_DIRECTORY "${ORT_CONTRIB_DIR}")

    if(WIN32)
        set(_dest_core "${ORT_CONTRIB_DIR}/onnxruntime_ep_${EP_NAME}.dll")
        set(_core_dll "${_capi}/onnxruntime.dll")
        if(NOT EXISTS "${_core_dll}")
            message(WARNING "[deps] ORT package at ${PKG_DIR} has no onnxruntime.dll — skipping ${EP_NAME}")
            return()
        endif()
        execute_process(COMMAND ${CMAKE_COMMAND} -E copy_if_different "${_core_dll}" "${_dest_core}")
        message(STATUS "[deps] ORT ${EP_NAME}: copied onnxruntime_ep_${EP_NAME}.dll")

        file(GLOB _provider_libs "${_capi}/onnxruntime_providers_*.dll")
        foreach(_plib ${_provider_libs})
            get_filename_component(_pname "${_plib}" NAME)
            set(_pdest "${ORT_CONTRIB_DIR}/${_pname}")
            if(NOT EXISTS "${_pdest}")
                execute_process(COMMAND ${CMAKE_COMMAND} -E copy_if_different "${_plib}" "${_pdest}")
                message(STATUS "[deps] ORT ${EP_NAME}: provider lib → ${_pname}")
            endif()
        endforeach()
    else()
        set(_dest_core "${ORT_CONTRIB_DIR}/libonnxruntime_ep_${EP_NAME}.so")

        # Prefer the unversioned symlink if present, otherwise find the highest
        # versioned .so (libonnxruntime.so.x.y.z). Packages don't always ship the
        # unversioned symlink — onnxruntime-gpu 1.24.4 only ships the versioned one.
        if(EXISTS "${_capi}/libonnxruntime.so")
            set(_real "${_capi}/libonnxruntime.so")
        else()
            file(GLOB _versioned "${_capi}/libonnxruntime.so.*.*.*")
            if(NOT _versioned)
                message(WARNING "[deps] ORT package at ${PKG_DIR} has no libonnxruntime.so* — skipping ${EP_NAME}")
                return()
            endif()
            list(SORT _versioned ORDER DESCENDING)   # highest version first
            list(GET _versioned 0 _real)
        endif()

        execute_process(COMMAND ${CMAKE_COMMAND} -E create_symlink "${_real}" "${_dest_core}")
        message(STATUS "[deps] ORT ${EP_NAME}: linked ${_dest_core} → ${_real}")

        file(GLOB _provider_libs "${_capi}/libonnxruntime_providers_*.so"
                                  "${_capi}/libonnxruntime_${EP_NAME}_ep.so")
        foreach(_plib ${_provider_libs})
            get_filename_component(_pname "${_plib}" NAME)
            set(_pdest "${ORT_CONTRIB_DIR}/${_pname}")
            if(NOT EXISTS "${_pdest}")
                execute_process(COMMAND ${CMAKE_COMMAND} -E create_symlink "${_plib}" "${_pdest}")
                message(STATUS "[deps] ORT ${EP_NAME}: provider lib → ${_pname}")
            endif()
        endforeach()
    endif()

    list(APPEND ORT_EP_NAMES "${EP_NAME}")
    set(ORT_EP_NAMES "${ORT_EP_NAMES}" PARENT_SCOPE)
endfunction()

# ── 1. ONNX Runtime shared libraries (all EP variants) ───────────────────────

set(ORT_CUDA_PYDIR     "" CACHE PATH   "onnxruntime-gpu package dir (contains capi/)")
set(ORT_MIGRAPHX_PYDIR "" CACHE PATH   "onnxruntime-migraphx package dir (AMD MIGraphX EP)")
set(ORT_ROCM_PYDIR     "" CACHE PATH   "onnxruntime-rocm package dir")
set(ORT_DIRECTML_PYDIR "" CACHE PATH   "onnxruntime-directml package dir (Windows DirectML EP)")
set(ORT_OPENVINO_PYDIR "" CACHE PATH   "onnxruntime-openvino package dir")
set(ORT_CPU_PYDIR      "" CACHE PATH   "onnxruntime CPU package dir")
set(ORT_FORCE_EP       "" CACHE STRING "Bundle only this EP (cuda|migraphx|rocm|directml|openvino|cpu); empty = all found")

set(ORT_CONTRIB_DIR "${CONTRIB_ROOT_PATH}/lib/onnxruntime")
set(ORT_EP_NAMES "")     # populated by register_ort_ep calls

# Android: daemon contrib produces a single libonnxruntime.so (with NNAPI).
# No Python package exists for cross-compiled targets — symlink directly.
if(PLATFORM_TYPE STREQUAL "ANDROID")
    set(_android_ort_so "${CONTRIB_ROOT_PATH}/lib/libonnxruntime.so")
    if(EXISTS "${_android_ort_so}")
        file(MAKE_DIRECTORY "${ORT_CONTRIB_DIR}")
        set(_android_ep_dest "${ORT_CONTRIB_DIR}/libonnxruntime_ep_cpu.so")
        if(NOT EXISTS "${_android_ep_dest}")
            execute_process(COMMAND ${CMAKE_COMMAND} -E create_symlink
                "${_android_ort_so}" "${_android_ep_dest}")
        endif()
        list(APPEND ORT_EP_NAMES "cpu")
        message(STATUS "[deps] Android ORT: linked libonnxruntime_ep_cpu.so → ${_android_ort_so}")
    else()
        message(FATAL_ERROR
            "\n[deps] Android libonnxruntime.so not found at ${_android_ort_so}\n"
            "Build daemon contrib for Android first:\n"
            "  ANDROID_NDK=... ANDROID_SDK=... ANDROID_ABI=arm64-v8a bash contrib/build-dependencies.sh\n")
    endif()
endif()

# Register explicitly-specified EPs
foreach(_ep_pair
        "cuda:${ORT_CUDA_PYDIR}"
        "migraphx:${ORT_MIGRAPHX_PYDIR}"
        "rocm:${ORT_ROCM_PYDIR}"
        "directml:${ORT_DIRECTML_PYDIR}"
        "openvino:${ORT_OPENVINO_PYDIR}"
        "cpu:${ORT_CPU_PYDIR}")
    string(REPLACE ":" ";" _pair_list "${_ep_pair}")
    list(GET _pair_list 0 _ep)
    list(GET _pair_list 1 _dir)
    if(WIN32)
        file(GLOB _ep_dir_libs "${_dir}/capi/onnxruntime.dll")
    else()
        file(GLOB _ep_dir_libs "${_dir}/capi/libonnxruntime.so*")
    endif()
    if(_dir AND _ep_dir_libs)
        if(NOT ORT_FORCE_EP OR _ep STREQUAL ORT_FORCE_EP)
            register_ort_ep("${_dir}" "${_ep}")
        endif()
    endif()
endforeach()

# Auto-detect from active venv if no explicit dirs were given
if(NOT ORT_EP_NAMES)
    execute_process(
        COMMAND ${Python3_EXECUTABLE} -c
            "import onnxruntime, os; print(os.path.dirname(onnxruntime.__file__))"
        OUTPUT_VARIABLE _auto_ort_dir
        OUTPUT_STRIP_TRAILING_WHITESPACE
        RESULT_VARIABLE _auto_rc
    )
    if(WIN32)
        file(GLOB _auto_ort_libs "${_auto_ort_dir}/capi/onnxruntime.dll")
    else()
        file(GLOB _auto_ort_libs "${_auto_ort_dir}/capi/libonnxruntime.so*")
    endif()
    if(_auto_rc EQUAL 0 AND _auto_ort_dir AND _auto_ort_libs)
        infer_ep_name("${_auto_ort_dir}" _auto_ep)
        if(NOT "${_auto_ep}" IN_LIST ORT_EP_NAMES)
            if(NOT ORT_FORCE_EP OR _auto_ep STREQUAL ORT_FORCE_EP)
                register_ort_ep("${_auto_ort_dir}" "${_auto_ep}")
            endif()
        endif()
    endif()
endif()

# Fall back to whatever is already symlinked in ORT_CONTRIB_DIR (incremental builds)
if(NOT ORT_EP_NAMES)
    if(WIN32)
        file(GLOB _existing_ep_libs "${ORT_CONTRIB_DIR}/onnxruntime_ep_*.dll")
    else()
        file(GLOB _existing_ep_libs "${ORT_CONTRIB_DIR}/libonnxruntime_ep_*.so")
    endif()
    foreach(_ep_lib ${_existing_ep_libs})
        get_filename_component(_ep_fname "${_ep_lib}" NAME)
        if(WIN32)
            string(REGEX REPLACE "^onnxruntime_ep_(.+)\\.dll$" "\\1" _ep_name "${_ep_fname}")
        else()
            string(REGEX REPLACE "^libonnxruntime_ep_(.+)\\.so$" "\\1" _ep_name "${_ep_fname}")
        endif()
        if(NOT ORT_FORCE_EP OR _ep_name STREQUAL ORT_FORCE_EP)
            list(APPEND ORT_EP_NAMES "${_ep_name}")
            message(STATUS "[deps] ORT ${_ep_name}: already in contrib — using existing")
        endif()
    endforeach()
endif()

if(NOT ORT_EP_NAMES)
    if(ORT_FORCE_EP)
        message(FATAL_ERROR
            "\n[deps] ORT_FORCE_EP=${ORT_FORCE_EP} but no matching package found.\n"
            "Install the package and activate its venv, or set the explicit path:\n"
            "  cuda     → pip install onnxruntime-gpu  / -DORT_CUDA_PYDIR=...\n"
            "  rocm     → -DORT_ROCM_PYDIR=...\n"
            "  openvino → -DORT_OPENVINO_PYDIR=...\n"
            "  cpu      → pip install onnxruntime      / -DORT_CPU_PYDIR=...\n")
    else()
        message(FATAL_ERROR
            "\n[deps] No ONNX Runtime package found.\n"
            "\nInstall at least one package and activate its venv, or set an explicit path:\n"
            "  pip install onnxruntime-gpu==1.24.4    # NVIDIA\n"
            "  cmake -DORT_ROCM_PYDIR=... ...         # AMD (separate venv)\n"
            "\nSee TranslateMessages/BUILDING.md §4 for full instructions.\n")
    endif()
endif()

message(STATUS "[deps] ORT EP variants bundled: ${ORT_EP_NAMES}")

# ── 1b. CUDA runtime libs ─────────────────────────────────────────────────────
# onnxruntime-gpu depends on nvidia-curand-cu12 etc., which pip installs into
# site-packages/nvidia/*/lib/ — not in the system library path.
# Use ldd to find missing deps, locate them in the venv's nvidia packages,
# and symlink into ORT_CONTRIB_DIR so they get bundled in the JPL.
set(_cuda_provider "${ORT_CONTRIB_DIR}/libonnxruntime_providers_cuda.so")
if(EXISTS "${_cuda_provider}")
    execute_process(
        COMMAND sh -c "ldd '${_cuda_provider}' 2>/dev/null | awk '/not found/{print $1}'"
        OUTPUT_VARIABLE _missing_cuda_raw
        OUTPUT_STRIP_TRAILING_WHITESPACE
    )
    if(_missing_cuda_raw)
        string(REPLACE "\n" ";" _missing_cuda_libs "${_missing_cuda_raw}")

        execute_process(
            COMMAND ${Python3_EXECUTABLE} -c
"import sys, os
seen = set()
for p in sys.path:
    nd = os.path.join(p, 'nvidia')
    if os.path.isdir(nd) and nd not in seen:
        seen.add(nd)
        for pkg in os.listdir(nd):
            ld = os.path.join(nd, pkg, 'lib')
            if os.path.isdir(ld):
                print(ld)
"
            OUTPUT_VARIABLE _nvidia_lib_dirs_raw
            OUTPUT_STRIP_TRAILING_WHITESPACE
        )
        string(REPLACE "\n" ";" _nvidia_lib_dirs "${_nvidia_lib_dirs_raw}")

        foreach(_missing ${_missing_cuda_libs})
            set(_found_rt "")
            foreach(_lib_dir ${_nvidia_lib_dirs})
                if(EXISTS "${_lib_dir}/${_missing}")
                    set(_found_rt "${_lib_dir}/${_missing}")
                    break()
                endif()
            endforeach()
            if(_found_rt)
                set(_rtdest "${ORT_CONTRIB_DIR}/${_missing}")
                if(NOT EXISTS "${_rtdest}")
                    execute_process(COMMAND ${CMAKE_COMMAND} -E create_symlink
                        "${_found_rt}" "${_rtdest}")
                endif()
                message(STATUS "[deps] CUDA runtime: bundling ${_missing}")
            else()
                message(WARNING "[deps] CUDA runtime: ${_missing} not found in venv — GPU may fall back to CPU")
            endif()
        endforeach()
    endif()
endif()

# ── 2. ONNX Runtime C++ headers (fetched once from any available EP) ──────────
set(_ort_key_header "${ORT_INC}/onnxruntime_cxx_api.h")
if(NOT EXISTS "${_ort_key_header}")
    message(STATUS "[deps] ORT C++ headers not found — fetching from GitHub release...")

    if(NOT JAMI_ORT_HEADERS_ARCHIVE OR NOT EXISTS "${JAMI_ORT_HEADERS_ARCHIVE}")
        set(_ort_version "1.24.4")

        if(CMAKE_SYSTEM_NAME STREQUAL "Darwin")
            set(_ort_platform "osx-universal2")
            set(_ort_ext "tgz")
        elseif(CMAKE_SYSTEM_NAME STREQUAL "Windows")
            set(_ort_platform "win-x64")
            set(_ort_ext "zip")
        elseif(CMAKE_SYSTEM_NAME STREQUAL "Linux"
               AND CMAKE_SYSTEM_PROCESSOR MATCHES "aarch64|arm64")
            set(_ort_platform "linux-aarch64")
            set(_ort_ext "tgz")
        else()
            set(_ort_platform "linux-x64")
            set(_ort_ext "tgz")
        endif()

        set(_ort_tarball_url
            "https://github.com/microsoft/onnxruntime/releases/download/v${_ort_version}/onnxruntime-${_ort_platform}-${_ort_version}.${_ort_ext}")
        set(_ort_archive "${CMAKE_BINARY_DIR}/ort-release-${_ort_version}.${_ort_ext}")

        if(NOT EXISTS "${_ort_archive}")
            message(STATUS "[deps] Downloading ORT ${_ort_version} headers (~300 MB, cached after first run)...")
            file(DOWNLOAD "${_ort_tarball_url}" "${_ort_archive}"
                SHOW_PROGRESS STATUS _dl_status)
            list(GET _dl_status 0 _dl_rc)
            if(NOT _dl_rc EQUAL 0)
                list(GET _dl_status 1 _dl_err)
                file(REMOVE "${_ort_archive}")
                message(FATAL_ERROR
                    "\n[deps] Failed to download ORT headers: ${_dl_err}\n"
                    "\nDownload manually and re-run cmake with:\n"
                    "  -DJAMI_ORT_HEADERS_ARCHIVE=/path/to/onnxruntime-linux-x64-${_ort_version}.tgz\n"
                    "\nURL: ${_ort_tarball_url}\n")
            endif()
        else()
            message(STATUS "[deps] Using cached ORT release archive: ${_ort_archive}")
        endif()
        set(JAMI_ORT_HEADERS_ARCHIVE "${_ort_archive}")
    endif()

    set(_ort_extract_tmp "${CMAKE_BINARY_DIR}/_ort_extract_tmp")
    file(MAKE_DIRECTORY "${_ort_extract_tmp}")
    execute_process(
        COMMAND ${CMAKE_COMMAND} -E tar xf "${JAMI_ORT_HEADERS_ARCHIVE}"
        WORKING_DIRECTORY "${_ort_extract_tmp}"
        RESULT_VARIABLE _ex_rc
    )
    if(NOT _ex_rc EQUAL 0)
        message(FATAL_ERROR "[deps] Failed to extract ORT headers from ${JAMI_ORT_HEADERS_ARCHIVE}")
    endif()
    # Top-level dir name varies by release
    file(GLOB _ort_inc_candidates "${_ort_extract_tmp}/*/include")
    list(GET _ort_inc_candidates 0 _ort_inc_src)
    if(NOT _ort_inc_src OR NOT EXISTS "${_ort_inc_src}")
        message(FATAL_ERROR "[deps] Could not find include/ in extracted ORT archive at ${_ort_extract_tmp}")
    endif()
    file(MAKE_DIRECTORY "${ORT_INC}")
    execute_process(COMMAND ${CMAKE_COMMAND} -E copy_directory "${_ort_inc_src}" "${ORT_INC}")
    file(REMOVE_RECURSE "${_ort_extract_tmp}")
    message(STATUS "[deps] ORT C++ headers installed to ${ORT_INC}")
else()
    message(STATUS "[deps] ORT C++ headers already in contrib — skipping download")
endif()

# ── 3. Daemon contrib headers (fmt, msgpack, jsoncpp, opendht, …) ────────────
if(NOT EXISTS "${CONTRIB_ROOT_PATH}/include/opendht/logger.h")
    # winmake.py builds into daemon/contrib/build/<pkg>/ without an install step.
    # Merge all per-package include dirs into the flat x64-windows/include/ prefix.
    if(WIN32)
        file(GLOB _per_pkg_incdirs "${CONTRIB_PATH}/build/*/include")
        if(_per_pkg_incdirs)
            file(MAKE_DIRECTORY "${CONTRIB_ROOT_PATH}/include")
            foreach(_incdir ${_per_pkg_incdirs})
                execute_process(
                    COMMAND ${CMAKE_COMMAND} -E copy_directory "${_incdir}" "${CONTRIB_ROOT_PATH}/include"
                )
            endforeach()
            message(STATUS "[deps] Merged daemon contrib headers into ${CONTRIB_ROOT_PATH}/include")
        endif()
    endif()
endif()

if(NOT EXISTS "${CONTRIB_ROOT_PATH}/include/opendht/logger.h")
    find_package(PkgConfig QUIET)
    if(PkgConfig_FOUND)
        pkg_check_modules(OPENDHT_SYS QUIET "opendht>=3.6.0")
    endif()
    if(OPENDHT_SYS_FOUND)
        message(STATUS "[deps] opendht/logger.h not in contrib — using system opendht ${OPENDHT_SYS_VERSION} (>= 3.6.0, compatible)")
    elseif(WIN32)
        message(FATAL_ERROR
            "\n[deps] Daemon contrib headers not found at ${CONTRIB_ROOT_PATH}/include/\n"
            "\nBuild the daemon contrib (~15 min, from repo root in PowerShell):\n"
            "  git submodule update --init daemon\n"
            "  python .\\daemon\\extras\\scripts\\winmake.py\n"
            "\nThen re-run cmake.\n")
    else()
        message(FATAL_ERROR
            "\n[deps] Daemon contrib headers not found at ${CONTRIB_ROOT_PATH}/include/\n"
            "\nBuild the daemon contrib (~15 min, from repo root):\n"
            "  git submodule update --init daemon\n"
            "  cd daemon/contrib && mkdir build-x86_64-linux-gnu && cd build-x86_64-linux-gnu\n"
            "  ../bootstrap && make -j\$(nproc)\n"
            "\nThen re-run cmake.\n")
    endif()
endif()

# ── 4. md4c — auto-init submodule if missing ─────────────────────────────────
if(NOT EXISTS "${MD4C_SRC}/md4c.c")
    _ensure_submodule("deps/md4c")
    if(NOT EXISTS "${MD4C_SRC}/md4c.c")
        message(FATAL_ERROR
            "\n[deps] md4c sources not found at ${MD4C_SRC}\n"
            "Ensure deps/md4c is initialized:\n"
            "  git submodule update --init deps/md4c\n")
    endif()
endif()

# ── 5. SentencePiece — auto-build from submodule if missing ──────────────────
if(WIN32)
    set(_spm_lib_file "${SPM_ROOT}/lib/sentencepiece.lib")
else()
    set(_spm_lib_file "${SPM_ROOT}/lib/libsentencepiece.so")
endif()

if(NOT EXISTS "${_spm_lib_file}")
    set(_spm_src "${_DEPS_ROOT}/sentencepiece")
    _ensure_submodule("deps/sentencepiece")

    if(PLATFORM_TYPE STREQUAL "ANDROID")
        set(_spm_build "${_spm_src}/build-${PLATFORM}")
        file(MAKE_DIRECTORY "${_spm_build}")
        message(STATUS "[deps] Cross-compiling SentencePiece for Android ABI ${PLATFORM}...")
        execute_process(
            COMMAND ${CMAKE_COMMAND}
                -S "${_spm_src}" -B "${_spm_build}"
                -DCMAKE_TOOLCHAIN_FILE=${CMAKE_TOOLCHAIN_FILE}
                -DANDROID_ABI=${PLATFORM}
                -DANDROID_PLATFORM=android-24
                -DSPM_ENABLE_SHARED=ON
            RESULT_VARIABLE _spm_cfg_rc)
        if(NOT _spm_cfg_rc EQUAL 0)
            message(FATAL_ERROR "[deps] SentencePiece cmake configure failed (rc=${_spm_cfg_rc})")
        endif()
        execute_process(
            COMMAND ${CMAKE_COMMAND} --build "${_spm_build}" --parallel
            RESULT_VARIABLE _spm_build_rc)
        if(NOT _spm_build_rc EQUAL 0)
            message(FATAL_ERROR "[deps] SentencePiece build failed (rc=${_spm_build_rc})")
        endif()
        file(MAKE_DIRECTORY "${SPM_ROOT}/lib")
        file(GLOB _spm_so_files "${_spm_build}/src/libsentencepiece.so*")
        foreach(_spm_so_file ${_spm_so_files})
            message(STATUS "[deps] Copying SentencePiece lib ${_spm_so_file} → ${SPM_ROOT}/lib/")
            file(COPY "${_spm_so_file}" DESTINATION "${SPM_ROOT}/lib/" FOLLOW_SYMLINK_CHAIN)
        endforeach()
    else()
        set(_spm_build "${_spm_src}/build")
        file(MAKE_DIRECTORY "${_spm_build}")
        message(STATUS "[deps] Building SentencePiece from ${_spm_src} — this takes a few minutes...")
        set(_spm_cfg_args
            -S "${_spm_src}" -B "${_spm_build}"
            -DSPM_ENABLE_SHARED=ON -DCMAKE_BUILD_TYPE=Release
        )
        if(WIN32)
            list(APPEND _spm_cfg_args "-DCMAKE_CXX_FLAGS=/MD" "-DCMAKE_C_FLAGS=/MD")
        endif()
        execute_process(COMMAND ${CMAKE_COMMAND} ${_spm_cfg_args} RESULT_VARIABLE _spm_cfg_rc)
        if(NOT _spm_cfg_rc EQUAL 0)
            message(FATAL_ERROR "[deps] SentencePiece cmake configure failed (rc=${_spm_cfg_rc})")
        endif()
        set(_spm_build_args --build "${_spm_build}" --parallel)
        if(WIN32)
            list(APPEND _spm_build_args --config Release)
        endif()
        execute_process(COMMAND ${CMAKE_COMMAND} ${_spm_build_args} RESULT_VARIABLE _spm_build_rc)
        if(NOT _spm_build_rc EQUAL 0)
            message(FATAL_ERROR "[deps] SentencePiece build failed (rc=${_spm_build_rc})")
        endif()
        file(MAKE_DIRECTORY "${SPM_ROOT}/lib")
        if(WIN32)
            file(MAKE_DIRECTORY "${SPM_ROOT}/bin")
            execute_process(COMMAND ${CMAKE_COMMAND} -E copy
                "${_spm_build}/src/Release/sentencepiece.lib" "${SPM_ROOT}/lib/sentencepiece.lib")
            execute_process(COMMAND ${CMAKE_COMMAND} -E copy
                "${_spm_build}/src/Release/sentencepiece.dll" "${SPM_ROOT}/bin/sentencepiece.dll")
        else()
            execute_process(COMMAND ${CMAKE_COMMAND} -E create_symlink
                "${_spm_build}/src/libsentencepiece.so"
                "${SPM_ROOT}/lib/libsentencepiece.so")
            if(EXISTS "${_spm_build}/src/libsentencepiece.so.0")
                execute_process(COMMAND ${CMAKE_COMMAND} -E create_symlink
                    "${_spm_build}/src/libsentencepiece.so.0"
                    "${SPM_ROOT}/lib/libsentencepiece.so.0")
            endif()
        endif()
    endif()
    message(STATUS "[deps] SentencePiece built and installed to ${SPM_ROOT}")
endif()

if(NOT EXISTS "${CONTRIB_ROOT_PATH}/include/sentencepiece_processor.h")
    set(_spm_src "${_DEPS_ROOT}/sentencepiece")
    _ensure_submodule("deps/sentencepiece")
    if(EXISTS "${_spm_src}/src/sentencepiece_processor.h")
        file(MAKE_DIRECTORY "${CONTRIB_ROOT_PATH}/include")
        execute_process(COMMAND ${CMAKE_COMMAND} -E copy
            "${_spm_src}/src/sentencepiece_processor.h"
            "${CONTRIB_ROOT_PATH}/include/sentencepiece_processor.h")
        message(STATUS "[deps] Copied sentencepiece_processor.h to contrib")
    else()
        message(FATAL_ERROR
            "\n[deps] sentencepiece_processor.h not found at ${_spm_src}/src/\n"
            "Ensure deps/sentencepiece is initialized:\n"
            "  git submodule update --init deps/sentencepiece\n")
    endif()
endif()

# ── 6. fastText — auto-build from submodule if missing ───────────────────────
if(WIN32)
    set(_ft_lib_file "${CONTRIB_ROOT_PATH}/lib/fasttext.lib")
else()
    set(_ft_lib_file "${CONTRIB_ROOT_PATH}/lib/libfasttext.so")
endif()

if(NOT EXISTS "${_ft_lib_file}")
    set(_ft_src "${_DEPS_ROOT}/fasttext")
    _ensure_submodule("deps/fasttext")

    if(PLATFORM_TYPE STREQUAL "ANDROID")
        set(_ft_build "${_ft_src}/build-${PLATFORM}")
        file(MAKE_DIRECTORY "${_ft_build}")
        set(_ft_cmakelists "${_ft_src}/CMakeLists.txt")
        file(READ "${_ft_cmakelists}" _ft_cmakelists_contents)
        string(REPLACE " -march=native" "" _ft_cmakelists_patched "${_ft_cmakelists_contents}")
        if(NOT _ft_cmakelists_patched STREQUAL _ft_cmakelists_contents)
            file(WRITE "${_ft_cmakelists}" "${_ft_cmakelists_patched}")
            message(STATUS "[deps] Patched -march=native out of fastText CMakeLists.txt for Android cross-compile")
        endif()

        message(STATUS "[deps] Cross-compiling fastText for Android ABI ${PLATFORM}...")
        execute_process(
            COMMAND ${CMAKE_COMMAND}
                -S "${_ft_src}" -B "${_ft_build}"
                -DCMAKE_TOOLCHAIN_FILE=${CMAKE_TOOLCHAIN_FILE}
                -DANDROID_ABI=${PLATFORM}
                -DANDROID_PLATFORM=android-24
                -DBUILD_SHARED_LIBS=ON
                -DCMAKE_POLICY_VERSION_MINIMUM=3.5
            RESULT_VARIABLE _ft_cfg_rc)
        if(NOT _ft_cfg_rc EQUAL 0)
            message(FATAL_ERROR "[deps] fastText cmake configure failed (rc=${_ft_cfg_rc})")
        endif()
        execute_process(
            COMMAND ${CMAKE_COMMAND} --build "${_ft_build}" --parallel --target fasttext-shared
            RESULT_VARIABLE _ft_build_rc)
        if(NOT _ft_build_rc EQUAL 0)
            message(FATAL_ERROR "[deps] fastText build failed (rc=${_ft_build_rc})")
        endif()
        file(MAKE_DIRECTORY "${CONTRIB_ROOT_PATH}/lib")
        file(GLOB _ft_so_files "${_ft_build}/libfasttext.so*")
        foreach(_ft_so_file ${_ft_so_files})
            file(COPY "${_ft_so_file}" DESTINATION "${CONTRIB_ROOT_PATH}/lib/" FOLLOW_SYMLINK_CHAIN)
        endforeach()
    else()
        set(_ft_build "${_ft_src}/build")
        file(MAKE_DIRECTORY "${_ft_build}")
        message(STATUS "[deps] Building fastText from ${_ft_src} — this takes a few minutes...")
        # cmake 4.x removed compat with VERSION < 3.5; fasttext CMakeLists.txt declares 2.8.9
        set(_ft_cfg_args
            -S "${_ft_src}" -B "${_ft_build}"
            -DBUILD_SHARED_LIBS=ON -DCMAKE_BUILD_TYPE=Release
            -DCMAKE_POLICY_VERSION_MINIMUM=3.5
        )
        if(WIN32)
            list(APPEND _ft_cfg_args "-DCMAKE_CXX_FLAGS=/MD" "-DCMAKE_C_FLAGS=/MD")
        endif()
        execute_process(COMMAND ${CMAKE_COMMAND} ${_ft_cfg_args} RESULT_VARIABLE _ft_cfg_rc)
        if(NOT _ft_cfg_rc EQUAL 0)
            message(FATAL_ERROR "[deps] fastText cmake configure failed (rc=${_ft_cfg_rc})")
        endif()
        set(_ft_build_args --build "${_ft_build}" --parallel)
        if(WIN32)
            # Build only the shared library; fasttext-bin links raw "pthread" which
            # fails on MSVC (daemon contrib installs pthreads.lib, not pthread.lib).
            list(APPEND _ft_build_args --config Release --target fasttext-shared)
        endif()
        execute_process(COMMAND ${CMAKE_COMMAND} ${_ft_build_args} RESULT_VARIABLE _ft_build_rc)
        if(NOT _ft_build_rc EQUAL 0)
            message(FATAL_ERROR "[deps] fastText build failed (rc=${_ft_build_rc})")
        endif()
        file(MAKE_DIRECTORY "${CONTRIB_ROOT_PATH}/lib")
        if(WIN32)
            file(MAKE_DIRECTORY "${CONTRIB_ROOT_PATH}/bin")
            execute_process(COMMAND ${CMAKE_COMMAND} -E copy
                "${_ft_build}/Release/fasttext.lib" "${CONTRIB_ROOT_PATH}/lib/fasttext.lib")
            execute_process(COMMAND ${CMAKE_COMMAND} -E copy
                "${_ft_build}/Release/fasttext.dll" "${CONTRIB_ROOT_PATH}/bin/fasttext.dll")
        else()
            execute_process(COMMAND ${CMAKE_COMMAND} -E create_symlink
                "${_ft_build}/libfasttext.so"
                "${CONTRIB_ROOT_PATH}/lib/libfasttext.so")
            if(EXISTS "${_ft_build}/libfasttext.so.0")
                execute_process(COMMAND ${CMAKE_COMMAND} -E create_symlink
                    "${_ft_build}/libfasttext.so.0"
                    "${CONTRIB_ROOT_PATH}/lib/libfasttext.so.0")
            endif()
        endif()
    endif()
    message(STATUS "[deps] fastText built and installed to ${CONTRIB_ROOT_PATH}")
endif()

if(NOT EXISTS "${CONTRIB_ROOT_PATH}/include/fasttext/fasttext.h")
    set(_ft_src "${_DEPS_ROOT}/fasttext")
    _ensure_submodule("deps/fasttext")
    if(EXISTS "${_ft_src}/src/fasttext.h")
        file(MAKE_DIRECTORY "${CONTRIB_ROOT_PATH}/include/fasttext")
        file(GLOB _ft_headers "${_ft_src}/src/*.h")
        foreach(_hdr ${_ft_headers})
            execute_process(COMMAND ${CMAKE_COMMAND} -E copy
                "${_hdr}" "${CONTRIB_ROOT_PATH}/include/fasttext/")
        endforeach()
        message(STATUS "[deps] Copied fastText headers to contrib")
    else()
        message(FATAL_ERROR
            "\n[deps] fasttext.h not found at ${_ft_src}/src/\n"
            "Ensure deps/fasttext is initialized:\n"
            "  git submodule update --init deps/fasttext\n")
    endif()
endif()

# ── 7. Translation models ─────────────────────────────────────────────────────
set(_model_dir "${PROJECT_SOURCE_DIR}/data/models/${JAMI_PLUGIN_TRANSLATION_MODEL}")
if(NOT EXISTS "${_model_dir}/lid.176.ftz")
    message(WARNING
        "\n[deps] Model files for '${JAMI_PLUGIN_TRANSLATION_MODEL}' not found at ${_model_dir}/\n"
        "\nDownload them:\n"
        "  source ${PROJECT_SOURCE_DIR}/../.venv/bin/activate\n"
        "  pip install -r ${PROJECT_SOURCE_DIR}/data/models/requirements.txt\n"
        "  cd ${PROJECT_SOURCE_DIR}/data/models\n"
        "  python3 download_model.py --model-type ${JAMI_PLUGIN_TRANSLATION_MODEL}\n"
        "\nThe build will proceed but the plugin will not work at runtime.\n")
endif()