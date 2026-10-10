#!/usr/bin/env python3
"""
Export translation models to ONNX format for ONNX Runtime inference.

Supported models (select with --model-type):
  nllb200   — facebook/nllb-200-distilled-600M           (default, BART-based)
  m2m100    — facebook/m2m100_418M                        (BART-based, similar to NLLB)
  mbart50   — facebook/mbart-large-50-many-to-many-mmt    (BART-based, 50 languages)

Produces in the output directory (data/models/<model-type>/ by default):
  encoder_model.onnx              — encoder
  decoder_model.onnx              — decoder, no KV cache (beam search fallback)
  decoder_init_kv_model.onnx      — decoder, first step, outputs KV cache
  decoder_with_past_model.onnx    — decoder, subsequent steps, uses KV cache
  sentencepiece.bpe.model         — tokenizer
  shared_vocabulary.json          — token → ID array  (nllb200 and m2m100 only)
  lid.176.ftz                     — fastText language detection model

Architecture overview
---------------------
Translation inference is split into four ONNX graphs to maximise throughput:

  1. encoder_model          — runs once per source sentence; produces encoder
                              hidden states used by all decoder steps.

  2. decoder_model          — full-sequence decoder with no KV caching; used
                              as a beam-search fallback or for short sequences
                              where caching overhead is not worthwhile.

  3. decoder_init_kv_model  — first decoder step; takes the initial decoder
                              input (e.g. [EOS, lang_id] for BART) and returns
                              logits plus the initial KV cache tensors.

  4. decoder_with_past_model — subsequent decoder steps; takes one new token,
                               encoder outputs, and the previous KV cache, and
                               returns new logits plus the updated KV cache.
                               Runs in O(1) per step instead of O(n²).

KV cache layout
---------------
All supported models store 4 tensors per decoder layer:
  (self_key, self_val, cross_key, cross_val)
These are flattened to a single list and named past.{layer}.{type} /
present.{layer}.{type} in the ONNX graph for straightforward feed-through
in the C++ runtime.

Usage:
   python3 download_model.py                           # nllb200, all models
   python3 download_model.py --model-type m2m100       # M2M-100 418M
   python3 download_model.py --model-type mbart50      # MBart-50 many-to-many
   python3 download_model.py --quantize                # + INT8 variants (CPU)
   python3 download_model.py --quantize-only           # re-quantize INT8 only
   python3 download_model.py --model facebook/nllb-200-distilled-1.3B
"""

import argparse
import json
import logging
import pathlib
import shutil
import sys
import urllib.request
import warnings

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

import onnx
import torch
from transformers import AutoModelForSeq2SeqLM
from transformers.cache_utils import DynamicCache

# EncoderDecoderCache was added in transformers ~4.39 to separate self-attn and cross-attn KVs.
# Older builds only have DynamicCache; fall back gracefully.
try:
    from transformers.cache_utils import EncoderDecoderCache as _EncoderDecoderCache
except ImportError:
    _EncoderDecoderCache = None


def _cache_layer_kv(cache, layer_idx: int):
    """Return (key, value) tensors for layer_idx from a cache object.

    Handles three DynamicCache API variants across transformers versions:
      - ≥ 4.36: .key_cache[i] / .value_cache[i]
      - intermediate: .layers[i].keys / .layers[i].values
      - < 4.36: cache[i] → (k, v)
    """
    # Current DynamicCache (≥ 4.36): .key_cache / .value_cache lists
    if hasattr(cache, "key_cache") and hasattr(cache, "value_cache"):
        return cache.key_cache[layer_idx], cache.value_cache[layer_idx]

    # Intermediate DynamicCache: .layers[i] with .keys / .values attributes
    layers = getattr(cache, "layers", None)
    if layers is not None and layer_idx < len(layers):
        layer = layers[layer_idx]
        return getattr(layer, "keys", None), getattr(layer, "values", None)

    # Very old (< 4.36): cache[i] -> (k, v)
    try:
        kv = cache[layer_idx]
        if isinstance(kv, tuple) and len(kv) == 2:
            return kv
    except (IndexError, TypeError):
        pass

    raise AttributeError(f"Cannot extract layer {layer_idx} KV from cache type {type(cache)}")


