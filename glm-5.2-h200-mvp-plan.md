# GLM-5.2 on H200: MVP Build Plan

## 1. Scope

Build a small, explainable animation for one model family and one hardware target:

- Model: GLM-5.2
- Initial precision/deployment anchor: FP8
- Server: H200 server, provisionally 8 H200 GPUs per server
- Serving unit: one 8-GPU H200 server is one GLM-5.2 FP8 worker/replica for the MVP
- Total capacity: 16 H200 servers / 128 H200 GPUs / 16 provisional workers
- Allocation variants: Unified 16 servers, Split 8 + 8 servers, Split 10 + 6 servers, Split 12 + 4 servers

The 8 + 4 variant is intentionally excluded; it was the correction from the original discussion. The corrected variant is 12 + 4 servers.

The first visual should answer one question: after each worker loads model weights, how much VRAM remains for KV cache, and how many sessions can that budget hold at a selected context length? This is an educational capacity model, not a production performance claim.

## 2. Modeling convention

Use `server` as the allocation unit for this MVP. The UI and data model must distinguish:

- `servers`: H200-equipped machines used in the allocation animation
- `gpus`: physical H200 GPUs
- `gpus_per_server`: GPUs inside one H200 server
- `nodes`: physical network/topology grouping, if different from servers
- `total_gpus`: actual GPU count

Do not use “server” as a synonym for GPU. For this MVP, assume one H200 server contains 8 H200 GPUs, so 16 servers contain 128 GPUs. Keep `gpus_per_server` editable because the exact server SKU must be confirmed before benchmarking.

| Allocation | Servers | GPUs | Raw HBM |
|---|---:|---:|---:|
| 4 H200 servers | 4 | 32 | 4,512 GB |
| 6 H200 servers | 6 | 48 | 6,768 GB |
| 8 H200 servers | 8 | 64 | 9,024 GB |
| 10 H200 servers | 10 | 80 | 11,280 GB |
| 12 H200 servers | 12 | 96 | 13,536 GB |
| 16 H200 servers | 16 | 128 | 18,048 GB |

## 3. First visual

Show four layers:

1. Hardware: H200 server blocks, each containing eight GPU sub-blocks, assigned to a unified pool or two split pools.
2. Model weights: gray allocation showing the GLM-5.2 FP8 footprint per worker.
3. Runtime/headroom: amber allocation for runtime workspace and safety reserve.
4. KV cache: green available KV, blue admitted session KV, and red overflow/waiting sessions.

For the one-model MVP, call the second side `secondary pool`, not `stranded capacity`. Stranded capacity is a multi-model or routing concept and should appear only after a second workload is introduced.

## 4. Minimal formulas

Use a transparent per-worker memory budget. The 893 GB recipe figure is treated as one 8-GPU worker footprint:

```text
gpu_count = server_count × gpus_per_server

raw_hbm_per_worker_gb = gpus_per_server × 141

usable_hbm_per_worker_gb = raw_hbm_per_worker_gb × usable_memory_fraction

kv_headroom_per_worker_gb = usable_hbm_per_worker_gb
                 - model_weight_memory_per_worker_gb
                 - runtime_overhead_gb
                 - safety_reserve_gb

session_kv_bytes = context_tokens × kv_bytes_per_token

pool_kv_headroom_gb = server_count × kv_headroom_per_worker_gb

resident_sessions = floor(
  pool_kv_headroom_gb × 1,000,000,000 / session_kv_bytes
)
```

For a split allocation, calculate each pool independently. A session assigned to the primary pool cannot consume the secondary pool’s KV budget unless a later version explicitly models migration or shared scheduling. If the deployment later becomes one multi-server sharded worker, replace this replica calculation with the actual weight placement and parallelism layout.

