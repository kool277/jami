/**
 * translate_test — interactive REPL + benchmark tool for the TranslateMessages plugin.
 *
 * Compiled with one model variant (nllb200, m2m100, or mbart50) via CMake.
 *
 * Interactive commands:
 *   :lang <iso>              — switch target language
 *   :device cpu|gpu          — switch compute device (reloads model)
 *   :bench <file> [repeats]  — single-model benchmark (cpu + gpu), JSON output
 *   :bench-all <dir> [reps]  — discover variant dirs under <dir> and compare them
 *   :quit                    — exit
 *   <text>                   — translate
 *
 * Standalone mode (non-interactive, for CI/scripting):
 *   translate_test --models dir1[,dir2,...] --corpus file [options]
 *
 * Options:
 *   --models     <dir1>[,<dir2>...]  model directories to compare
 *   --corpus     <file>              one sentence per line
 *   --target-lang <iso>             target language (default: en)
 *   --source-lang <iso>             source language hint (default: auto-detect)
 *   --repeats    <N>                 timing repeats per model (default: 3)
 *   --output     csv|json            output format (default: json)
 *   --csv-file   <path>              also write CSV to file
 *   --device     cpu|gpu             compute device (default: gpu)
 */

#include "Translator.h"

#include <algorithm>
#include <chrono>
#include <ctime>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <memory>
#include <numeric>
#include <sstream>
#include <string>
#include <vector>

namespace fs = std::filesystem;

static jami::Translator::Device
parseDevice(const std::string& s)
{
    if (s == "cpu") {
        return jami::Translator::Device::CPU;
    }
    if (s == "rocm") {
        return jami::Translator::Device::ROCm;
    }
    if (s == "openvino") {
        return jami::Translator::Device::OpenVINO;
    }
    if (s == "coreml") {
        return jami::Translator::Device::CoreML;
    }
    if (s == "auto") {
        return jami::Translator::Device::AUTO;
    }
    return jami::Translator::Device::CUDA;
}

static jami::Translator::Quant
parseQuant(const std::string& s)
{
    if (s == "fp32" || s == "FP32") {
        return jami::Translator::Quant::FP32;
    }
    if (s == "int8" || s == "INT8") {
        return jami::Translator::Quant::INT8;
    }
    if (s == "fp16" || s == "FP16") {
        return jami::Translator::Quant::FP16;
    }
    return jami::Translator::Quant::AUTO;
}

static std::string
quantStr(const jami::Translator::Quant q)
{
    switch (q) {
    case jami::Translator::Quant::FP32:
        return "fp32";
    case jami::Translator::Quant::INT8:
        return "int8";
    case jami::Translator::Quant::FP16:
        return "fp16";
    default:
        return "auto";
    }
}

// ── JSON helpers ──────────────────────────────────────────────────────────────

static std::string
jsonStr(const std::string& s)
{
    std::string out = "\"";
    for (const char c : s) {
        switch (c) {
        case '"':
            out += "\\\"";
            break;
        case '\\':
            out += "\\\\";
            break;
        case '\n':
            out += "\\n";
            break;
        case '\r':
            out += "\\r";
            break;
        case '\t':
            out += "\\t";
            break;
        default:
            out += c;
            break;
        }
    }
    return out + "\"";
}

static std::string
jsonFmt(const double v, const int prec = 6)
{
    std::ostringstream ss;
    ss << std::fixed << std::setprecision(prec) << v;
    return ss.str();
}

static std::string
utcNow()
{
    const auto now = std::chrono::system_clock::now();
    const auto t = std::chrono::system_clock::to_time_t(now);
    const auto us = std::chrono::duration_cast<std::chrono::microseconds>(now.time_since_epoch())
                        .count()
                    % 1'000'000;
    std::tm tm {};
#ifdef _WIN32
    gmtime_s(&tm, &t);
#else
    gmtime_r(&t, &tm);
#endif
    std::ostringstream ss;
    ss << std::put_time(&tm, "%Y-%m-%dT%H:%M:%S") << '.' << std::setw(6) << std::setfill('0') << us
       << "+00:00";
    return ss.str();
}