def _build_enc_dec_cache(flat_pkv: tuple, num_layers: int):
    """Reconstruct a transformers cache object from flat (sk, sv, ck, cv) × n tensors.

    Produces EncoderDecoderCache (transformers ≥ 4.39) or a legacy tuple for older builds.
    """
    if _EncoderDecoderCache is not None:
        if hasattr(_EncoderDecoderCache, "from_legacy_cache"):
            return _EncoderDecoderCache.from_legacy_cache(tuple(
                (flat_pkv[i * 4], flat_pkv[i * 4 + 1], flat_pkv[i * 4 + 2], flat_pkv[i * 4 + 3])
                for i in range(num_layers)
            ))

        # Manual construction: use update() per layer to populate the caches
        # in a version-agnostic way.
        self_cache = DynamicCache()
        cross_cache = DynamicCache()
        for i in range(num_layers):
            self_cache.update(flat_pkv[i * 4], flat_pkv[i * 4 + 1], i)
            cross_cache.update(flat_pkv[i * 4 + 2], flat_pkv[i * 4 + 3], i)
        return _EncoderDecoderCache(self_cache, cross_cache)

    # Older transformers: only DynamicCache exists; use legacy tuple format
    # since old BART decoders expected ((sk, sv, ck, cv), ...) per-layer tuples.
    return tuple(
        (flat_pkv[i * 4], flat_pkv[i * 4 + 1], flat_pkv[i * 4 + 2], flat_pkv[i * 4 + 3])
        for i in range(num_layers)
    )


def _flatten_cache(cache, num_layers: int):
    """Flatten a transformers cache to [sk_0, sv_0, ck_0, cv_0, ...]. Inverse of _build_enc_dec_cache.

    Handles tuple (legacy), DynamicCache, and EncoderDecoderCache variants.
    """
    # Plain legacy tuple format.
    if isinstance(cache, tuple):
        return [t for layer in cache for t in layer]

    # to_legacy_cache() exists on newer DynamicCache and some EncoderDecoderCache builds.
    if hasattr(cache, "to_legacy_cache"):
        try:
            return [t for layer in cache.to_legacy_cache() for t in layer]
        except (AttributeError, NotImplementedError):
            pass

    # EncoderDecoderCache: extract self-attn and cross-attn caches separately.
    if _EncoderDecoderCache is not None and isinstance(cache, _EncoderDecoderCache):
        self_c = cache.self_attention_cache
        cross_c = cache.cross_attention_cache
        flat = []
        for i in range(num_layers):
            sk, sv = _cache_layer_kv(self_c, i)
            ck, cv = _cache_layer_kv(cross_c, i)
            flat.extend([sk, sv, ck, cv])
        return flat

    # Plain DynamicCache: only self-attn KVs available.
    if isinstance(cache, DynamicCache):
        flat = []
        for i in range(num_layers):
            k, v = _cache_layer_kv(cache, i)
            flat.extend([k, v])
        return flat

    raise TypeError(f"Unknown cache type: {type(cache)}")


# ── Model type registry ────────────────────────────────────────────────────────

# Each entry maps a short --model-type name to the default HuggingFace model ID
# and the decoder architecture family.  The architecture determines which set of
# ONNX wrapper classes and export helpers to use.
MODEL_REGISTRY = {
    "nllb200": {
        "default_hf_id": "facebook/nllb-200-distilled-600M",
        "arch": "bart",  # BART-derived encoder-decoder
    },
    "m2m100": {
        "default_hf_id": "facebook/m2m100_418M",
        "arch": "bart",
    },
    "mbart50": {
        "default_hf_id": "facebook/mbart-large-50-many-to-many-mmt",
        "arch": "mbart50",  # BART-based, 50-language multilingual MT
    },
}

OUTPUT_DIR = pathlib.Path(__file__).parent
LID_URL = "https://dl.fbaipublicfiles.com/fasttext/supervised-models/lid.176.ftz"

# KV tensor types per decoder layer (matches HF past_key_values order).
KV_TYPES = ("self.key", "self.val", "cross.key", "cross.val")


def kv_names(prefix: str, num_layers: int) -> list[str]:
    """Return ordered KV tensor names: {prefix}.{layer}.{self/cross}.{key/val}.

    kv_names("past", 2) → ["past.0.self.key", "past.0.self.val", "past.0.cross.key", ...]
    Names are shared between past_* inputs and present_* outputs so the C++ runtime
    can feed outputs directly back as inputs for the next decode step.
    """
    return [f"{prefix}.{i}.{t}" for i in range(num_layers) for t in KV_TYPES]


# ── BART-family ONNX wrappers (NLLB-200 and M2M-100) ─────────────────────────