The initial `kv_bytes_per_token` must be a fixture value or relative analytical unit. Do not present it as a measured GLM-5.2 number until the exact checkpoint, runtime, attention implementation, cache dtype, and parallelism are known. If it is `null`, show relative KV budget bars and label the output `illustrative / not measured`.

## 5. Suggested project shape

Keep the first implementation small: `index.html`, `styles.css`, `app.js`, `data/glm-5.2-h200-mvp.json`, and the two Markdown documents in `docs/` or the project root. Use plain HTML, CSS, and JavaScript for the first working animation. Add a framework, database, backend, and benchmark runner only after the interaction is validated.

## 6. Fixture data contract

Create one local JSON fixture. Keep assumptions, evidence, and measured values separate.

```json
{
  "model": {
    "family": "GLM",
    "name": "GLM-5.2",
    "checkpoint": "pin exact checkpoint/revision before benchmarking",
    "precision": "FP8",
    "contextLimitTokens": 250000
  },
  "hardware": {
    "gpu": "H200",
    "hbmPerGpuGb": 141,
    "gpusPerServer": 8,
    "totalServers": 16,
    "totalGpus": 128,
    "unitsMeaning": "server"
  },
  "assumptions": {
    "modelWeightMemoryPerWorkerGb": 893,
    "usableMemoryFraction": 0.90,
    "runtimeOverheadGb": 0,
    "safetyReserveGb": 0,
    "kvBytesPerToken": null,
    "status": "illustrative"
  },
  "presets": [
    { "id": "unified-16", "label": "Unified 16 servers", "primaryServers": 16, "secondaryServers": 0 },
    { "id": "split-8-8", "label": "Split 8 + 8 servers", "primaryServers": 8, "secondaryServers": 8 },
    { "id": "split-10-6", "label": "Split 10 + 6 servers", "primaryServers": 10, "secondaryServers": 6 },
    { "id": "split-12-4", "label": "Split 12 + 4 servers", "primaryServers": 12, "secondaryServers": 4 }
  ],
  "evidence": [
    {
      "field": "modelWeightMemoryPerWorkerGb",
      "value": 893,
      "status": "recipe-based estimate",
      "source": "vLLM GLM-5 recipe"
    },
    {
      "field": "hbmPerGpuGb",
      "value": 141,
      "status": "published hardware specification",
      "source": "NVIDIA H200 product specification"
    }
  ]
}
```

The `893 GB` weight footprint is a recipe-level deployment estimate, not a universal measured runtime memory value. Keep it editable so later benchmark evidence can replace it without changing the UI logic.

## 7. Incremental implementation plan

### Increment 1 — Static allocation visual

Goal: make the hardware and allocation boundary immediately understandable.

Implement sixteen H200 server blocks, each optionally showing eight GPU sub-blocks and one worker/replica weight allocation; a preset selector for Unified 16, Split 8 + 8, Split 10 + 6, and Split 12 + 4 servers; primary and secondary pool labels; server and GPU totals; raw HBM totals; per-worker and aggregate weight bars; and an evidence panel showing published, recipe-based, assumed, and missing values.

Acceptance checks:

- Every preset sums to 16.
- The 12 + 4 preset is present and the 8 + 4 preset is absent.
- The UI never calls unused capacity “stranded” yet.
- No output is labeled “measured” without a measurement record.

### Increment 2 — KV budget animation

Goal: make the VRAM-to-KV relationship visible with one interaction.

Implement context choices 8K, 32K, 64K, 128K, and 250K; a concurrent-session slider; and a replay button. Animate this sequence: load H200 blocks, assign pools, reserve weights, reserve runtime/safety headroom, reveal KV budget, admit sessions one at a time, fill the budget with blue session segments, and move excess sessions to a red waiting/overflow state.

Respect `prefers-reduced-motion` and provide a non-animated final state. If `kvBytesPerToken` is missing, animate normalized KV units and display `relative KV illustration`.

### Increment 3 — Comparison panel

Goal: compare unified and split allocations without introducing a second model.