// ── Benchmark structures ───────────────────────────────────────────────────────

struct RunResult
{
    std::string device;
    std::string status;
    double loadSeconds {0};
    double warmupSeconds {0};
    std::vector<double> runSeconds;
    double sentPerSec {0};
    double inTokPerSec {0};
    double outTokPerSec {0};
    std::vector<std::string> samples;
    int beamSize {0};
    int maxDecSteps {0};
};

/// Per-model benchmark result, used for multi-model comparisons.
struct ModelBenchmarkResult
{
    std::string modelId;  ///< Directory name or user-provided id
    std::string modelDir; ///< Absolute path to model directory
    RunResult cpu;        ///< CPU run (may have status=="skipped")
    RunResult gpu;        ///< GPU run (may have status=="skipped")
};

/// Aggregated comparison across multiple models.
struct ComparisonReport
{
    std::vector<ModelBenchmarkResult> models;
    std::string fastestModel; ///< id of fastest model (sentences/sec)
    double fastestSentPerSec {0};
    std::string bestThroughputModel; ///< id of best tokens/sec model
    double bestOutTokPerSec {0};
};

// ── Core benchmark function ───────────────────────────────────────────────────

static RunResult
benchDevice(const std::string& modelsDir,
            const std::string& targetLang,
            jami::Translator::Device device,
            const std::string& deviceStr,
            jami::Translator::Quant quant,
            const std::vector<std::string>& sentences,
            const int repeats)
{
    RunResult r;
    r.device = deviceStr + "+" + quantStr(quant);

    auto t0 = std::chrono::steady_clock::now();
    const auto tr = std::make_unique<jami::Translator>(modelsDir, targetLang, device, quant);
    tr->waitReady();
    r.loadSeconds = std::chrono::duration<double>(std::chrono::steady_clock::now() - t0).count();

    if (!tr->isReady()) {
        r.status = "error: failed to load";
        return r;
    }
    r.status = "ok";
    r.beamSize = tr->beam();
    r.maxDecSteps = jami::Translator::maxDecodeSteps();

    std::size_t totalIn = 0;
    for (const auto& s : sentences) {
        totalIn += tr->tokenCount(s);
    }

    // Warmup pass
    t0 = std::chrono::steady_clock::now();
    for (const auto& s : sentences)
        tr->translate(s);
    r.warmupSeconds = std::chrono::duration<double>(std::chrono::steady_clock::now() - t0).count();

    // Timed runs
    std::size_t totalOut = 0;
    bool firstRep = true;
    for (int rep = 0; rep < repeats; ++rep) {
        std::size_t outTok = 0;
        t0 = std::chrono::steady_clock::now();
        for (const auto & sentence : sentences) {
            auto translated = tr->translate(sentence);
            outTok += tr->tokenCount(translated);
            if (firstRep && r.samples.size() < 3)
                r.samples.push_back(translated);
        }
        firstRep = false;
        totalOut += outTok;
        r.runSeconds.push_back(
            std::chrono::duration<double>(std::chrono::steady_clock::now() - t0).count());
    }

    const double mean = std::accumulate(r.runSeconds.begin(), r.runSeconds.end(), 0.0)
                        / static_cast<double>(r.runSeconds.size());
    const double avgOutTok = static_cast<double>(totalOut) / static_cast<double>(repeats);
    r.sentPerSec = static_cast<double>(sentences.size()) / mean;
    r.inTokPerSec = static_cast<double>(totalIn) / mean;
    r.outTokPerSec = avgOutTok / mean;
    return r;
}

// ── Multi-model helpers ───────────────────────────────────────────────────────