class EncoderONNX(torch.nn.Module):
    """ONNX-export wrapper for BART encoder (model.model.encoder).
    forward(input_ids, attention_mask) -> last_hidden_state
    """

    def __init__(self, model):
        super().__init__()
        self.encoder = model.model.encoder

    def forward(self, input_ids: torch.Tensor, attention_mask: torch.Tensor):
        return self.encoder(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state


class DecoderONNX(torch.nn.Module):
    """BART no-cache decoder — beam-search fallback. Returns last-position logits only.
    forward(input_ids, encoder_hidden_states, encoder_attention_mask) -> logits
    """

    def __init__(self, model):
        super().__init__()
        self.decoder = model.model.decoder
        self.lm_head = model.lm_head

    def forward(self, input_ids, encoder_hidden_states, encoder_attention_mask):
        out = self.decoder(
            input_ids=input_ids,
            encoder_hidden_states=encoder_hidden_states,
            encoder_attention_mask=encoder_attention_mask,
        )
        return self.lm_head(out.last_hidden_state[:, -1:, :])


class DecoderInitKvONNX(torch.nn.Module):
    """BART decoder first step — initialises KV cache from [EOS, tgt_lang_id] prompt.
    forward(...) -> (logits, sk_0, sv_0, ck_0, cv_0, ..., sk_n, sv_n, ck_n, cv_n)
    """

    def __init__(self, model):
        super().__init__()
        self.decoder = model.model.decoder
        self.lm_head = model.lm_head
        self.num_layers = len(model.model.decoder.layers)

    def forward(self, input_ids, encoder_hidden_states, encoder_attention_mask):
        out = self.decoder(
            input_ids=input_ids,
            encoder_hidden_states=encoder_hidden_states,
            encoder_attention_mask=encoder_attention_mask,
            past_key_values=None,
            use_cache=True,
        )
        logits = self.lm_head(out.last_hidden_state[:, -1:, :])
        flat_kv = _flatten_cache(out.past_key_values, self.num_layers)
        return (logits, *flat_kv)


class DecoderWithPastONNX(torch.nn.Module):
    """BART-family cached decoder step: 1 token + past KV → logits + updated KV.

    4D attention masks are pre-computed from flat_pkv[0] shape to avoid TorchScript
    tracing failures in transformers ≥ 5.5 where create_causal_mask returns 0-d tensors.
    """

    def __init__(self, model):
        super().__init__()
        self.decoder = model.model.decoder
        self.lm_head = model.lm_head
        self.num_layers = len(model.model.decoder.layers)

    def forward(self, input_ids, encoder_hidden_states, encoder_attention_mask, *flat_pkv):
        cache = _build_enc_dec_cache(flat_pkv, self.num_layers)

        # Pre-compute 4D attention masks to avoid TorchScript tracing issues in
        # transformers >=5.5 (create_causal_mask returns 0-d tensors during tracing).
        past_self_key = flat_pkv[0]
        zeros_past = past_self_key[:, :1, :, :1].transpose(2, 3) * 0.0
        zeros_cur = zeros_past[:, :, :, :1]
        attention_mask_4d = torch.cat([zeros_past, zeros_cur], dim=-1)

        enc_mask_4d = ((1.0 - encoder_attention_mask.float()) * -1e4).unsqueeze(1).unsqueeze(2)

        out = self.decoder(
            input_ids=input_ids,
            attention_mask=attention_mask_4d,
            encoder_hidden_states=encoder_hidden_states,
            encoder_attention_mask=enc_mask_4d,
            past_key_values=cache,
            use_cache=True,
        )
        logits = self.lm_head(out.last_hidden_state[:, -1:, :])
        flat_kv = _flatten_cache(out.past_key_values, self.num_layers)
        return (logits, *flat_kv)


# ── Shared export helpers ─────────────────────────────────────────────────────

def _cap_ir_version(path: pathlib.Path, max_ir: int = 9) -> None:
    """Cap the ONNX IR version to max_ir (default 9) for ORT < 1.16 compatibility.

    Also strips unused opset-import domains that ORT's optimizer/quantizer leave behind;
    spurious domain declarations at unsupported versions cause ORT to reject the model.
    Two-pass: struct-only load first to skip the expensive full reload when nothing changed.
    """
    # First pass: load only the graph structure (no tensor data) to check what needs changing.
    # This avoids pulling multi-GB weight tensors into RAM for a read-only check.
    m_struct = onnx.load(str(path), load_external_data=False)

    need_ir = m_struct.ir_version > max_ir
    declared_domains = {op.domain for op in m_struct.opset_import}
    used_domains = {node.domain for node in m_struct.graph.node}  # '' == ai.onnx
    # Always retain the main ONNX domain whether or not nodes reference it explicitly.
    spurious = declared_domains - used_domains - {"", "ai.onnx"}
    need_opset_add = ("" not in declared_domains and "ai.onnx" not in declared_domains)
    need_opset_strip = bool(spurious)

    if not need_ir and not need_opset_add and not need_opset_strip:
        return  # Nothing to change — skip the expensive full load + re-save.

    # Second pass: load with tensor data so we can re-save a complete model.
    m = onnx.load(str(path))
    if need_ir:
        m.ir_version = max_ir
        print(f"  (IR version capped to {max_ir})")
    if need_opset_add:
        op = m.opset_import.add()
        op.domain = ""
        op.version = max((o.version for o in m.opset_import), default=17)
    if need_opset_strip:
        kept = [op for op in m.opset_import if op.domain not in spurious]
        del m.opset_import[:]
        m.opset_import.extend(kept)
        print(f"  (removed unused opset domains: {', '.join(sorted(spurious))})")

    # Try inline save first.  Large models (> 2 GB) exceed
    # protobuf's serialization limit and must use an external-data sidecar instead.
    try:
        onnx.save(m, str(path))
    except Exception as e:
        if not any(s in str(e) for s in ("Failed to serialize proto", "2GB", "2147483648")):
            raise
        data_file = path.name + ".data"
        print(f"  (model > 2 GB — switching to external data sidecar: {data_file})")
        onnx.save_model(
            m, str(path),
            save_as_external_data=True,
            all_tensors_to_one_file=True,
            location=data_file,
            size_threshold=1024,
        )


def export_encoder(wrapper, enc_in, enc_msk, path: pathlib.Path):
    """Export encoder to ONNX with dynamic batch × src_len shapes."""
    print(f"Exporting encoder → {path.name}")
    wrapper.eval()
    batch = torch.export.Dim("batch")
    src_len = torch.export.Dim("src_len")
    torch.onnx.export(
        wrapper, (enc_in, enc_msk), str(path),
        input_names=["input_ids", "attention_mask"],
        output_names=["last_hidden_state"],
        dynamic_shapes={
            "input_ids": {0: batch, 1: src_len},
            "attention_mask": {0: batch, 1: src_len},
        },
        opset_version=18, do_constant_folding=True,
    )
    _cap_ir_version(path)


def export_decoder(wrapper, dec_in, enc_hidden, enc_msk, path: pathlib.Path):
    """Export no-cache decoder to ONNX.

    do_constant_folding=False prevents baking trace-time dec_len=3 into cross-attention
    reshape ops, which would silently break inference at other sequence lengths.
    """
    print(f"Exporting decoder (no KV) → {path.name}")
    wrapper.eval()
    batch = torch.export.Dim("batch")
    src_len = torch.export.Dim("src_len")
    dec_len = torch.export.Dim("dec_len")
    torch.onnx.export(
        wrapper, (dec_in, enc_hidden, enc_msk), str(path),
        input_names=["input_ids", "encoder_hidden_states", "encoder_attention_mask"],
        output_names=["logits"],
        dynamic_shapes={
            "input_ids": {0: batch, 1: dec_len},
            "encoder_hidden_states": {0: batch, 1: src_len},
            "encoder_attention_mask": {0: batch, 1: src_len},
        },
        opset_version=18, do_constant_folding=False,
    )
    _cap_ir_version(path)


def export_decoder_init_kv(wrapper, dec_in, enc_hidden, enc_msk, path: pathlib.Path):
    """Export first-step KV-init decoder.

    Outputs present.{layer}.* tensors that feed directly into decoder_with_past_model
    past.* inputs without renaming.
    """
    n = wrapper.num_layers
    print(f"Exporting decoder_init_kv ({n} layers) → {path.name}")
    wrapper.eval()
    batch = torch.export.Dim("batch")
    src_len = torch.export.Dim("src_len")
    dec_len = torch.export.Dim("dec_len")
    dyn: dict = {
        "input_ids": {0: batch, 1: dec_len},
        "encoder_hidden_states": {0: batch, 1: src_len},
        "encoder_attention_mask": {0: batch, 1: src_len},
    }
    torch.onnx.export(
        wrapper, (dec_in, enc_hidden, enc_msk), str(path),
        input_names=["input_ids", "encoder_hidden_states", "encoder_attention_mask"],
        output_names=["logits"] + kv_names("present", n),
        dynamic_shapes=dyn,
        opset_version=18, do_constant_folding=False,
    )
    _cap_ir_version(path)


def _kv_dynamic_axes(n: int, dyn: dict) -> None:
    for i in range(n):
        dyn[f"past.{i}.self.key"] = {0: "batch", 2: "past_len"}
        dyn[f"past.{i}.self.val"] = {0: "batch", 2: "past_len"}
        dyn[f"past.{i}.cross.key"] = {0: "batch", 2: "src_len"}
        dyn[f"past.{i}.cross.val"] = {0: "batch", 2: "src_len"}
        dyn[f"present.{i}.self.key"] = {0: "batch", 2: "new_past_len"}
        dyn[f"present.{i}.self.val"] = {0: "batch", 2: "new_past_len"}
        dyn[f"present.{i}.cross.key"] = {0: "batch", 2: "src_len"}
        dyn[f"present.{i}.cross.val"] = {0: "batch", 2: "src_len"}


def export_decoder_with_past_bart(wrapper: DecoderWithPastONNX, enc_hidden, enc_msk,
                                  path: pathlib.Path):
    """Export BART with_past decoder via legacy TorchScript exporter.

    dynamo=False required for variadic *flat_pkv inputs. Dynamic axes use string names
    (legacy API). KV shapes: self (batch, heads, past_len, head_dim),
    cross (batch, heads, src_len, head_dim) — cross is static across steps.
    """
    n = wrapper.num_layers
    print(f"Exporting decoder_with_past ({n} layers) → {path.name}")
    wrapper.eval()

    dec_layer = wrapper.decoder.layers[0]
    num_heads = dec_layer.self_attn.num_heads
    head_dim = dec_layer.self_attn.head_dim
    src_len = enc_hidden.shape[1]
    init_len = 2  # [EOS, lang_id]

    dummy_pkv = []
    for _ in range(n):
        sk = torch.zeros(1, num_heads, init_len, head_dim)
        sv = torch.zeros(1, num_heads, init_len, head_dim)
        ck = torch.zeros(1, num_heads, src_len, head_dim)
        cv = torch.zeros(1, num_heads, src_len, head_dim)
        dummy_pkv.extend([sk, sv, ck, cv])

    past = kv_names("past", n)
    present = kv_names("present", n)

    dyn: dict = {
        "input_ids": {0: "batch"},
        "encoder_hidden_states": {0: "batch", 1: "src_len"},
        "encoder_attention_mask": {0: "batch", 1: "src_len"},
        "logits": {0: "batch"},
    }
    _kv_dynamic_axes(n, dyn)

    tok_in = torch.tensor([[1]])
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", category=DeprecationWarning,
                                message=r".*legacy TorchScript.*")
        torch.onnx.export(
            wrapper, (tok_in, enc_hidden, enc_msk, *dummy_pkv), str(path),
            input_names=["input_ids", "encoder_hidden_states", "encoder_attention_mask"] + past,
            output_names=["logits"] + present,
            dynamic_axes=dyn,
            opset_version=18, do_constant_folding=False,
            dynamo=False,
        )
    _cap_ir_version(path)


