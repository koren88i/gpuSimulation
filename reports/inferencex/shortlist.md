# Audited comparison shortlist

## Result of the review

Five illustrative AgentX comparisons were retained, using eight unique benchmark points. All eight match original small GitHub aggregate artifacts by model, image, framework, precision, speculative mode, concurrency, output throughput and p90 first-token latency. Actual model checkpoint names, allocated GPUs and dataset metadata agree within each pair. The audit downloaded 66 small aggregates from 5 runs, with 0 download errors.

**These verify measured operating points, not optimal setup capacity. No example is promoted to a proven production-capacity maximum.** Most larger allocations were tested at only one or two load levels. The shortlist includes a split-favored case, but that case does not establish that split will always win. Do not use the extreme percentage gains from undersampled low-concurrency baselines as general scaling factors.

## Compact comparison

All allocations below are **GB200/GB300 four-GPU compute-tray equivalents**, not eight-GPU B200 servers. Total allocated GPUs are equal on both sides. Columns show **larger measured deployment / projected independent copies**. Active sessions and DAU include the shared 20% reserve; they are estimates. Sessions assume one root coding-session tree per active user. DAU uses the shared two-active-hours/day, eight-hour window, 2x within-window peak profile. The active-session and DAU gains are identical because the conversion factors are shared.

# | Model / hardware | Tray allocation | GPUs each side | Active sessions L / split | DAU L / split | Session / DAU gain | Output tok/s L / split | Throughput gain
--- | --- | --- | --- | --- | --- | --- | --- | ---
1 | dsv4 / gb200 | 8 vs 4+4 | 32 | 409.6 / 409.6 | 819.2 / 819.2 | 0% | 15,698.68 / 14,978.2 | 4.81%
2 | kimik3 / gb300 | 6 vs 2+2+2 | 24 | 25.6 / 9.6 | 51.2 / 19.2 | 166.67% | 1,156.74 / 578.82 | 99.84%
3 | kimik3 / gb300 | 8 vs 2+2+2+2 | 32 | 25.6 / 12.8 | 51.2 / 25.6 | 100% | 1,192.31 / 771.76 | 54.49%
4 | dsv4 / gb200 | 4 vs 2+2 | 16 | 204.8 / 108.8 | 409.6 / 217.6 | 88.24% | 7,489.1 / 2,579.81 | 190.3%
5 | glm5.2 / gb200 | 8 vs 2+2+2+2 | 32 | 36 / 51.2 | 72 / 102.4 | -29.69% | 1,822.76 / 2,269.85 | -19.7%

All selected points pass the default p90 TTFT <= 10 seconds and p90 TPOT <= 0.1 seconds. These latency values stay unchanged when modeling independent copies.

# | Configured root sessions L / split | p90 TTFT seconds L / small | p90 TPOT ms L / small | Dates L / small
--- | --- | --- | --- | ---
1 | 512 / 512 | 6.11 / 5.7 | 18.15 / 17.83 | 2026-08-18 / 2026-08-18
2 | 32 / 12 | 6.46 / 3.86 | 9.55 / 5.16 | 2026-09-04 / 2026-09-04
3 | 32 / 16 | 7.48 / 3.86 | 7.04 / 5.16 | 2026-09-04 / 2026-09-04
4 | 256 / 136 | 5.7 / 3.59 | 17.83 / 98.26 | 2026-08-18 / 2026-08-14
5 | 45 / 64 | 6.77 / 9.56 | 5.2 / 13.38 | 2026-08-19 / 2026-08-16

## Evidence for each example

### 1. Closest controlled comparison

Same source run, engine image and router version. Small/large measured loads scale together. Sparse sweeps do not establish the maximum capacity of either size.