/// Discover model directories under baseDir that contain an encoder ONNX file.
/// Returns (id, absolute_path) pairs sorted by id.
static std::vector<std::pair<std::string, std::string>>
discoverModelDirs(const std::string& baseDir)
{
    std::vector<std::pair<std::string, std::string>> result;
    if (baseDir.empty())
        return result;

    auto tryAdd = [&](const fs::path& p) {
        if (fs::exists(p / "encoder_model.onnx") || fs::exists(p / "encoder_model_int8.onnx")
            || fs::exists(p / "encoder_model_fp16.onnx")) {
            result.emplace_back(p.filename().string(), p.string());
        }
    };

    const fs::path base(baseDir);
    tryAdd(base);
    if (fs::is_directory(base)) {
        for (const auto& entry : fs::directory_iterator(base))
            if (entry.is_directory())
                tryAdd(entry.path());
    }
    std::sort(result.begin(), result.end(), [](const auto& a, const auto& b) {
        return a.first < b.first;
    });
    return result;
}

/// Run cpu + gpu benchmarks for one model directory.
static ModelBenchmarkResult
benchModel(const std::string& modelId,
           const std::string& modelDir,
           const std::string& targetLang,
           jami::Translator::Quant quant,
           const std::vector<std::string>& sentences,
           int repeats,
           bool skipGpu = false)
{
    ModelBenchmarkResult mbr;
    mbr.modelId = modelId;
    mbr.modelDir = modelDir;

    std::cerr << "  [" << modelId << "] cpu...\n";
    mbr.cpu = benchDevice(modelDir,
                          targetLang,
                          jami::Translator::Device::CPU,
                          "cpu",
                          quant,
                          sentences,
                          repeats);
    std::cerr << "  [" << modelId << "] cpu done — " << mbr.cpu.status << "\n";

    if (!skipGpu) {
        std::cerr << "  [" << modelId << "] gpu...\n";
        mbr.gpu = benchDevice(modelDir,
                              targetLang,
                              jami::Translator::Device::CUDA,
                              "gpu",
                              quant,
                              sentences,
                              repeats);
        std::cerr << "  [" << modelId << "] gpu done — " << mbr.gpu.status << "\n";
    } else {
        mbr.gpu.device = "gpu+" + quantStr(quant);
        mbr.gpu.status = "skipped";
    }
    return mbr;
}

/// Build a ComparisonReport from a list of ModelBenchmarkResults.
static ComparisonReport
compareModels(const std::vector<ModelBenchmarkResult>& models)
{
    ComparisonReport rep;
    rep.models = models;
    for (const auto& m : models) {
        const RunResult& best = (m.gpu.status == "ok") ? m.gpu : m.cpu;
        if (best.status != "ok")
            continue;
        if (best.sentPerSec > rep.fastestSentPerSec) {
            rep.fastestSentPerSec = best.sentPerSec;
            rep.fastestModel = m.modelId;
        }
        if (best.outTokPerSec > rep.bestOutTokPerSec) {
            rep.bestOutTokPerSec = best.outTokPerSec;
            rep.bestThroughputModel = m.modelId;
        }
    }
    return rep;
}

// ── JSON output ───────────────────────────────────────────────────────────────