def write_vocab(tokenizer, path: pathlib.Path):
    """Write shared_vocabulary.json: token array indexed by ID for O(1) C++ lookups."""
    print(f"Writing vocabulary → {path.name}")
    vocab = tokenizer.get_vocab()
    ordered = [tok for tok, _ in sorted(vocab.items(), key=lambda x: x[1])]
    with open(path, "w", encoding="utf-8") as f:
        json.dump(ordered, f, ensure_ascii=False)


def download_lid(path: pathlib.Path):
    """Download fastText LID model (lid.176.ftz, 176 languages) if not already present."""
    if path.exists():
        print(f"LID model already present: {path.name}")
        return
    print(f"Downloading fastText LID → {path.name}")
    urllib.request.urlretrieve(LID_URL, path)


# ── Post-processing: INT8 ────────────────────────────────────────────────────

def _has_transpose_weight_pattern(src: pathlib.Path) -> bool:
    """Return True if FP32 weights are predominantly routed through Transpose before MatMul.

    The legacy TorchScript exporter emits Transpose(weight)→MatMul; quantize_dynamic skips
    those weights. Only True when Transpose count > direct MatMul count (avoids false
    positives on models with a single incidental Transpose).
    """
    try:
        model = onnx.load(str(src), load_external_data=False)
        init_names = {init.name for init in model.graph.initializer if init.data_type == 1}
        tp_count = 0
        mm_count = 0
        for node in model.graph.node:
            for inp in node.input:
                if inp in init_names:
                    if node.op_type == "Transpose":
                        tp_count += 1
                    elif node.op_type in ("MatMul", "Gemm"):
                        mm_count += 1
        return tp_count > mm_count
    except Exception:
        return False