- Model checkpoint: deepseek-ai/DeepSeek-V4-Pro. Corpus: semianalysis_cc_traces_weka_062126, split train, 393 entries on both sides.
- Large allocation: 16 prefill + 16 decode GPUs; small allocation: 8 prefill + 8 decode GPUs. Decode=0 in an aggregated source means those same prefill devices perform decode too.
- Images: large vllm/vllm-openai:nightly-dev-arm64-cu13.0.1-426e59f; small vllm/vllm-openai:nightly-dev-arm64-cu13.0.1-426e59f.
- Routers: large {"name":"dynamo-router","version":"1.3.0.dev20260720"}; small {"name":"dynamo-router","version":"1.3.0.dev20260720"}. Null means not recorded, not proof there was no router.
- Observed concurrency sweep: large [512]; small [128, 256]. Higher measured loads failing default latency: large []; small []. An empty list does not establish unused headroom or saturation.
- Profiling-only errors: large 59/57224 (0.1%); small 26/27934 (0.09%).
- Sources: [large row 439975, artifact 9270659360](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/31965016666/attempts/2); [small row 439969, artifact 9269791953](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/31965016666/attempts/2). Original artifact hashes and filenames are in shortlist.json.

### 2. Kimi K3: three-copy baseline

Same source run and engine image; aggregated baseline versus P/D deployment. Small setup was tested at few concurrency values. Treat the result as an observed operating-point comparison.

- Model checkpoint: moonshotai/Kimi-K3. Corpus: semianalysis_cc_traces_weka_062126, split train, 393 entries on both sides.
- Large allocation: 8 prefill + 16 decode GPUs; small allocation: 8 prefill + 0 decode GPUs. Decode=0 in an aggregated source means those same prefill devices perform decode too.
- Images: large vllm/vllm-openai:nightly-dev-arm64-cu13-3696c77; small vllm/vllm-openai:nightly-dev-arm64-cu13-3696c77.
- Routers: large {"name":"dynamo-router","version":"ba83080ecd31c1ce918559e576d3c5bc9e092ff1"}; small null. Null means not recorded, not proof there was no router.
- Observed concurrency sweep: large [32, 48, 64]; small [1, 4, 48, 70]. Higher measured loads failing default latency: large [48, 64]; small [70]. An empty list does not establish unused headroom or saturation.
- Profiling-only errors: large 0/4067 (0%); small 1/543 (0.18%).
- Sources: [large row 441058, artifact 9878869484](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/33701025625/attempts/3); [small row 441056, artifact 9922855888](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/33701025625/attempts/3). Original artifact hashes and filenames are in shortlist.json.

### 3. Kimi K3: four-copy baseline

Same source run and engine image. Shares the small baseline with the preceding example, so these are related examples, not independent replications.

- Model checkpoint: moonshotai/Kimi-K3. Corpus: semianalysis_cc_traces_weka_062126, split train, 393 entries on both sides.
- Large allocation: 8 prefill + 24 decode GPUs; small allocation: 8 prefill + 0 decode GPUs. Decode=0 in an aggregated source means those same prefill devices perform decode too.
- Images: large vllm/vllm-openai:nightly-dev-arm64-cu13-3696c77; small vllm/vllm-openai:nightly-dev-arm64-cu13-3696c77.
- Routers: large {"name":"dynamo-router","version":"ba83080ecd31c1ce918559e576d3c5bc9e092ff1"}; small null. Null means not recorded, not proof there was no router.
- Observed concurrency sweep: large [1, 32, 48]; small [1, 4, 48, 70]. Higher measured loads failing default latency: large [48]; small [70]. An empty list does not establish unused headroom or saturation.
- Profiling-only errors: large 0/4174 (0%); small 1/543 (0.18%).
- Sources: [large row 441057, artifact 9902847914](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/33701025625/attempts/3); [small row 441056, artifact 9922855888](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/33701025625/attempts/3). Original artifact hashes and filenames are in shortlist.json.

### 4. DeepSeek: broader small-side sweep

Small-side sweep crosses the latency limit above the selected point; larger-side maximum remains unproven. Engine and router versions differ across four days.