static void
printRunResultJson(std::ostream& o, const RunResult& r, int indent)
{
    const std::string pad(indent, ' ');
    o << pad << "{\n";
    o << pad << "  \"device\": " << jsonStr(r.device) << ",\n";
    o << pad << "  \"status\": " << jsonStr(r.status) << ",\n";
    o << pad << "  \"load_seconds\": " << jsonFmt(r.loadSeconds) << ",\n";
    o << pad << "  \"warmup_seconds\": " << jsonFmt(r.warmupSeconds) << ",\n";

    if (!r.runSeconds.empty()) {
        auto sorted = r.runSeconds;
        std::sort(sorted.begin(), sorted.end());
        const double sum = std::accumulate(r.runSeconds.begin(), r.runSeconds.end(), 0.0);
        const double mean = sum / static_cast<double>(r.runSeconds.size());
        const std::size_t m = r.runSeconds.size();
        const double median = (m % 2 == 0) ? (sorted[m / 2 - 1] + sorted[m / 2]) / 2.0
                                           : sorted[m / 2];

        o << pad << "  \"run_seconds\": {\n";
        o << pad << "    \"count\": " << m << ",\n";
        o << pad << "    \"mean\": " << jsonFmt(mean) << ",\n";
        o << pad << "    \"median\": " << jsonFmt(median) << ",\n";
        o << pad << "    \"min\": " << jsonFmt(sorted.front()) << ",\n";
        o << pad << "    \"max\": " << jsonFmt(sorted.back()) << ",\n";
        o << pad << "    \"values\": [";
        for (std::size_t i = 0; i < r.runSeconds.size(); ++i) {
            if (i)
                o << ", ";
            o << jsonFmt(r.runSeconds[i]);
        }
        o << "]\n";
        o << pad << "  },\n";
    } else {
        o << pad << "  \"run_seconds\": null,\n";
    }

    o << pad << "  \"throughput\": {\n";
    o << pad << "    \"sentences_per_second\": " << jsonFmt(r.sentPerSec) << ",\n";
    o << pad << "    \"input_tokens_per_second\": " << jsonFmt(r.inTokPerSec) << ",\n";
    o << pad << "    \"output_tokens_per_second\": " << jsonFmt(r.outTokPerSec) << "\n";
    o << pad << "  },\n";
    o << pad << "  \"beam_size\": " << r.beamSize << ",\n";
    o << pad << "  \"kv_cache\": " << (r.beamSize == 1 ? "true" : "false") << ",\n";
    o << pad << "  \"sample_translations\": [";
    for (std::size_t i = 0; i < r.samples.size(); ++i) {
        if (i)
            o << ", ";
        o << jsonStr(r.samples[i]);
    }
    o << "]\n";
    o << pad << "}";
}

/// Print comparison JSON for multiple model directories.
static void
printComparisonJson(const ComparisonReport& rep,
                    const std::string& targetLang,
                    const std::string& corpusFile,
                    const std::vector<std::string>& sentences,
                    int repeats)
{
    auto& o = std::cout;
    o << "{\n";
    o << "  \"timestamp_utc\": " << jsonStr(utcNow()) << ",\n";
    o << "  \"framework\": \"onnxruntime\",\n";
    o << "  \"compiled_model\": " << jsonStr(jami::Translator::modelName()) << ",\n";
    o << "  \"tgt_lang\": " << jsonStr(targetLang) << ",\n";
    o << "  \"inputs\": {\n";
    o << "    \"corpus_file\": " << jsonStr(corpusFile) << ",\n";
    o << "    \"sentence_count\": " << sentences.size() << ",\n";
    o << "    \"repeats\": " << repeats << "\n";
    o << "  },\n";
    o << "  \"summary\": {\n";
    o << "    \"fastest_model\": " << jsonStr(rep.fastestModel) << ",\n";
    o << "    \"fastest_sentences_per_sec\": " << jsonFmt(rep.fastestSentPerSec) << ",\n";
    o << "    \"best_throughput_model\": " << jsonStr(rep.bestThroughputModel) << ",\n";
    o << "    \"best_output_tokens_per_sec\": " << jsonFmt(rep.bestOutTokPerSec) << "\n";
    o << "  },\n";
    o << "  \"models\": [\n";
    for (std::size_t mi = 0; mi < rep.models.size(); ++mi) {
        if (mi)
            o << ",\n";
        const auto& m = rep.models[mi];
        o << "    {\n";
        o << "      \"id\": " << jsonStr(m.modelId) << ",\n";
        o << "      \"dir\": " << jsonStr(m.modelDir) << ",\n";
        o << "      \"cpu\": ";
        printRunResultJson(o, m.cpu, 6);
        o << ",\n";
        o << "      \"gpu\": ";
        printRunResultJson(o, m.gpu, 6);
        o << "\n    }";
    }
    o << "\n  ]\n}\n";
}