def _ort_optimize(src: pathlib.Path) -> pathlib.Path | None:
    """Run ORT graph optimization to fold Transpose(weight)→MatMul into direct weight access.

    Required before INT8 quantization of decoder_with_past (TorchScript-exported): without
    this, quantize_dynamic skips ~85% of weights (~800 MB quantized vs ~440 MB after opt).
    Returns temp file path caller must delete, or None if not needed/unavailable.
    """
    if not _has_transpose_weight_pattern(src):
        return None
    try:
        from onnxruntime.transformers.optimizer import optimize_model  # type: ignore[import]
        print(f"  Running ORT graph optimization to fold Transpose→MatMul weights...")
        tmp = src.with_name(src.stem + "_ort_opt.onnx")
        opt = optimize_model(str(src), model_type="bart", opt_level=1,
                             use_gpu=False, only_onnxruntime=True)
        opt.save_model_to_file(str(tmp))
        return tmp
    except Exception:
        return None


def quantize_int8(src: pathlib.Path, dst: pathlib.Path) -> bool:
    """Apply INT8 dynamic weight quantization (weight-only, activations stay FP32).

    Runs ORT graph optimization first to expose weights hidden behind Transpose nodes
    (decoder_with_past TorchScript pattern). Suppresses ORT's pre-processing suggestion
    (shape_inference breaks on models ≥ 2 GB). Retries with external data on protobuf
    size-limit errors.
    """
    try:
        from onnxruntime.quantization import quantize_dynamic, QuantType  # type: ignore[import]
        print(f"Quantizing {src.name} → INT8: {dst.name}")

        # Run ORT graph optimization to fold Transpose nodes before quantizing.
        # This is essential for decoder_with_past (TorchScript-exported) where
        # weights are routed through Transpose before MatMul.
        opt_tmp = _ort_optimize(src)
        quant_src = opt_tmp if opt_tmp is not None else src
        try:
            # Check whether the model actually REFERENCES external data (not just a stale .data
            # sidecar from a previous run) — stale sidecars would incorrectly trigger
            # use_external=True and corrupt quantization output.
            _m = onnx.load(str(quant_src), load_external_data=False)
            use_external = any(
                any(d.key == "location" for d in init.external_data)
                for init in _m.graph.initializer
            )
            # Suppress the "please run pre-processing" suggestion from the root logger —
            # pre-processing via ORT's shape_inference fails on models ≥2 GB (protobuf limit)
            # and can corrupt models exported with TorchScript, so we skip it.
            _prev_disable = logging.root.manager.disable
            logging.disable(logging.WARNING)
            try:
                quantize_dynamic(
                    str(quant_src),
                    str(dst),
                    weight_type=QuantType.QInt8,
                    use_external_data_format=use_external,
                )
            finally:
                logging.disable(_prev_disable)
        finally:
            if opt_tmp is not None and opt_tmp.exists():
                opt_tmp.unlink()
        # Strip spurious opset declarations (e.g. ai.onnx.ml, ai.onnx.training) that ORT's
        # optimizer and quantizer leave behind — ORT rejects models that declare domains at
        # versions beyond its guaranteed support range.
        _cap_ir_version(dst)
        return True
    except Exception as e:
        # Retry with external data unconditionally — required for very large models when the
        # first attempt used inline serialization and hit protobuf's size limit.
        if "Failed to serialize proto" in str(e):
            try:
                from onnxruntime.quantization import quantize_dynamic, QuantType  # type: ignore[import]
                print("  INT8 hit protobuf size limit — retrying with external data sidecar")
                _prev_disable = logging.root.manager.disable
                logging.disable(logging.WARNING)
                try:
                    quantize_dynamic(
                        str(src),
                        str(dst),
                        weight_type=QuantType.QInt8,
                        use_external_data_format=True,
                    )
                finally:
                    logging.disable(_prev_disable)
                _cap_ir_version(dst)
                return True
            except Exception as e2:
                print(f"  INT8 failed after external-data retry: {e2}")
                return False
        print(f"  INT8 failed: {e}")
        return False


