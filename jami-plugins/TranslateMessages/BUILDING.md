# Building TranslateMessages

Tested on Linux x86_64 and Windows x64. Android / macOS builds follow the same Linux steps but use a different
`PLATFORM_TYPE`.

---

## 1. System prerequisites

### Linux

```bash
sudo apt install cmake ninja-build mold \
                 libicu-dev libfmt-dev \
                 libjsoncpp-dev \
                 binutils python3-venv \
                 git build-essential
```

`mold` is optional but makes linking significantly faster.

### Windows

- **Visual Studio 2022** — Desktop development with C++ workload (MSVC v143 toolset)
- **CMake ≥ 3.21** — from the VS installer or [cmake.org](https://cmake.org/download/)
- **Python ≥ 3.9** — from [python.org](https://www.python.org/downloads/); add to `PATH`
- **Git for Windows** — [git-scm.com](https://git-scm.com/download/win)
- **vcpkg** — used to supply ICU automatically via the manifest:

```powershell
git clone https://github.com/microsoft/vcpkg C:\vcpkg
C:\vcpkg\bootstrap-vcpkg.bat
```

A `vcpkg.json` manifest lives next to `CMakeLists.txt` — vcpkg will install `icu` automatically the first time cmake
configures the project (no manual `vcpkg install` needed).

All subsequent `cmake` commands on Windows should add:

```
-DCMAKE_TOOLCHAIN_FILE=C:\vcpkg\scripts\buildsystems\vcpkg.cmake
```

#### GPU support (Windows, optional)

To use the CUDA execution provider, both of the following must be installed **and their `bin` directories must be in the
system PATH** (not just the current session):

- **CUDA Toolkit 12.x** — [developer.nvidia.com/cuda-downloads](https://developer.nvidia.com/cuda-downloads) → Windows →
  x86_64 → CUDA 12
- **cuDNN 9 for CUDA 12** — [developer.nvidia.com/cudnn-downloads](https://developer.nvidia.com/cudnn-downloads) →
  Windows → x86_64 → CUDA 12

> **Note:** `nvidia-cudnn-cu12` from pip does **not** include Windows DLLs. cuDNN must be downloaded directly from
> NVIDIA (free developer account required).
>
> After installing cuDNN, add its `bin\<cuda-version>\` directory to **System Properties → Environment Variables →
System variables → Path**. The plugin runs inside Jami's process, so a session-only `$env:PATH` change is not
> sufficient.

---

## 2. Clone and init submodules

```bash
git clone <repo-url> jami-plugins
cd jami-plugins
git submodule update --init daemon
```

`daemon/` provides the Jami plugin API headers (`observer.h`, `plugin/jamiplugin.h`, …).  
`deps/md4c`, `deps/sentencepiece`, and `deps/fasttext` are auto-initialized by cmake when first needed (§4–6).

---

## 3. Build daemon contrib (~15 min)

The plugin links against `opendht` from the daemon's own contrib — the system `libopendht-dev` may be too old (
requires >= 3.6.0).

### Linux

```bash
# From repo root
cd daemon/contrib
mkdir build-x86_64-linux-gnu && cd build-x86_64-linux-gnu
../bootstrap
make -j$(nproc)
cd ../../..   # back to repo root
```

### Windows

From the repo root in **PowerShell**:

```powershell
python .\daemon\extras\scripts\winmake.py
```

This builds all daemon contrib packages (opendht, fmt, msgpack, …) into `daemon\contrib\x64-windows\`.

> **Note:** Unlike the Linux `make` which installs headers to a flat unified prefix, `winmake.py` leaves headers in
> per-package subdirectories (`build\<pkg>\include\`). CMake detects this at configure time and merges them automatically
> into `daemon\contrib\x64-windows\include\`.

---

## 4. Python venv + ONNX Runtime

The plugin now selects the execution provider **at runtime** — no compile-time
flag needed. The build bundles every ORT variant it finds; a tiny shim
(`ort_selector/`) picks the best one at load time:

- **Linux**: CUDA → MIGraphX → ROCm → OpenVINO → CPU
- **Windows**: CUDA → DirectML → CPU
- **Android**: QNN → NNAPI → CPU

### Linux / macOS

From the **repo root** (`jami-plugins/`):

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r SDK/certificate_requirements.txt   # pyOpenSSL — needed for JPL signing
pip install -r SDK/requirements.txt             
```

### Windows

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r SDK\certificate_requirements.txt
pip install -r SDK\requirements.txt             
pip install -r TranslateMessages\requirements.txt
```

### Minimal build — one EP

Install the package for your hardware into the active venv and run cmake
normally. The JPL will contain only that EP.

| Hardware                    | Package                           | Platform      | System requirement                         |
|-----------------------------|-----------------------------------|---------------|--------------------------------------------|
| **NVIDIA**                  | `onnxruntime-gpu==1.24.4`         | Linux/Windows | CUDA 12 + cuDNN 9                          |
| **AMD (Linux)**             | `onnxruntime-migraphx`            | Linux         | ROCm installed; AMD ROCm index (see below) |
| **AMD (Linux, fallback)**   | `onnxruntime-rocm==1.22.2.post1`  | Linux         | ROCm 6.2; AMD ROCm index (deprecated EP)   |
| **AMD/Intel/any (Windows)** | `onnxruntime-directml`            | Windows       | Windows 10+ with DirectX 12                |
| **Intel**                   | `onnxruntime-openvino==1.24.1`    | Linux         | OpenVINO runtime installed                 |
| **Apple M-series**          | `onnxruntime==1.24.4`             | macOS         | CoreML EP is built in                      |
| **Android**                 | *(built into daemon contrib ORT)* | Android       | NNAPI ≥ API 27; QNN requires Qualcomm HW   |
| **CPU only**                | `onnxruntime==1.24.4`             | All           | Works everywhere, slower                   |

> **Note:** MIGraphX and ROCm wheels are Linux-only. DirectML is Windows-only. On Windows use `onnxruntime-directml` for
> AMD/Intel GPU or `onnxruntime-gpu` for NVIDIA.
>
> MIGraphX and ROCm packages require the AMD ROCm index:
> `--extra-index-url https://repo.radeon.com/rocm/manylinux/rocm-rel-6.2/`

```bash
# Linux/macOS — pick one:
pip install onnxruntime-gpu==1.24.4                                                           # NVIDIA
# pip install onnxruntime-migraphx --extra-index-url https://repo.radeon.com/rocm/manylinux/rocm-rel-6.2/  # AMD (MIGraphX)
# pip install onnxruntime-rocm==1.22.2.post1 --extra-index-url https://repo.radeon.com/rocm/manylinux/rocm-rel-6.2/  # AMD (ROCm, deprecated)
# pip install onnxruntime-openvino==1.24.1                                                    # Intel
# pip install onnxruntime==1.24.4                                                             # CPU / Apple
```

```powershell
# Windows — pick one:
pip install onnxruntime-gpu==1.24.4    # NVIDIA
# pip install onnxruntime-directml     # AMD / Intel / NVIDIA via DirectX 12
# pip install onnxruntime==1.24.4      # CPU only
```

### Universal build — all EPs in one JPL

To ship a single `.jpl` that runs on NVIDIA, AMD, Intel, and CPU machines,
create a separate venv per ORT variant and pass the package dirs to cmake:

```bash
# Create one venv per variant (only needed on the build machine — no GPU required)
python3 -m venv .venv-cuda     && .venv-cuda/bin/pip     install onnxruntime-gpu==1.24.4
python3 -m venv .venv-migraphx && .venv-migraphx/bin/pip install onnxruntime-migraphx \
    --extra-index-url https://repo.radeon.com/rocm/manylinux/rocm-rel-6.2/
python3 -m venv .venv-rocm     && .venv-rocm/bin/pip     install onnxruntime-rocm==1.22.2.post1 \
    --extra-index-url https://repo.radeon.com/rocm/manylinux/rocm-rel-6.2/
python3 -m venv .venv-cpu      && .venv-cpu/bin/pip      install onnxruntime==1.24.4

# Activate one venv for cmake's Python (used for model export etc.)
source .venv-cuda/bin/activate
```

**Windows universal build** (PowerShell):

```powershell
python -m venv .venv-cuda    ; .venv-cuda\Scripts\pip    install onnxruntime-gpu==1.24.4
python -m venv .venv-directml; .venv-directml\Scripts\pip install onnxruntime-directml
python -m venv .venv-cpu     ; .venv-cpu\Scripts\pip     install onnxruntime==1.24.4
```

The cmake invocations that consume these venvs are in §8 "Universal build".

---

## 5. SentencePiece (build once)

> **cmake auto-builds this.** When `sentencepiece.lib` / `libsentencepiece.so` is missing, cmake
> initializes `deps/sentencepiece` and builds it automatically. The manual steps below are only
> needed if the auto-build fails or you are cross-compiling (e.g. Android).

### Linux / macOS

```bash
# From repo root — uses the deps/sentencepiece submodule
CONTRIB=$(pwd)/daemon/contrib/x86_64-linux-gnu
cmake -S deps/sentencepiece -B deps/sentencepiece/build \
      -DSPM_ENABLE_SHARED=ON -DCMAKE_BUILD_TYPE=Release
cmake --build deps/sentencepiece/build -j$(nproc)

mkdir -p $CONTRIB/lib $CONTRIB/include
ln -sf $(pwd)/deps/sentencepiece/build/src/libsentencepiece.so   $CONTRIB/lib/libsentencepiece.so
ln -sf $(pwd)/deps/sentencepiece/build/src/libsentencepiece.so.0 $CONTRIB/lib/libsentencepiece.so.0
cp deps/sentencepiece/src/sentencepiece_processor.h $CONTRIB/include/
```

### Windows

From the repo root in **PowerShell**:

```powershell
$CONTRIB = "daemon\contrib\x64-windows"
cmake -S deps\sentencepiece -B deps\sentencepiece\build `
      -DCMAKE_BUILD_TYPE=Release `
      -DCMAKE_TOOLCHAIN_FILE=C:\vcpkg\scripts\buildsystems\vcpkg.cmake
cmake --build deps\sentencepiece\build --config Release

New-Item -ItemType Directory -Force "$CONTRIB\lib", "$CONTRIB\include" | Out-Null
Copy-Item deps\sentencepiece\build\src\Release\sentencepiece.lib  "$CONTRIB\lib\"
Copy-Item deps\sentencepiece\src\sentencepiece_processor.h        "$CONTRIB\include\"
```

> **Note:** `-DSPM_ENABLE_SHARED=ON` has no effect on Windows — sentencepiece always builds as a static library (`.lib`)
> on MSVC. The plugin links it statically; no DLL is needed or expected.

---

## 6. fastText (build once)

> **cmake auto-builds this.** When `fasttext.lib` / `libfasttext.so` is missing, cmake
> initializes `deps/fasttext` and builds it automatically. The manual steps below are only
> needed if the auto-build fails or you are cross-compiling (e.g. Android).

### Linux / macOS

```bash
# From repo root — uses the deps/fasttext submodule
CONTRIB=$(pwd)/daemon/contrib/x86_64-linux-gnu
cmake -S deps/fasttext -B deps/fasttext/build \
      -DBUILD_SHARED_LIBS=ON -DCMAKE_BUILD_TYPE=Release
cmake --build deps/fasttext/build -j$(nproc)

mkdir -p $CONTRIB/lib $CONTRIB/include/fasttext
ln -sf $(pwd)/deps/fasttext/build/libfasttext.so   $CONTRIB/lib/libfasttext.so
ln -sf $(pwd)/deps/fasttext/build/libfasttext.so.0 $CONTRIB/lib/libfasttext.so.0
cp deps/fasttext/src/*.h $CONTRIB/include/fasttext/
```

### Windows

From the repo root in **PowerShell**:

```powershell
$CONTRIB = "daemon\contrib\x64-windows"
cmake -S deps\fasttext -B deps\fasttext\build `
      -DBUILD_SHARED_LIBS=ON -DCMAKE_BUILD_TYPE=Release
cmake --build deps\fasttext\build --config Release --target fasttext-shared

New-Item -ItemType Directory -Force "$CONTRIB\lib", "$CONTRIB\bin", "$CONTRIB\include\fasttext" | Out-Null
Copy-Item deps\fasttext\build\Release\fasttext.dll  "$CONTRIB\bin\"
Copy-Item deps\fasttext\build\Release\fasttext.lib  "$CONTRIB\lib\"
Copy-Item deps\fasttext\src\*.h                     "$CONTRIB\include\fasttext\"
```

---

## 7. Download models (required, once per variant)

The model files are not tracked in git — run this script to produce them before building.

### Linux / macOS

```bash
source .venv/bin/activate
pip install -r TranslateMessages/data/models/requirements.txt

cd TranslateMessages/data/models
python3 download_model.py                        # nllb200 (default)
python3 download_model.py --model-type m2m100    # M2M-100 418M
python3 download_model.py --model-type mbart50   # MBart-50 (BART-based, 50 languages)

# Optional quantized variant (reduces size and speeds up CPU inference):
python3 download_model.py --quantize             # INT8
```

### Windows

```powershell
.venv\Scripts\Activate.ps1
pip install -r TranslateMessages\data\models\requirements.txt

Push-Location TranslateMessages\data\models
python download_model.py                        # nllb200 (default)
python download_model.py --model-type m2m100    # M2M-100 418M
python download_model.py --model-type mbart50   # MBart-50 (BART-based, 50 languages)

# Optional quantized variant:
python download_model.py --quantize             # INT8
Pop-Location
```

The script produces (in `data/models/<variant>/`):

- `sentencepiece.bpe.model` — tokenizer loaded by the plugin at runtime
- `shared_vocabulary.json` — token→ID mapping (nllb200 and m2m100 only)
- `lid.176.ftz` — fastText language-detection model (~917 KB, downloaded once)
- ONNX graph files (`encoder_model.onnx`, `decoder_*.onnx`, …)

---

## 8. Configure and build

### Linux

**Standalone (from `TranslateMessages/`):**

```bash
cd TranslateMessages
source ../.venv/bin/activate   # cmake needs the venv's Python to find ORT

cmake -S . -B build-local \
      -DPLATFORM_TYPE=LINUX \
      -DJAMI_PLUGIN_TRANSLATION_MODEL=nllb200 \
      -DCMAKE_SHARED_LINKER_FLAGS="-fuse-ld=mold"

# EP selection is automatic at runtime — no -DJAMI_PLUGIN_EP flag needed.
# To bundle multiple EP variants, see §4 "Universal build" above.
# -DCMAKE_SHARED_LINKER_FLAGS is optional (faster linking with mold)

cmake --build build-local -j$(nproc)
```

**From the `jami-plugins/` workspace root:**

TranslateMessages is opt-in at the workspace level due to its heavy dependencies.
Pass `-DBUILD_TRANSLATE_MESSAGES=ON` to enable it:

```bash
source .venv/bin/activate

cmake -S . -B build \
      -DPLATFORM_TYPE=LINUX \
      -DBUILD_TRANSLATE_MESSAGES=ON \
      -DJAMI_PLUGIN_TRANSLATION_MODEL=nllb200

cmake --build build -j$(nproc)
```

### Windows

From the **repo root** in PowerShell:

```powershell
cmake -S TranslateMessages -B TranslateMessages\build-local `
      -DPLATFORM_TYPE=WINDOWS `
      -DJAMI_PLUGIN_TRANSLATION_MODEL=nllb200 `
      -DCMAKE_TOOLCHAIN_FILE=C:\vcpkg\scripts\buildsystems\vcpkg.cmake

cmake --build TranslateMessages\build-local --config Release
```

cmake auto-detects the active venv's onnxruntime. If cmake picks the wrong Python (e.g. a system install via the Windows
registry), pass the venv path explicitly:

```powershell
      -DORT_VENV_DIR=Z:/path/to/jami-plugins/.venv
```

> **Debug builds:** sentencepiece and fasttext are always built with the Release CRT (`/MD`). CMake automatically forces
`/MD` for all configs so the linker does not see a CRT mismatch. Debug symbols and stepping still work; only
> iterator-level checks (`/MDd`) are unavailable.

### Universal build — all EPs in one JPL

To ship a single `.jpl` that runs on NVIDIA, AMD, Intel, and CPU machines, first create separate venvs per ORT variant (
§4 "Universal build"), then pass the package dirs to cmake.

**Linux / macOS:**

```bash
# From repo root, after creating venvs per §4
source .venv-cuda/bin/activate

# Helper: resolve the onnxruntime package dir inside a venv
ort_pkg() { echo "$1"/lib/python3.*/site-packages/onnxruntime; }

cmake -S TranslateMessages -B TranslateMessages/build-universal \
  -DPLATFORM_TYPE=LINUX \
  -DJAMI_PLUGIN_TRANSLATION_MODEL=nllb200 \
  -DORT_CUDA_PYDIR=$(ort_pkg .venv-cuda) \
  -DORT_MIGRAPHX_PYDIR=$(ort_pkg .venv-migraphx) \
  -DORT_ROCM_PYDIR=$(ort_pkg .venv-rocm) \
  -DORT_CPU_PYDIR=$(ort_pkg .venv-cpu)

cmake --build TranslateMessages/build-universal -j$(nproc)
```

**Windows (PowerShell):**

```powershell
# From repo root, after creating venvs per §4

# Helper: resolve the onnxruntime package dir inside a venv
$ort_pkg = { param($v) "$v\Lib\site-packages\onnxruntime" }

cmake -S TranslateMessages -B TranslateMessages\build-universal `
  -DPLATFORM_TYPE=WINDOWS `
  -DJAMI_PLUGIN_TRANSLATION_MODEL=nllb200 `
  -DORT_CUDA_PYDIR=$(& $ort_pkg .venv-cuda) `
  -DORT_DIRECTML_PYDIR=$(& $ort_pkg .venv-directml) `
  -DORT_CPU_PYDIR=$(& $ort_pkg .venv-cpu) `
  -DCMAKE_TOOLCHAIN_FILE=C:\vcpkg\scripts\buildsystems\vcpkg.cmake

cmake --build TranslateMessages\build-universal --config Release
```

The resulting JPL contains one `libonnxruntime_ep_<name>.so` (Linux) or `onnxruntime_ep_<name>.dll` (Windows) per
variant. At install time the shim loads whichever matches the user's hardware (CUDA → DirectML/MIGraphX → CPU).

---

On the **first run**, cmake will:

- Auto-copy `onnxruntime.dll` from the venv into `daemon/contrib/` (Windows) or symlink `libonnxruntime.so` (
  Linux/macOS)
- Download and extract ORT C++ headers (~300 MB, cached in `build-local/`)
- Error with exact instructions if SentencePiece or fastText are missing

The output JPL is written to:

```
jami-plugins/build/<distribution>/TranslateMessages.jpl
```

### Model variant flag

| `JAMI_PLUGIN_TRANSLATION_MODEL` | Model                   | Notes                                         |
|---------------------------------|-------------------------|-----------------------------------------------|
| `nllb200` *(default)*           | NLLB-200 distilled 600M | Best quality/size trade-off; 200 languages    |
| `m2m100`                        | M2M-100 418M            | Faster, slightly lower quality; 100 languages |
| `mbart50`                       | MBart-large-50          | BART-based; 50 languages                      |

---

After the build completes, sign it following the instructions in [`sign.md`](../sign.md)

## 9. Standalone test binary (optional)

### Linux

```bash
cmake -S . -B build-local \
      -DPLATFORM_TYPE=LINUX \
      -DBUILD_TEST=ON \
      -DJAMI_PLUGIN_TRANSLATION_MODEL=nllb200

cmake --build build-local --target translate_test -j$(nproc)
```

### Windows

```powershell
cmake -S TranslateMessages -B TranslateMessages\build-local `
      -DPLATFORM_TYPE=WINDOWS `
      -DBUILD_TEST=ON `
      -DJAMI_PLUGIN_TRANSLATION_MODEL=nllb200 `
      -DCMAKE_TOOLCHAIN_FILE=C:\vcpkg\scripts\buildsystems\vcpkg.cmake

cmake --build TranslateMessages\build-local --config Release --target translate_test
# For a debug build:
cmake --build TranslateMessages\build-local --config Debug --target translate_test
```

### Interactive REPL

Pass the **parent directory** that contains the model variant folder — the binary appends the model name internally.

```bash
# Linux
cd build-local
./translate_test ../data/models en gpu
# e.g. the binary looks for ../data/models/nllb200/encoder_model.onnx
```

```powershell
# Windows
cd TranslateMessages\build-local\Release
.\translate_test.exe ..\..\..\TranslateMessages\data\models en cpu
```

| Command                         | Description                                                                         |
|---------------------------------|-------------------------------------------------------------------------------------|
| `:lang <iso>`                   | Switch target language (e.g. `fr`, `de`, `eng_Latn`)                                |
| `:device cpu\|gpu`              | Reload model on the chosen device                                                   |
| `:quant auto\|fp32\|int8\|fp16` | Switch quantization (reloads model)                                                 |
| `:bench <file> [repeats]`       | Benchmark a corpus file across all devices (cpu, cuda, rocm, openvino), JSON output |
| `:bench-all <dir> [reps]`       | Discover variant sub-dirs under `<dir>` and compare them                            |
| `:quit`                         | Exit                                                                                |
| `<text>`                        | Translate the input line                                                            |

> **GPU on Windows:** to use `:device gpu`, both CUDA 12 and cuDNN 9 must be installed **system-wide** (see §1). The
`nvidia-cudnn-cu12` pip package does not include Windows DLLs — download cuDNN from NVIDIA's website. If cuDNN is
> missing the CUDA EP fails gracefully and the binary falls back to CPU automatically.

### Standalone (CI / scripting) mode

Pass `--models` or `--corpus` to skip the REPL entirely:

```bash
./translate_test \
  --models path/to/nllb200,path/to/nllb200_int8 \
  --corpus sentences.txt \
  --target-lang fr \
  --repeats 5 \
  --output json          # or csv
  --device gpu
```

| Flag                        | Default | Description                    |
|-----------------------------|---------|--------------------------------|
| `--models <dir1>[,<dir2>…]` | —       | Model directories to benchmark |
| `--corpus <file>`           | —       | One sentence per line          |
| `--target-lang <iso>`       | `en`    | Target language                |
| `--source-lang <iso>`       | auto    | Override language detection    |
| `--repeats <N>`             | `3`     | Timing repetitions per model   |
| `--output csv\|json`        | `json`  | Output format (stdout)         |
| `--csv-file <path>`         | —       | Also write CSV to file         |
| `--device cpu\|gpu`         | `gpu`   | Compute device                 |