/// Legacy single-model JSON (for :bench command, unchanged interface).
static void
printBenchJson(const std::string& modelsDir,
               const std::string& tgtToken,
               const std::string& filePath,
               const std::vector<std::string>& sentences,
               int repeats,
               const std::vector<RunResult>& runs)
{
    auto& o = std::cout;
    o << "{\n";
    o << "  \"timestamp_utc\": " << jsonStr(utcNow()) << ",\n";
    o << "  \"framework\": \"onnxruntime\",\n";
    o << "  \"compiled_model\": " << jsonStr(jami::Translator::modelName()) << ",\n";
    o << "  \"model_dir\": " << jsonStr(modelsDir) << ",\n";
    o << "  \"src_lang\": \"auto\",\n";
    o << "  \"tgt_lang\": " << jsonStr(tgtToken) << ",\n";
    o << "  \"inputs\": {\n";
    o << "    \"file\": " << jsonStr(filePath) << ",\n";
    o << "    \"count\": " << sentences.size() << "\n";
    o << "  },\n";
    o << "  \"config\": {\n";
    o << "    \"repeats\": " << repeats << ",\n";
    o << "    \"warmup_passes\": 1\n";
    o << "  },\n";
    o << "  \"runs\": [\n";
    for (std::size_t ri = 0; ri < runs.size(); ++ri) {
        if (ri)
            o << ",\n";
        o << "  ";
        printRunResultJson(o, runs[ri], 4);
    }
    o << "\n  ]\n}\n";
}

// ── CSV output ────────────────────────────────────────────────────────────────

/// Write a CSV comparison table; one row per (model, device) combination.
static void
printComparisonCsv(std::ostream& out, const ComparisonReport& rep)
{
    out << "model_id,device,load_seconds,warmup_seconds,"
           "mean_run_seconds,median_run_seconds,"
           "sentences_per_sec,input_tokens_per_sec,output_tokens_per_sec,"
           "beam_size,kv_cache,status\n";

    auto writeRow = [&](const std::string& id, const RunResult& r) {
        double mean = 0, median = 0;
        if (!r.runSeconds.empty()) {
            auto sorted = r.runSeconds;
            std::sort(sorted.begin(), sorted.end());
            mean = std::accumulate(r.runSeconds.begin(), r.runSeconds.end(), 0.0)
                   / static_cast<double>(r.runSeconds.size());
            const std::size_t m = sorted.size();
            median = (m % 2 == 0) ? (sorted[m / 2 - 1] + sorted[m / 2]) / 2.0 : sorted[m / 2];
        }
        out << id << "," << r.device << "," << jsonFmt(r.loadSeconds) << ","
            << jsonFmt(r.warmupSeconds) << "," << jsonFmt(mean) << "," << jsonFmt(median) << ","
            << jsonFmt(r.sentPerSec) << "," << jsonFmt(r.inTokPerSec) << ","
            << jsonFmt(r.outTokPerSec) << "," << r.beamSize << ","
            << (r.beamSize == 1 ? "true" : "false") << "," << r.status << "\n";
    };

    for (const auto& m : rep.models) {
        writeRow(m.modelId, m.cpu);
        writeRow(m.modelId, m.gpu);
    }
}

// ── Argument parsing ──────────────────────────────────────────────────────────

struct CliArgs
{
    std::vector<std::string> models; // directories to benchmark
    std::string corpusFile;
    std::string targetLang = "en";
    std::string sourceLang; // empty = auto-detect
    int repeats = 3;
    std::string outputFmt = "json";
    std::string csvFile;
    std::string device = "gpu";
    std::string quant = "auto"; // fp32 | int8 | fp16 | auto
    bool standalone = false;    // non-interactive (standalone) mode
};