def _human_size_with_sidecar(path: pathlib.Path) -> str:
    """Return human-readable file size, adding .data sidecar if present."""
    if not path.exists():
        return "missing"
    size = path.stat().st_size
    for sidecar in (path.with_name(path.name + ".data"), path.with_suffix(path.suffix + ".data")):
        if sidecar.exists():
            size += sidecar.stat().st_size
            break
    return f"{size / 1e6:.0f} MB"


def _do_quantize(out: pathlib.Path, models: list[str]):
    print("\nQuantizing to INT8 (CPU)...")
    for name in models:
        src = out / name
        if src.exists():
            quantize_int8(src, out / (src.stem + "_int8" + src.suffix))


# ── Per-architecture export functions ─────────────────────────────────────────

def _save_spm(tokenizer, dst: pathlib.Path, model_id: str | None = None) -> None:
    if dst.exists():
        return
    if hasattr(tokenizer, "sp_model") and tokenizer.sp_model is not None:
        tokenizer.sp_model.Save(str(dst))
        print(f"[export] Saved sentencepiece model → {dst.name}")
    elif getattr(tokenizer, "vocab_file", None):
        shutil.copyfile(tokenizer.vocab_file, dst)
        print(f"[export] Copied sentencepiece model → {dst.name}")
    elif model_id is not None:
        try:
            from huggingface_hub import hf_hub_download  # type: ignore[import]
            shutil.copyfile(hf_hub_download(repo_id=model_id, filename="sentencepiece.bpe.model"), dst)
            print(f"[export] Downloaded sentencepiece model → {dst.name}")
        except Exception as e:
            print(f"WARNING: could not save sentencepiece.bpe.model: {e}")


