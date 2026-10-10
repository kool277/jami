// ort_selector/ort_selector.cpp
//
// Runtime ORT execution-provider selector compiled into the plugin.
// Probes for GPU hardware and dlopen's the matching EP variant before the
// first ORT call; falls back through the list until one loads.
// RTLD_GLOBAL puts ORT symbols in the global namespace for provider sub-libs.
// GPU detection uses device nodes (/dev/nvidia0) instead of RTLD_NOLOAD
// because Jami never pre-loads CUDA/ROCm, so RTLD_NOLOAD always returns false.

#include "onnxruntime_c_api.h"

#include <cstdio>
#include <string>

using GetApiBaseFn = const OrtApiBase*(ORT_API_CALL*)();

static const OrtApiBase *g_api_base = nullptr;

// ── Platform abstraction ──────────────────────────────────────────────────────

#ifdef _WIN32
#  define WIN32_LEAN_AND_MEAN
#  include <windows.h>

static std::string shim_dir() {
    char buf[MAX_PATH] = {};
    HMODULE hm = nullptr;
    GetModuleHandleExA(
        GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS |
        GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
        reinterpret_cast<LPCSTR>(&shim_dir), &hm);
    GetModuleFileNameA(hm, buf, MAX_PATH);
    std::string p(buf);
    auto slash = p.rfind('\\');
    return slash == std::string::npos ? "." : p.substr(0, slash);
}

static bool try_load(const std::string &path) {
    HMODULE h = LoadLibraryA(path.c_str());
    if (!h) {
        return false;
    }
    auto fn = reinterpret_cast<GetApiBaseFn>(GetProcAddress(h, "OrtGetApiBase"));
    if (!fn) {
        FreeLibrary(h);
        return false;
    }
    g_api_base = fn();
    return g_api_base != nullptr;
}

static void ort_select() {
    const std::string dir = shim_dir();
    static constexpr const char *const kCandidates[] = {
        "onnxruntime_ep_cuda.dll",
        "onnxruntime_ep_directml.dll",  // AMD/Intel/NVIDIA via DirectX 12
        "onnxruntime_ep_cpu.dll",
    };
    for (const char *name : kCandidates) {
        if (try_load(dir + "\\" + name)) {
            return;
        }
    }
    fprintf(stderr,
            "[ort_selector] No onnxruntime_ep_*.dll found in %s — ORT calls will crash\n",
            dir.c_str());
}

// Static initializer fires before main() in the test EXE (no loader lock —
// safe to call LoadLibraryA) and before DllMain in the plugin DLL.
namespace {
    struct OrtInit {
        OrtInit() { ort_select(); }
    } g_ort_init;
}

// DllMain is required for a DLL to be loadable; the real work is done above.
BOOL WINAPI DllMain(HINSTANCE, DWORD, LPVOID) { return TRUE; }

#else
// ── POSIX (Linux / macOS) ─────────────────────────────────────────────────────
#  include <dlfcn.h>
#  include <sys/stat.h>

static std::string shim_dir() {
    Dl_info info{};
    dladdr(reinterpret_cast<void *>(shim_dir), &info);
    if (!info.dli_fname) {
        return ".";
    }
    const std::string p(info.dli_fname);
    const auto slash = p.rfind('/');
    return slash == std::string::npos ? "." : p.substr(0, slash);
}

static bool path_exists(const char *path) {
    struct stat st;
    return stat(path, &st) == 0;
}

// Pre-load CUDA/cuDNN runtime libs bundled in the plugin directory.
// onnxruntime_providers_cuda.so depends on these but pip installs them into
// site-packages/nvidia/*/lib/, which is not in the system library path.
static void preload_cuda_runtime(const std::string &dir) {
    static constexpr const char *const kLibs[] = {
        "libcurand.so.10",
        "libcublas.so.12", "libcublas.so.13",
        "libcublasLt.so.12", "libcublasLt.so.13",
        "libcudnn.so.8", "libcudnn.so.9",
        "libcufft.so.10", "libcufft.so.11", "libcufft.so.12",
        nullptr,
    };
    for (const char *const*p = kLibs; *p; ++p) {
        const std::string path = dir + "/" + *p;
        if (void *h = dlopen(path.c_str(), RTLD_NOLOAD | RTLD_LAZY)) {
            dlclose(h);
            continue;
        }
        dlopen(path.c_str(), RTLD_LAZY | RTLD_GLOBAL);
    }
}

static bool try_load(const std::string &path) {
    // RTLD_GLOBAL makes ORT's symbols available to its own provider sub-libs.
    // Do NOT use RTLD_DEEPBIND: it isolates RTTI, causing dynamic_cast failures
    // inside ORT when it registers the CPU EP fallback.
    void *h = dlopen(path.c_str(), RTLD_LAZY | RTLD_GLOBAL);
    if (!h) {
        return false;
    }
    const auto fn = reinterpret_cast<GetApiBaseFn>(dlsym(h, "OrtGetApiBase"));
    if (!fn) {
        dlclose(h);
        return false;
    }
    g_api_base = fn();
    return g_api_base != nullptr;
}

__attribute__((constructor(101)))
static void ort_selector_init() {
    const std::string dir = shim_dir();

    if (path_exists("/dev/nvidia0")) {
        preload_cuda_runtime(dir);
    }

    static constexpr const char *const kCandidates[] = {
        "libonnxruntime_ep_cuda.so",
        "libonnxruntime_ep_migraphx.so",  // AMD GPU — higher priority than ROCm
        "libonnxruntime_ep_rocm.so",
        "libonnxruntime_ep_openvino.so",
        "libonnxruntime_ep_cpu.so",
    };

    for (const char *name : kCandidates) {
        if (try_load(dir + "/" + name)) {
            // Pre-load provider bridge so Provider_GetHost is in global namespace
            // when ORT internally dlopen's libonnxruntime_providers_cuda.so.
            const std::string shared = dir + "/libonnxruntime_providers_shared.so";
            if (path_exists(shared.c_str())) {
                dlopen(shared.c_str(), RTLD_LAZY | RTLD_GLOBAL);
            }
            return;
        }
    }

    fprintf(stderr,
            "[ort_selector] No libonnxruntime_ep_*.so found in %s — ORT calls will crash\n",
            dir.c_str());
}
#endif  // _WIN32

// The one ORT symbol the plugin binary references directly.
// All C++ API calls flow through the vtable this returns.
extern "C" ORT_EXPORT const OrtApiBase * ORT_API_CALL OrtGetApiBase() noexcept {
    return g_api_base;
}