static CliArgs
parseArgs(int argc, char* argv[])
{
    CliArgs a;
    for (int i = 1; i < argc; ++i) {
        const std::string arg = argv[i];
        auto nextVal = [&]() -> std::string {
            return (i + 1 < argc) ? std::string(argv[++i]) : std::string();
        };
        if (arg == "--models") {
            a.standalone = true;
            std::istringstream ss(nextVal());
            for (std::string tok; std::getline(ss, tok, ',');)
                if (!tok.empty())
                    a.models.push_back(tok);
        } else if (arg == "--corpus") {
            a.standalone = true;
            a.corpusFile = nextVal();
        } else if (arg == "--target-lang") {
            a.targetLang = nextVal();
        } else if (arg == "--source-lang") {
            a.sourceLang = nextVal();
        } else if (arg == "--repeats") {
            a.repeats = std::max(1, std::stoi(nextVal()));
        } else if (arg == "--output") {
            a.outputFmt = nextVal();
        } else if (arg == "--csv-file") {
            a.csvFile = nextVal();
        } else if (arg == "--device") {
            a.device = nextVal();
        } else if (arg == "--quant") {
            a.quant = nextVal();
        } else if (!arg.empty() && arg[0] != '-' && a.models.empty()) {
            // First positional: models dir (legacy mode)
            a.models.push_back(arg);
        }
    }
    return a;
}

// ── Main ──────────────────────────────────────────────────────────────────────