def _export_bart_family(model_id: str, model_type: str, out: pathlib.Path):
    """Export NLLB-200 or M2M-100 to ONNX (BART-derived, same four-graph structure).

    Differences: tokenizer class, language token format (eng_Latn vs get_lang_id("fr")).
    Decoder init: [EOS=2, tgt_lang_id]. SPM offset: +1 (fairseq shift).
    """
    if model_type == "m2m100":
        from transformers import M2M100Tokenizer  # type: ignore[import]
        tokenizer = M2M100Tokenizer.from_pretrained(model_id)
        tokenizer.src_lang = "en"
        enc_tok = tokenizer("Hello world", return_tensors="pt")
        tgt_lang_id = tokenizer.get_lang_id("fr")
    else:  # nllb200
        from transformers import NllbTokenizer  # type: ignore[import]
        tokenizer = NllbTokenizer.from_pretrained(model_id)
        enc_tok = tokenizer("Hello world", return_tensors="pt")
        tgt_lang_id = tokenizer.convert_tokens_to_ids("eng_Latn")

    print(f"Saving tokenizer → {out}")
    tokenizer.save_pretrained(str(out))
    # save_pretrained() may only write tokenizer.json (fast format); the C++ plugin
    # needs the raw SentencePiece model file loaded by SentencePieceProcessor::Load().
    _save_spm(tokenizer, out / "sentencepiece.bpe.model")

    model = AutoModelForSeq2SeqLM.from_pretrained(
        model_id, torch_dtype=torch.float32, attn_implementation="eager")
    model.eval()

    enc_in = enc_tok["input_ids"]
    enc_msk = enc_tok["attention_mask"]

    with torch.no_grad():
        enc_wrapper = EncoderONNX(model)
        enc_hidden = enc_wrapper(enc_in, enc_msk)

        export_encoder(enc_wrapper, enc_in, enc_msk, out / "encoder_model.onnx")

        dec_wrapper = DecoderONNX(model)
        dec_in_multi = torch.tensor([[tgt_lang_id, tgt_lang_id, tgt_lang_id]])
        export_decoder(dec_wrapper, dec_in_multi, enc_hidden, enc_msk,
                       out / "decoder_model.onnx")

        kv_init_wrapper = DecoderInitKvONNX(model)
        # [EOS=2, lang_id] — decoder_start_token_id=2 for both NLLB and M2M-100
        dec_in_init = torch.tensor([[2, tgt_lang_id]])
        export_decoder_init_kv(kv_init_wrapper, dec_in_init, enc_hidden, enc_msk,
                               out / "decoder_init_kv_model.onnx")

        with_past_wrapper = DecoderWithPastONNX(model)
        export_decoder_with_past_bart(with_past_wrapper, enc_hidden, enc_msk,
                                      out / "decoder_with_past_model.onnx")

    write_vocab(tokenizer, out / "shared_vocabulary.json")