Show for each pool: H200 server count, GPU count, worker count, raw HBM, aggregate weight footprint, KV headroom, requested sessions, KV-resident sessions, and sessions beyond the modeled budget.

Include this explanation: “Unified exposes all worker KV budgets to one workload scheduler. Split allocations create separate local budgets; the secondary pool does not lend capacity automatically.”

The first useful comparison is whether the selected session load fits inside each pool’s local KV budget, not total theoretical VRAM.

### Increment 4 — Evidence and provenance panel

Goal: make every important number auditable.

Add exact checkpoint and revision; precision and quantization; observed weight memory; runtime workspace; safety reserve; KV dtype; attention/cache implementation; tensor, pipeline, expert, and data-parallel dimensions; context/concurrency sweep; TTFT; inter-token latency; output tok/s; aggregate tok/s; and the evidence status for every number.

Use these statuses:

- `illustrative`: fixture or pedagogical value
- `derived`: calculated from recorded architecture/configuration values
- `recipe-based estimate`: copied from a deployment recipe or planning document
- `measured`: produced by a reproducible benchmark run with environment metadata
- `published benchmark`: externally reported with workload and configuration details

### Increment 5 — Topology and RoCE parameters

Goal: add physical deployment realism only after the memory animation is stable.

Add explicit `servers`, `gpus_per_server`, `nodes`, `gpus_per_node`, `total_gpus`, `interconnect` (NVLink, InfiniBand, RoCE, or TCP), effective network bandwidth, effective latency, NIC affinity, and placement. For the requested 2/4/6/8-style studies, clarify whether each number means servers, GPUs per group, GPUs per node, or nodes. Never silently reinterpret it.

Do not apply a made-up fixed RoCE penalty. Record effective bandwidth and latency from a communication microbenchmark, then connect those values to KV transfer, expert routing, or disaggregated prefill/decode traffic.

### Increment 6 — Second model and true fragmentation

Goal: make “stranded capacity” meaningful.

Only after the one-model visual works, add a second model/workload to the secondary pool. Then calculate capacity assigned to each model, capacity required by each model, free capacity unusable by the other model under the scheduling rule, and rebalancing/migration effects.

## 8. Later database shape

Do not start with a database. Store JSON fixtures and benchmark artifacts first. When the schema is stable, migrate to SQLite with these entities:

- `models`: family, exact name, revision, architecture, context limit, precision
- `hardware`: GPU, HBM, bandwidth, topology metadata
- `deployments`: model, hardware, pool sizes, parallelism, runtime, quantization
- `assumptions`: field, value, units, rationale, status
- `benchmarks`: prompt/output lengths, concurrency, SLO, measured metrics
- `evidence`: source URL, source date, claim, confidence, extraction notes
- `artifacts`: raw logs, configs, benchmark commands, environment snapshots

Every displayed number should eventually point to an assumption, derivation, or artifact. That matters more than adding many models quickly.

## 9. Do not build yet

- Automatic web research pipeline
- B200 comparison
- DeepSeek or Kimi implementation
- Cost or quality model
- Automatic RoCE performance prediction
- Linear scaling assumption across 2, 4, 6, and 8 groups
- Fixed claim that the full context limit is operationally usable
- Production scheduler or serving stack

## 10. Handoff for the next build session

Read these files first:

1. `ai-model-pool-capacity-simulator-spec.md`
2. `glm-5.2-h200-research.md`
3. `glm-5.2-h200-mvp-plan.md`

Then implement Increment 1 and Increment 2 using the local JSON fixture. Do not begin with the database, benchmark harness, or RoCE simulation. The first success criterion is a working animation that makes the relationship between H200 VRAM, GLM-5.2 weights, KV headroom, context length, and resident sessions obvious.

Once that interaction is convincing, use Increment 3 to compare the four corrected allocation presets and use Increment 4 to prevent assumptions from being mistaken for measurements.