- Model checkpoint: deepseek-ai/DeepSeek-V4-Pro. Corpus: semianalysis_cc_traces_weka_062126, split train, 393 entries on both sides.
- Large allocation: 8 prefill + 8 decode GPUs; small allocation: 8 prefill + 0 decode GPUs. Decode=0 in an aggregated source means those same prefill devices perform decode too.
- Images: large vllm/vllm-openai:nightly-dev-arm64-cu13.0.1-426e59f; small vllm/vllm-openai:nightly-3ee2df30337a301164c46ae444b76ee67e71c106.
- Routers: large {"name":"dynamo-router","version":"1.3.0.dev20260720"}; small {"name":"dynamo-router","version":"1.3.1"}. Null means not recorded, not proof there was no router.
- Observed concurrency sweep: large [128, 256]; small [8, 12, 16, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80]. Higher measured loads failing default latency: large []; small [72, 76, 80]. An empty list does not establish unused headroom or saturation.
- Profiling-only errors: large 26/27934 (0.09%); small 0/5036 (0%).
- Sources: [large row 439969, artifact 9269791953](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/31965016666/attempts/2); [small row 439841, artifact 9210768216](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/31743991710/attempts/1). Original artifact hashes and filenames are in shortlist.json.

### 5. Split-favored counterexample

Same model checkpoint and corpus; engine and router versions differ. Larger allocation has one measured concurrency, so this does not prove split deployments have greater ultimate capacity.

- Model checkpoint: nvidia/GLM-5.2-NVFP4. Corpus: semianalysis_cc_traces_weka_062126, split train, 393 entries on both sides.
- Large allocation: 8 prefill + 24 decode GPUs; small allocation: 8 prefill + 0 decode GPUs. Decode=0 in an aggregated source means those same prefill devices perform decode too.
- Images: large lmsysorg/sglang:nightly-dev-cu13-20260805-211ee642; small lmsysorg/sglang:v0.5.17-cu130.
- Routers: large {"name":"dynamo-router","version":"1.2.1"}; small {"name":"dynamo-router","version":"71eb001e17fa73c742f0afe1a6ed96836cb135fd"}. Null means not recorded, not proof there was no router.
- Observed concurrency sweep: large [45]; small [1, 2, 4, 8, 12, 16]. Higher measured loads failing default latency: large []; small []. An empty list does not establish unused headroom or saturation.
- Profiling-only errors: large 0/6224 (0%); small 0/2159 (0%).
- Sources: [large row 440078, artifact 9377141615](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/32207758126/attempts/2); [small row 439949, artifact 9267839410](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/31958517356/attempts/1). Original artifact hashes and filenames are in shortlist.json.


## What was rejected or remains unresolved

- GLM-5.2 GB300 examples with a one-session small-side test and very large published gains were excluded from the shortlist. Same image/date alone does not establish a fair capacity maximum comparison.
- DeepSeek GB300 cross-framework examples with only one large-side load point and extreme negative gains were excluded as weak capacity evidence.
- Requested Kimi K3 16 vs 8+8 and exact MiniMax 2.7 12 vs 4+4+4 were not found in the extracted compatible node-size coverage. No other model version was substituted.
- Physical host placement and isolation were not established by scheduler labels. Original aggregates do verify allocated GPU totals. Four-GPU NVL tray equivalents remain the explicit unit.
- The source aggregates record a dated corpus and entry count, but not a complete immutable corpus revision, random seed, timing-control audit, or submission-validity verdict. The source-verified shortlist is still provisional in these respects.
- MTP is recorded, but the small aggregate alone does not certify speculative-acceptance controls. No model-quality or correctness equivalence is inferred from serving throughput.
- Successful profiling metrics can omit failed requests. Profiling-only error counts are shown separately; they are not all warmup errors and are not subtracted from throughput a second time.

## Error-accounting verification

The pinned producer source independently counts warmup rows and error rows, then drops their union. Therefore profilingErrors = records_dropped_total - records_warmup_dropped, and profilingAttempts = records_total - records_warmup_dropped. Dividing records_error_dropped by total requests would incorrectly include warmup failures. The source code is archived under data/inferencex/audit/request-accounting-<commit>.py; run commit SHAs are in the audit manifest. Code checks all accounting identities before using this derivation.

## Continuation

Use this shortlist for an evidence-labeled exploratory comparison, not a single universal unification multiplier. The next validation step is to obtain full replay metadata and run comparable concurrency sweeps around the latency boundary on both allocations. Start with example 1, which has matching image/router/run and comparable offered load. See ../../docs/HANDOFF.md for project state and commands.

Generated with node scripts/inferencex/shortlist.js. Data: shortlist.json and shortlist.csv. Broad exploratory output remains report.md and comparisons.csv; its earlier provisional records are not silently rewritten by this audit.