def _export_mbart50(model_id: str, out: pathlib.Path):
    """Export facebook/mbart-large-50-many-to-many-mmt to ONNX (BART, 50 languages).

    Like NLLB-200 but uses MBart50TokenizerFast, src_lang="en_XX", lang tokens "xx_XX".
    """
    # Prefer the fast Rust tokenizer; fall back to the slow Python one.
    try:
        from transformers import MBart50TokenizerFast  # type: ignore[import]
        tokenizer = MBart50TokenizerFast.from_pretrained(model_id)
    except (ImportError, OSError):
        from transformers import MBartTokenizer  # type: ignore[import]
        tokenizer = MBartTokenizer.from_pretrained(model_id)

    tokenizer.src_lang = "en_XX"
    enc_tok = tokenizer("Hello world", return_tensors="pt")
    tgt_lang_id = tokenizer.convert_tokens_to_ids("fr_XX")

    print(f"Saving MBart-50 tokenizer → {out}")
    tokenizer.save_pretrained(str(out))

    # Ensure the raw SentencePiece model file is present for the C++ plugin runtime.
    # save_pretrained() copies sentencepiece.bpe.model from the HF cache when available.
    _save_spm(tokenizer, out / "sentencepiece.bpe.model", model_id)

    print(f"Loading MBart-50 model from {model_id} ...")
    model = AutoModelForSeq2SeqLM.from_pretrained(
        model_id, torch_dtype=torch.float32, attn_implementation="eager")
    model.eval()

    enc_in = enc_tok["input_ids"]
    enc_msk = enc_tok["attention_mask"]

    with torch.no_grad():
        enc_wrapper = EncoderONNX(model)
        enc_hidden = enc_wrapper(enc_in, enc_msk)

        export_encoder(enc_wrapper, enc_in, enc_msk, out / "encoder_model.onnx")

        dec_wrapper = DecoderONNX(model)
        dec_in_multi = torch.tensor([[tgt_lang_id, tgt_lang_id, tgt_lang_id]])
        export_decoder(dec_wrapper, dec_in_multi, enc_hidden, enc_msk,
                       out / "decoder_model.onnx")

        kv_init_wrapper = DecoderInitKvONNX(model)
        # [EOS=2, tgt_lang_id] — identical decoder init format to NLLB-200
        dec_in_init = torch.tensor([[2, tgt_lang_id]])
        export_decoder_init_kv(kv_init_wrapper, dec_in_init, enc_hidden, enc_msk,
                               out / "decoder_init_kv_model.onnx")

        with_past_wrapper = DecoderWithPastONNX(model)
        export_decoder_with_past_bart(with_past_wrapper, enc_hidden, enc_msk,
                                      out / "decoder_with_past_model.onnx")

    write_vocab(tokenizer, out / "shared_vocabulary.json")

    print(f"\nMBart-50 export complete → {out}")
    print("shared_vocabulary.json includes all language tokens (fr_XX, ar_AR, ...).")
    print("These are needed by the C++ runtime to resolve language token IDs.")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    """CLI entry point: parse args, run export, optionally post-process INT8."""
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--model", default=None,
                        help="HuggingFace model ID (overrides --model-type default)")
    parser.add_argument("--model-type", default="nllb200",
                        choices=list(MODEL_REGISTRY.keys()),
                        help="Model variant: nllb200 (default) | m2m100 | mbart50")
    parser.add_argument("--output", type=pathlib.Path, default=OUTPUT_DIR,
                        help="Output directory (default: data/models/<model-type>/)")
    parser.add_argument("--quantize", action="store_true",
                        help="Also export INT8 variants for CPU (requires onnxruntime)")
    parser.add_argument("--quantize-only", action="store_true",
                        help="Re-quantize INT8 from existing FP32 models (skip full export)")
    args = parser.parse_args()

    mtype = MODEL_REGISTRY[args.model_type]
    model_id = args.model if args.model else mtype["default_hf_id"]
    arch = mtype["arch"]

    # Place each model type in its own sub-directory to avoid filename collisions.
    if args.output == OUTPUT_DIR:
        out = args.output / args.model_type
    else:
        out = args.output
    out.mkdir(parents=True, exist_ok=True)

    _ALL_MODELS = [
        "encoder_model.onnx",
        "decoder_model.onnx",
        "decoder_init_kv_model.onnx",
        "decoder_with_past_model.onnx",
    ]

    if args.quantize_only:
        _do_quantize(out, _ALL_MODELS)
        return

    # ── Full export ──────────────────────────────────────────────────────────
    print(f"Exporting {model_id}  (model-type: {args.model_type}) → {out}")
    if arch == "mbart50":
        _export_mbart50(model_id, out)
    else:
        _export_bart_family(model_id, args.model_type, out)

    download_lid(out / "lid.176.ftz")

    if args.quantize: _do_quantize(out, _ALL_MODELS)

    print("\nDone. Files written:")
    extras = ["sentencepiece.bpe.model", "lid.176.ftz", "shared_vocabulary.json"]
    for name in _ALL_MODELS + extras:
        p = out / name
        size = _human_size_with_sidecar(p)
        print(f"  {name:<42} {size}")


if __name__ == "__main__":
    main()
