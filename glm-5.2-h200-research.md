# GLM-5.2 on H200: Research Foundation

**Purpose:** Research baseline for the AI Model Pool Capacity Simulator.

**Scope:** One model family and one starting model: GLM-5.2 on NVIDIA H200. The initial fleet assumption is 16 H200 servers, provisionally modeled as 8 H200 GPUs per server, compared as server allocations:

- Unified: 16 servers
- Split: 8 + 8 servers
- Split: 10 + 6 servers
- Split: 12 + 4 servers

**Research status:** A mixture of official specifications, serving recipes, measured benchmark points, and analytical assumptions. No number in this document should be treated as an exact internal production capacity value unless its provenance says `internal measurement`.

**Research date:** 2026-09-02

---

## 1. Main conclusion

The project can begin with a useful and understandable animation centered on one relationship:

> Model weights consume a fixed portion of VRAM. The remaining VRAM is the budget for KV cache, runtime workspace, activations, and safety headroom. That remaining budget determines how many sessions can remain active at a selected context length and experience target.

Public information is sufficient to create the first research-backed shell:

- GLM-5-family architecture metadata is available.
- H200 memory and bandwidth specifications are available.
- GLM-5-family deployment recipes exist for H200 and B200.
- Several GLM-5.2 H200/B200 benchmark points are published.
- The relationship between weights, KV cache, context length, concurrency, and SLO can be calculated.

Public information is not sufficient to claim exact 16-server capacity curves for the organization's checkpoint, runtime, RoCE topology, or workload. Those values require controlled measurements.

---

## 2. GLM-5 and GLM-5.2 facts

The original GLM-5 release is described by Z.ai as a 744B-parameter MoE model with 40B active parameters, trained on 28.5T tokens and using DeepSeek Sparse Attention (DSA). The official repository now also contains GLM-5.1, GLM-5.2, and GLM-5.3, so the exact checkpoint and revision must always be recorded.

Sources:

- [Z.ai GLM-5 repository](https://github.com/zai-org/GLM-5)
- [GLM-5 model configuration](https://huggingface.co/zai-org/GLM-5/raw/main/config.json)
- [GLM-5 technical report](https://arxiv.org/abs/2602.15763)

The GLM-5 configuration exposes these useful architecture parameters:

```text
Architecture: GlmMoeDsaForCausalLM
Hidden size: 6144
Layers: 78
Attention heads: 64
Routed experts: 256
Selected experts per token: 8
Shared experts: 1
MoE intermediate size: 2048
KV latent rank: 512
RoPE head dimension: 64
Maximum position embeddings: 202,752
MTP prediction layers: 1
```

These parameters are useful inputs to analytical estimates, but they do not by themselves determine serving throughput.

GLM-5.2 is a separate release target from the original GLM-5. The current NVIDIA Dynamo recipe describes GLM-5.2/5.3 as using:

- B200 NVFP4 weights with up to 500K context in the published recipe.
- H200 FP8 weights with up to 250K context in the published recipe.
- Aggregated and prefill/decode-disaggregated serving paths.
- KV-aware routing and EAGLE-style MTP speculative decoding.

Source: [NVIDIA Dynamo GLM-5.2 recipe](https://docs.nvidia.com/dynamo/dev/recipes/glm-5-2)

For this project, the exact initial target should be pinned as:

```text
model family: GLM-5
model release: GLM-5.2
checkpoint: exact internal or public checkpoint identifier
checkpoint revision: immutable commit/hash
precision: FP8 unless explicitly changed
engine: vLLM or SGLang
engine version/commit: pinned
maximum context: selected explicitly, initially 250K for the H200 recipe
```

---

## 3. H200 facts

NVIDIA lists the H200 SXM with:

```text
HBM capacity: 141 GB
HBM bandwidth: 4.8 TB/s
NVLink GPU-to-GPU bandwidth: 900 GB/s class
```

Sources:

- [NVIDIA H200 specifications](https://www.nvidia.com/en-eu/data-center/h200/)
- [NVIDIA HGX H200/B200 platform specifications](https://docs.nvidia.com/enterprise-reference-architectures/hgx-ai-factory-h100-h200-b200/latest/components.html)

For the initial topology assumption of 8 H200 GPUs per server, raw HBM totals are:

| H200 servers | H200 GPUs | Raw HBM |
|---:|---:|---:|
| 4 | 32 | 4,512 GB |
| 6 | 48 | 6,768 GB |
| 8 | 64 | 9,024 GB |
| 10 | 80 | 11,280 GB |
| 12 | 96 | 13,536 GB |
| 16 | 128 | 18,048 GB |

Raw HBM is not the same as usable model memory. The pool also needs model weights, KV cache, activations, CUDA graph memory, communication buffers, runtime workspace, and safety headroom.

The simulator should therefore use:

```text
gpu_count = server_count × gpus_per_server

usable_hbm
  = server_count × gpus_per_server × hbm_per_gpu × usable_memory_fraction
```

The `usable_memory_fraction` is an explicit assumption, not a universal constant.

---

## 4. Published GLM-5-family memory and serving guidance

The vLLM GLM-5 recipe lists the following minimum VRAM estimates:

| Variant | Listed minimum VRAM | Interpretation |
|---|---:|---|
| BF16 | 1,786 GB | Requires multi-node deployment |
| FP8 | 893 GB | Described as suitable for one 8×H200/H20 worker |
| NVFP4 | 446 GB | Intended for Blackwell GPUs |

Source: [vLLM GLM-5 recipe](https://github.com/vllm-project/recipes/blob/main/models/zai-org/GLM-5.yaml)

These are recipe-level memory floors, not measured production utilization. The 893 GB value should be treated as the footprint of one 8-GPU worker/replica for the first animation, not subtracted only once from an arbitrarily large server pool. If a later deployment uses one model instance sharded across multiple servers, its weight placement must be modeled separately.

For H200 and FP8, the current family guidance centers on an 8-GPU worker using TP8/EP8. Under the provisional 8-GPU-per-server assumption, each server can represent one such worker. The initial 16-server fleet therefore represents up to 16 eight-GPU workers, while the 8+8, 10+6, and 12+4 variants represent server-pool splits of 64+64, 80+48, and 96+32 GPUs. The simulator must retain both server count and GPU count; it must not silently treat server count as GPU count.

---

## 5. Existing GLM-5.2 measured reference points

NVIDIA Dynamo publishes GLM-5.2 results using an agentic trace with:

```text
Median input sequence length: 64K
Median output sequence length: 400
KV-cache reuse: 90%
Target user output rate: approximately 50 tok/s/user
Backend: SGLang
KV-aware routing: enabled
EAGLE-style MTP: enabled
```

Published points:

| Deployment | Worker layout | Total GPUs | Concurrency | System output tok/s/GPU | User output tok/s | TTFT P50 |
|---|---|---:|---:|---:|---:|---:|
| B200 aggregated | 4 × DTP4 workers | 16 | 64 | 176.420 | 57.493 | 356 ms |
| B200 disaggregated | 3 × 4-GPU prefill + 1 × 8-GPU decode | 20 | 128 | 320.907 | 65.105 | 1,938 ms |
| H200 aggregated | 3 × TP8/EP8 workers | 24 | 32 | 54.550 | 52.370 | 1,790 ms |
| H200 disaggregated | 1 × 8-GPU prefill + 1 × 8-GPU decode | 16 | 24 | 68.860 | 53.880 | 1,874 ms |

Source: [NVIDIA Dynamo GLM-5.2 recipe and benchmark](https://docs.nvidia.com/dynamo/dev/recipes/glm-5-2)

These points are valuable anchors, but they are not interchangeable with the project's first MVP because:

- They use a particular software snapshot.
- They use a particular agentic trace.
- They report selected operating points, not a complete 2/4/6/8 or 16-GPU capacity curve.
- The H200 and B200 recipes use different checkpoint/precision paths.
- The reported GLM-5.2 H200 context limit is 250K in this recipe.

The first database should store these as `published_benchmark`, with the complete workload and software metadata.

---

## 6. RoCE and multi-node considerations

The public GLM-5.2 Dynamo recipe uses NIXL/UCX over InfiniBand for its disaggregated examples. That is useful evidence for the communication pattern, but it is not a RoCE measurement.

Sources:

- [NVIDIA Dynamo GLM-5.2 recipe](https://docs.nvidia.com/dynamo/dev/recipes/glm-5-2)
- [NVIDIA Dynamo communication guide](https://docs.nvidia.com/dynamo/v1.0.2/kubernetes-deployment/deployment-guide/disagg-communication)
- [NCCL performance and RoCE tuning](https://docs.nvidia.com/deeplearning/nccl/archives/nccl_2307/user-guide/docs/troubleshooting/performance_and_tuning.html)

The communication model should account for:

```text
intra-node: NVLink/NVSwitch
inter-node: RoCE RDMA
GPU-to-NIC affinity
GPUDirect RDMA
NIC count and link rate
switch oversubscription
ECN/PFC/lossless behavior
NCCL QP configuration
UCX/NIXL configuration
```

NCCL documentation specifically notes that multiple queue pairs per connection may be necessary for good RoCE performance, and that congestion-control and lossless-fabric configuration can dominate performance.

The simulator should not derive a universal RoCE penalty from link speed alone. It should initially expose RoCE as a parameter and later ingest measured effective bandwidth and latency.

---

## 7. What can be calculated from architecture

### 7.1 Static memory feasibility

```text
usable_hbm
  = gpu_count × hbm_per_gpu × memory_utilization_target

kv_headroom
  = usable_hbm
    - model_weight_memory
    - runtime_workspace
    - activation_reserve
    - communication_reserve
    - safety_headroom
```

The model-weight term should preferably come from the actual checkpoint size and loaded tensor dtypes. Parameter count multiplied by bytes per parameter is only a first approximation. For the initial server-level model, use `weight_memory_per_worker`; for a pool of independent 8-GPU workers, aggregate weight memory is `worker_count × weight_memory_per_worker`.

### 7.2 KV-resident concurrency

For ordinary attention, a rough lower-level formula is:

```text
kv_bytes_per_token
  = 2 × layers × kv_heads × head_dim × bytes_per_element
```

This formula is not sufficient for GLM-5.2 because DSA and latent attention change the cache layout. The exact implementation should be inspected for:

- Compressed KV state.
- DSA indexer state.
- Any per-layer or per-token metadata.
- KV-cache dtype.
- Page/block size.
- Prefix-cache representation.

For the first animation, use a configurable `kv_bytes_per_session` or `kv_bytes_per_token` fixture and label it `illustrative` or `analytical estimate`.

### 7.3 Good-experience concurrency

KV-resident concurrency is not sufficient. The application should eventually derive:

```text
good_experience_concurrency
  = largest concurrency where:
      TTFT meets target
      TPOT/ITL meets target
      tail latency meets target
      error rate meets target
```

### 7.4 Multi-node communication

At a simplified level:

```text
communication_time
  ≈ collective_latency
    + collective_bytes / effective_bandwidth
```

For prefill/decode disaggregation:

```text
kv_transfer_time
  ≈ transferred_kv_bytes / effective_roce_bandwidth
    + network_latency
```

`effective_roce_bandwidth` must eventually come from NCCL/UCX/NIXL measurements for the exact fabric.

---

## 8. What should not be inferred

Do not infer these directly from model size:

- Exact tokens/second.
- Exact users supported.
- Linear scaling from 8 to 16 H200 servers or from 8 to 128 GPUs.
- A valid 6-GPU or 4-GPU GLM-5.2 deployment.
- RoCE performance from InfiniBand performance.
- KV bytes per token from a standard GQA formula.
- Production SLO capacity from a peak throughput benchmark.

The database should support `unsupported_configuration` and `insufficient_data` states.

---

## 9. Recommended reference database

Start with SQLite plus immutable JSON/JSONL benchmark artifacts. Export a small JSON fixture for the animation.

Core entities:

```text
model_release
hardware_sku
topology
serving_recipe
workload_profile
evidence_source
benchmark_run
benchmark_metric
derived_capacity_point
```

Every result should retain:

```text
model/checkpoint/revision
hardware SKU
node count and GPU count
intra/inter-node fabric
engine version and commit
precision and KV dtype
TP/PP/EP/DP layout
prefill/decode layout
input/output token distribution
KV reuse rate
concurrency
TTFT/TPOT/latency percentiles
output and total throughput
HBM/KV usage
network measurements
provenance
confidence
configuration match quality
```

Provenance values:

```text
internal_measurement
published_benchmark
recipe_based_estimate
analytical_estimate
manual_override
unsupported_configuration
```

---

## 10. Research workflow

1. Pin the exact model checkpoint and revision.
2. Extract architecture and quantization metadata.
3. Register H200 hardware and actual node topology.
4. Register the serving engine, version, and launch arguments.
5. Run static memory feasibility checks.
6. Validate NCCL, UCX, GPUDirect RDMA, and RoCE independently.
7. Run controlled model load tests.
8. Sweep concurrency and workload shape.
9. Record SLO metrics and memory/network telemetry.
10. Fit capacity curves only across comparable runs.
11. Store ranges and confidence, not false precision.
12. Promote validated data into simulator fixtures.

The initial GLM-5.2 work should focus on producing one trustworthy H200 single-server or two-server baseline before adding RoCE and multi-node effects. The 16-server visualization can be built before those measurements, but its values must remain explicitly derived or illustrative.