int
main(const int argc, char* argv[])
{
    if (argc < 2) {
        std::cerr << "Usage: " << argv[0]
                  << " <models_dir> [target_lang] [cpu|gpu] [auto|fp32|int8|fp16]\n";
        std::cerr << "       " << argv[0]
                  << " --models <dir1>[,<dir2>...] --corpus <file> [--target-lang fr] [--quant "
                     "fp32] ...\n";
        std::cerr << "\n  Compiled model: " << jami::Translator::modelName() << "\n";
        return 1;
    }

    const CliArgs cliArgs = parseArgs(argc, argv);

    // ── Standalone benchmark mode ──────────────────────────────────────────────
    if (cliArgs.standalone) {
        if (cliArgs.corpusFile.empty()) {
            std::cerr << "Error: --corpus <file> required in standalone mode\n";
            return 1;
        }
        std::ifstream f(cliArgs.corpusFile);
        if (!f) {
            std::cerr << "Error: cannot open: " << cliArgs.corpusFile << "\n";
            return 1;
        }
        std::vector<std::string> sentences;
        for (std::string s; std::getline(f, s);)
            if (!s.empty())
                sentences.push_back(s);
        if (sentences.empty()) {
            std::cerr << "Error: corpus file is empty\n";
            return 1;
        }

        std::cerr << "Model: " << jami::Translator::modelName()
                  << "  sentences: " << sentences.size() << "  target: " << cliArgs.targetLang
                  << "  quant: " << cliArgs.quant << "\n";

        const auto quant = parseQuant(cliArgs.quant);
        std::vector<ModelBenchmarkResult> results;
        for (const auto& dir : cliArgs.models) {
            const std::string id = fs::path(dir).filename().string();
            std::cerr << "Benchmarking: " << id << "\n";
            results.push_back(benchModel(id,
                                         dir,
                                         cliArgs.targetLang,
                                         quant,
                                         sentences,
                                         cliArgs.repeats,
                                         /*skipGpu=*/cliArgs.device == "cpu"));
        }

        const ComparisonReport report = compareModels(results);
        if (cliArgs.outputFmt == "csv")
            printComparisonCsv(std::cout, report);
        else
            printComparisonJson(report,
                                cliArgs.targetLang,
                                cliArgs.corpusFile,
                                sentences,
                                cliArgs.repeats);

        if (!cliArgs.csvFile.empty()) {
            std::ofstream csvOut(cliArgs.csvFile);
            if (csvOut)
                printComparisonCsv(csvOut, report);
            else
                std::cerr << "Warning: cannot write CSV to " << cliArgs.csvFile << "\n";
        }
        return 0;
    }

    // ── Interactive mode ───────────────────────────────────────────────────────
    const std::string modelsDir = cliArgs.models.empty() ? argv[1] : cliArgs.models[0];
    std::string targetLang = (argc > 2 && argv[2][0] != '-') ? argv[2] : "en";
    std::string deviceStr = (argc > 3 && argv[3][0] != '-') ? argv[3] : "gpu";
    std::string quantOpt = (argc > 4 && argv[4][0] != '-') ? argv[4] : cliArgs.quant;

    auto makeTranslator = [&]() {
        std::cout << "Loading models from: " << modelsDir << " [" << jami::Translator::modelName()
                  << "] (device: " << deviceStr << ", quant: " << quantOpt << ") ...\n";
        const auto t0 = std::chrono::steady_clock::now();
        auto t = std::make_unique<jami::Translator>(modelsDir,
                                                    targetLang,
                                                    parseDevice(deviceStr),
                                                    parseQuant(quantOpt));
        t->waitReady();
        const auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
                            std::chrono::steady_clock::now() - t0)
                            .count();
        std::cout << "Model loaded in " << ms << " ms\n";
        return t;
    };

    auto translator = makeTranslator();
    if (!translator->isReady()) {
        std::cerr << "Error: translator failed to load — check models_dir and that "
                     "encoder_model.onnx (or quantized variants), sentencepiece.bpe.model, "
                     "and lid.176.ftz are present.\n"
                     "Run data/models/download_model.py to export models.\n";
        return 1;
    }

    std::cout << "Translator ready [" << jami::Translator::modelName() << "]. "
              << "Target: " << targetLang << "  Device: " << deviceStr << "  Quant: " << quantOpt
              << "\n";
    std::cout << "Commands:\n"
              << "  :lang <code>              — switch target language\n"
              << "  :device cpu|gpu           — switch device (reloads model)\n"
              << "  :quant auto|fp32|int8|fp16 — switch quantization (reloads model)\n"
              << "  :bench <file> [repeats]   — benchmark file, both devices, JSON output\n"
              << "  :bench-all <dir> [reps]   — discover and compare variant dirs under <dir>\n"
              << "  :quit                     — exit\n"
              << "  <text>                    — translate\n\n";

    std::string line;
    while (std::cout << "> " && std::getline(std::cin, line)) {
        if (line == ":quit" || line == ":exit")
            break;

        if (line.rfind(":lang ", 0) == 0) {
            std::string newLang = line.substr(6);
            if (newLang.empty()) {
                std::cout << "Usage: :lang <code>\n";
                continue;
            }
            targetLang = newLang;
            translator->setTargetLanguage(targetLang);
            std::cout << "Target language: " << targetLang << " (" << translator->targetToken()
                      << ")\n";
            continue;
        }

        if (line.rfind(":device ", 0) == 0) {
            std::string nd = line.substr(8);
            if (nd != "cpu" && nd != "gpu") {
                std::cout << "Usage: :device cpu|gpu\n";
                continue;
            }
            deviceStr = nd;
            translator = makeTranslator();
            if (!translator->isReady())
                std::cerr << "Error: failed to reload on " << deviceStr << "\n";
            else
                std::cout << "Switched to " << deviceStr << ". Target: " << targetLang << "\n";
            continue;
        }

        if (line.rfind(":quant ", 0) == 0) {
            std::string nq = line.substr(7);
            if (nq != "auto" && nq != "fp32" && nq != "int8" && nq != "fp16") {
                std::cout << "Usage: :quant auto|fp32|int8|fp16\n";
                continue;
            }
            quantOpt = nq;
            translator = makeTranslator();
            if (!translator->isReady())
                std::cerr << "Error: failed to reload with quant=" << quantOpt << "\n";
            else
                std::cout << "Switched to quant=" << quantOpt
                          << " (effective: " << quantStr(translator->quant()) << ")\n";
            continue;
        }

        if (line.rfind(":bench ", 0) == 0) {
            std::istringstream args(line.substr(7));
            std::string filePath;
            int repeats = 3;
            args >> filePath;
            if (int r; args >> r)
                repeats = std::max(1, r);
            if (filePath.empty()) {
                std::cout << "Usage: :bench <file> [repeats]\n";
                continue;
            }

            std::ifstream f(filePath);
            if (!f) {
                std::cerr << "Error: cannot open " << filePath << "\n";
                continue;
            }
            std::vector<std::string> sentences;
            for (std::string s; std::getline(f, s);)
                if (!s.empty())
                    sentences.push_back(s);
            if (sentences.empty()) {
                std::cerr << "Error: file is empty\n";
                continue;
            }

            std::cerr << "Benchmarking " << sentences.size() << " sentences, " << repeats
                      << " repeat(s)...\n";
            std::vector<RunResult> runs;
            for (const auto& [dev, devStr] :
                 std::vector<std::pair<jami::Translator::Device, std::string>> {
                     {jami::Translator::Device::CPU, "cpu"},
                     {jami::Translator::Device::CUDA, "cuda"},
                     {jami::Translator::Device::ROCm, "rocm"},
                     {jami::Translator::Device::OpenVINO, "openvino"}}) {
                std::cerr << "  [" << devStr << "] running...\n";
                runs.push_back(benchDevice(
                    modelsDir, targetLang, dev, devStr, parseQuant(quantOpt), sentences, repeats));
                std::cerr << "  [" << devStr << "] done — " << runs.back().status << "\n";
            }
            printBenchJson(modelsDir, translator->targetToken(), filePath, sentences, repeats, runs);
            continue;
        }

        if (line.rfind(":bench-all ", 0) == 0) {
            std::istringstream args(line.substr(11));
            std::string baseDir;
            int repeats = 3;
            args >> baseDir;
            if (int r; args >> r)
                repeats = std::max(1, r);
            if (baseDir.empty()) {
                std::cout << "Usage: :bench-all <dir> [repeats]\n";
                continue;
            }

            const auto modelDirs = discoverModelDirs(baseDir);
            if (modelDirs.empty()) {
                std::cerr << "No model directories with encoder_model.onnx found under: " << baseDir
                          << "\n";
                continue;
            }
            std::cerr << "Found " << modelDirs.size() << " variant(s) under " << baseDir << ":\n";
            for (const auto& [id, path] : modelDirs)
                std::cerr << "  " << id << " -> " << path << "\n";

            std::cout << "Corpus file (one sentence per line): ";
            std::string corpusPath;
            if (!std::getline(std::cin, corpusPath) || corpusPath.empty()) {
                std::cerr << "Aborted.\n";
                continue;
            }
            std::ifstream cf(corpusPath);
            if (!cf) {
                std::cerr << "Error: cannot open " << corpusPath << "\n";
                continue;
            }
            std::vector<std::string> sentences;
            for (std::string s; std::getline(cf, s);)
                if (!s.empty())
                    sentences.push_back(s);
            if (sentences.empty()) {
                std::cerr << "Error: corpus file is empty\n";
                continue;
            }

            std::vector<ModelBenchmarkResult> results;
            for (const auto& [id, path] : modelDirs)
                results.push_back(
                    benchModel(id, path, targetLang, parseQuant(quantOpt), sentences, repeats));

            const ComparisonReport report = compareModels(results);
            printComparisonJson(report, targetLang, corpusPath, sentences, repeats);
            continue;
        }

        if (line.empty())
            continue;

        const auto t0 = std::chrono::steady_clock::now();
        std::string result = translator->translate(line);
        const auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
                            std::chrono::steady_clock::now() - t0)
                            .count();
        std::cout << result << "  [" << ms << " ms]\n";
    }

    return 0;
}
