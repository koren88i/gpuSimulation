# InferenceX: larger deployments versus independent smaller deployments

Generated entirely by scripts/inferencex/report.js from archived API responses. Profile: **agentx-coding-v1**. The CSV/JSON files contain every comparison; tables below show a spread of models/hardware, not a claim of universal scaling behavior.

For the separately reviewed source-artifact shortlist, see [shortlist.md](shortlist.md). It verifies selected points more deeply without upgrading the broad exploratory records below to validated capacity claims.

## What was found

- 53,003 unique benchmark rows in scope, from 32 full-history queries.
- 16,028 rows passed allocated-node consistency checks; 933 agentic rows were inspected.
- 318 comparison records across operating-point policies; 64 are AgentX records. These counts are not unique model/size pairs.
- Download errors: 0. Provenance lookup errors: 8. Conflicting duplicate IDs excluded: 9.

## Interpretation and units

Large deployments are measured. Split deployments multiply a measured smaller deployment's throughput/concurrency/capacity by an integer copy count; this assumes independent copies sustain their measured load. Per-request latency is unchanged. Larger deployments are described by their actual P/D allocation and serving stack, not assumed to have one globally shared KV cache.

B200/B300/H200/H100 use **eight-GPU server equivalents**. Supplemental GB200/GB300 results use **four-GPU NVL compute-tray equivalents**. We validate allocated GPU arithmetic, worker divisibility, and available throughput/power cross-checks, but exact physical host placement is not independently verified. These are allocation comparisons, not proof that all hosts belong to one scheduling or KV-sharing domain. [NVIDIA NVL hardware](https://docs.nvidia.com/enterprise-reference-architectures/nvl72-ai-factory/latest/components.html)

Do not interpret GB compute trays as eight-GPU B200 servers. All pairs use the same hardware, raw model key, precision, workload type/length and speculative method. Different software/date/offload/topology settings are flagged in comparisons.csv. Best-observed results can be old; dates are retained. No causal claim about unification alone is made.

**Best observed is not proven optimal.** Some allocation recipes were tested at only one or two concurrency settings. Large gains can reflect an undersampled smaller setup. Both sides' observed concurrency sweeps are exported, and sparse sweeps are flagged. Summary examples prefer fewer independent copies and then larger smaller-deployment sizes, rather than selecting the biggest gains. Full-history selection as of 2026-09-05 uses no maximum age and no maximum date gap (days).

## AgentX coding sessions and DAU

AgentX concurrency is live root session trees, including subagent fan-out and recorded pauses. We assume one tree per active user. Dataset names are recovered from representative logs in the same run/configuration group. **Submission validity, immutable corpus revision, and exact per-row replay controls remain unverified in these public summary records; AgentX comparisons and capacity estimates are provisional.** They must not be used as verified production capacity. [AgentX methodology](https://inferencex.semianalysis.com/about)

The shared profile uses 2 active agent-hours per DAU, a 8-hour activity window, 2× peak/average within that window, and 20% reserve. These human-usage and reserve values are **planning assumptions**, not claims about measured developers. The full-day peak ratio is 6. Code computes active sessions = configured root concurrency × (1 − reserve) / sessions per user, and DAU = active sessions × 24 / (active hours per DAU × full-day peak ratio).

Latency limits: p90_ttft ≤ 10 seconds; p90_tpot ≤ 0.1 seconds. Missing required percentiles fail qualification. Reserve is a capacity haircut, not a prediction of new latency at a lower load. Session estimates represent occupancy capacity, not completed coding tasks per day.

### Coding-session comparisons at the same latency limits

Each side selects its highest qualifying measured root-session concurrency within the same dataset/model/hardware group. Output throughput shown belongs to that selected point; it is not separately maximized. Negative gains are retained.

Model / hardware / precision | Workload | Unit | Large vs split | Large / split output tok/s | Throughput gain | Large / split active sessions | Large / split DAU | Source rows
--- | --- | --- | --- | --- | --- | --- | --- | ---
dsv4 / gb200 / fp4 | AgentX (mtp) | 4-GPU trays | 8 vs 4+4 | 15,698.68 / 14,978.2 | 4.81% | 409.6 / 409.6 | 819.2 / 819.2 | [439975](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/31965016666/attempts/2) / [439969](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/31965016666/attempts/2)
dsv4 / gb300 / fp4 | AgentX (mtp) | 4-GPU trays | 9 vs 3+3+3 | 174.41 / 922.52 | -81.09% | 3.2 / 19.2 | 6.4 / 38.4 | [440971](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/33548589856/attempts/1) / [439312](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/31242829669/attempts/3)
glm5.2 / gb300 / fp4 | AgentX (mtp) | 4-GPU trays | 9 vs 3+3+3 | 5,696.95 / 388.67 | 1,365.76% | 121.6 / 2.4 | 243.2 / 4.8 | [440966](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/33716849615/attempts/3) / [440965](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/33716849615/attempts/3)
kimik3 / gb300 / fp4 | AgentX (mtp) | 4-GPU trays | 6 vs 2+2+2 | 1,156.74 / 578.82 | 99.84% | 25.6 / 9.6 | 51.2 / 19.2 | [441058](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/33701025625/attempts/3) / [441056](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/33701025625/attempts/3)
glm5.2 / gb200 / fp4 | AgentX (mtp) | 4-GPU trays | 8 vs 2+2+2+2 | 1,822.76 / 2,269.85 | -19.7% | 36 / 51.2 | 72 / 102.4 | [440078](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/32207758126/attempts/2) / [439949](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/31958517356/attempts/1)

## Fixed-length throughput comparisons

These retain the original requested arithmetic: larger measured throughput versus k times smaller measured throughput. They do **not** measure multi-turn coding sessions. The coding-session/DAU fields are blank by default; enabling the separately labeled fixedSequenceProxy configuration gives hypothetical single-request user estimates, not an AgentX-derived coding capacity claim.

### Best observed throughput, without a latency ceiling

Model / hardware / precision | Workload | Unit | Large vs split | Large / split output tok/s | Throughput gain | Large / split active sessions | Large / split DAU | Source rows
--- | --- | --- | --- | --- | --- | --- | --- | ---
glm5 / gb300 / fp4 | 1024/1024 | 4-GPU trays | 18 vs 9+9 | 23,003.74 / 103,808.9 | -77.84% | — / — | — / — | [416560](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/26605445495/attempts/2) / [416570](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/26605445495/attempts/2)
dsv4 / gb300 / fp4 | 8192/1024 | 4-GPU trays | 18 vs 9+9 | 109,723.46 / 64,370.72 | 70.46% | — / — | — / — | [438832](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/31024844958/attempts/2) / [424186](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/27164980476/attempts/14)
dsr1 / gb300 / fp8 | 8192/1024 | 4-GPU trays | 18 vs 9+9 | 68,614.33 / 75,868.41 | -9.56% | — / — | — / — | [94141](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/21831958748/attempts/2) / [426091](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/27595478969/attempts/1)
glm5.1 / gb200 / fp4 | 8192/1024 | 4-GPU trays | 18 vs 9+9 | 52,680.74 / 10,648.2 | 394.74% | — / — | — / — | [433845](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/28828457171/attempts/3) / [433842](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/28828457171/attempts/3)
dsr1 / gb200 / fp4 | 8192/1024 | 4-GPU trays | 18 vs 9+9 | 54,262.68 / 12,307 | 340.91% | — / — | — / — | [92402](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/20413316138/attempts/1) / [96327](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/23438524239/attempts/5)
kimik2.5 / gb300 / fp4 | 8192/1024 | 4-GPU trays | 16 vs 8+8 | 92,914.27 / 45,875.26 | 102.54% | — / — | — / — | [426856](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/27663808752/attempts/2) / [426571](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/27848011161/attempts/2)
kimik2.5 / gb200 / fp4 | 8192/1024 | 4-GPU trays | 14 vs 7+7 | 58,953.5 / 88,326.06 | -33.25% | — / — | — / — | [426509](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/27591355916/attempts/6) / [200496](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/24610706849/attempts/3)
glm5 / gb200 / fp4 | 8192/1024 | 4-GPU trays | 12 vs 6+6 | 23,170.17 / 8,541.96 | 171.25% | — / — | — / — | [435544](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/29287890247/attempts/4) / [435530](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/29287890247/attempts/4)
dsv4 / gb200 / fp4 | 8192/1024 | 4-GPU trays | 12 vs 6+6 | 43,968.76 / 45,178.83 | -2.68% | — / — | — / — | [420957](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/27404532035/attempts/1) / [438056](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/30118489668/attempts/1)
glm5 / b200 / fp8 | 8192/1024 | 8-GPU servers | 8 vs 4+4 | 2,671.62 / 9,087.58 | -70.6% | — / — | — / — | [413622](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/26067557908/attempts/3) / [413630](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/26067557908/attempts/3)
dsv4 / b200 / fp4 | 8192/1024 | 8-GPU servers | 8 vs 4+4 | 69,208.08 / 58,189.25 | 18.94% | — / — | — / — | [440856](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/33447526958/attempts/1) / [428446](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/28078051095/attempts/3)
dsr1 / h200 / fp8 | 8192/1024 | 8-GPU servers | 8 vs 4+4 | 13,770.18 / 15,747.35 | -12.56% | — / — | — / — | [96518](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/23438524239/attempts/5) / [94822](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/22013103756/attempts/1)
minimaxm3 / gb200 / fp8 | 8192/1024 | 4-GPU trays | 6 vs 3+3 | 22,166.77 / 1,229.49 | 1,702.93% | — / — | — / — | [430300](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/28205303704/attempts/3) / [437729](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/30208358162/attempts/1)
dsr1 / b200 / fp8 | 8192/1024 | 8-GPU servers | 4 vs 2+2 | 15,043.58 / 13,125.38 | 14.61% | — / — | — / — | [96189](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/23266829671/attempts/2) / [94355](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/21895676503/attempts/1)
dsv4 / b300 / fp4 | 8192/1024 | 8-GPU servers | 2 vs 1+1 | 10,332.22 / 3,191.86 | 223.7% | — / — | — / — | [430359](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/28380189316/attempts/3) / [201910](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/24920699270/attempts/3)
qwen3.5 / gb200 / fp8 | 1024/1024 | 4-GPU trays | 6 vs 2+2+2 | 96,891.86 / 12,200.29 | 694.18% | — / — | — / — | [426936](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/27653706015/attempts/1) / [426927](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/27653706015/attempts/1)
qwen3.5 / gb300 / fp8 | 1024/1024 | 4-GPU trays | 6 vs 2+2+2 | 108,451.86 / 13,204.21 | 721.34% | — / — | — / — | [434941](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/29207681289/attempts/2) / [434928](https://github.com/SemiAnalysisAI/InferenceX/actions/runs/29207681289/attempts/2)

### Throughput under the default latency limits

No qualifying pairs.

### Latency, concurrency, and differences for the displayed examples

Rows large / small | Configured concurrency large / split | p90 TTFT seconds large / small | p90 TPOT seconds large / small | Software large / small | Dates large / small | Flags
--- | --- | --- | --- | --- | --- | ---
439975 / 439969 | 512 / 512 | 6.11 / 5.7 | 0.01815 / 0.01783 | dynamo-vllm / dynamo-vllm | 2026-08-18 / 2026-08-18 | split_capacity_projected, physical_hosts_not_independently_verified, sparse_smaller_configuration_concurrency_sweep, sparse_larger_configuration_concurrency_sweep, agentic_scenario_validity_unverified, dataset_revision_replay_controls_unverified, speculative_acceptance_provenance_not_verified
440971 / 439312 | 4 / 24 | 2.49 / 7.3 | 0.00581 / 0.00846 | dynamo-trt / dynamo-sglang | 2026-09-03 / 2026-08-09 | split_capacity_projected, physical_hosts_not_independently_verified, sparse_smaller_configuration_concurrency_sweep, sparse_larger_configuration_concurrency_sweep, agentic_scenario_validity_unverified, dataset_revision_replay_controls_unverified, software_differs, dates_differ, total_concurrency_differs, speculative_acceptance_provenance_not_verified
440966 / 440965 | 152 / 3 | 5.54 / 3.31 | 0.00856 / 0.0034 | dynamo-trt / dynamo-trt | 2026-09-03 / 2026-09-03 | split_capacity_projected, physical_hosts_not_independently_verified, sparse_smaller_configuration_concurrency_sweep, sparse_larger_configuration_concurrency_sweep, agentic_scenario_validity_unverified, dataset_revision_replay_controls_unverified, total_concurrency_differs, speculative_acceptance_provenance_not_verified
441058 / 441056 | 32 / 12 | 6.46 / 3.86 | 0.00955 / 0.00516 | dynamo-vllm / dynamo-vllm | 2026-09-04 / 2026-09-04 | split_capacity_projected, physical_hosts_not_independently_verified, sparse_smaller_configuration_concurrency_sweep, agentic_scenario_validity_unverified, dataset_revision_replay_controls_unverified, total_concurrency_differs, speculative_acceptance_provenance_not_verified, aggregated_vs_disaggregated
440078 / 439949 | 45 / 64 | 6.77 / 9.56 | 0.0052 / 0.01338 | dynamo-sglang / dynamo-sglang | 2026-08-19 / 2026-08-16 | split_capacity_projected, physical_hosts_not_independently_verified, sparse_larger_configuration_concurrency_sweep, agentic_scenario_validity_unverified, dataset_revision_replay_controls_unverified, software_differs, dates_differ, total_concurrency_differs, speculative_acceptance_provenance_not_verified, aggregated_vs_disaggregated
416560 / 416570 | 512 / 5000 | — / — | missing / missing | dynamo-sglang / dynamo-sglang | 2026-05-29 / 2026-05-29 | split_capacity_projected, physical_hosts_not_independently_verified, total_concurrency_differs
438832 / 424186 | 12000 / 2458 | — / — | missing / missing | dynamo-sglang / dynamo-trt | 2026-08-07 / 2026-06-15 | split_capacity_projected, physical_hosts_not_independently_verified, sparse_smaller_configuration_concurrency_sweep, sparse_larger_configuration_concurrency_sweep, software_differs, dates_differ, total_concurrency_differs
94141 / 426091 | 4096 / 4302 | — / — | missing / missing | dynamo-sglang / dynamo-trt | 2026-02-09 / 2026-06-17 | split_capacity_projected, physical_hosts_not_independently_verified, sparse_smaller_configuration_concurrency_sweep, sparse_larger_configuration_concurrency_sweep, software_differs, dates_differ, total_concurrency_differs
433845 / 433842 | 2674 / 260 | — / — | missing / missing | dynamo-sglang / dynamo-sglang | 2026-07-08 / 2026-07-08 | split_capacity_projected, physical_hosts_not_independently_verified, sparse_smaller_configuration_concurrency_sweep, sparse_larger_configuration_concurrency_sweep, total_concurrency_differs
92402 / 96327 | 8192 / 152 | — / — | missing / missing | dynamo-sglang / dynamo-trt | 2025-12-21 / 2026-03-23 | split_capacity_projected, physical_hosts_not_independently_verified, software_differs, dates_differ, total_concurrency_differs
426856 / 426571 | 2151 / 4096 | — / — | missing / missing | dynamo-trt / dynamo-vllm | 2026-06-22 / 2026-06-20 | split_capacity_projected, physical_hosts_not_independently_verified, sparse_smaller_configuration_concurrency_sweep, sparse_larger_configuration_concurrency_sweep, software_differs, dates_differ, total_concurrency_differs
426509 / 200496 | 1229 / 4302 | — / — | missing / missing | dynamo-trt / dynamo-trt | 2026-06-20 / 2026-04-18 | split_capacity_projected, physical_hosts_not_independently_verified, sparse_smaller_configuration_concurrency_sweep, sparse_larger_configuration_concurrency_sweep, software_differs, dates_differ, total_concurrency_differs
435544 / 435530 | 615 / 210 | — / — | missing / missing | dynamo-trt / dynamo-trt | 2026-07-15 / 2026-07-15 | split_capacity_projected, physical_hosts_not_independently_verified, sparse_larger_configuration_concurrency_sweep, total_concurrency_differs
420957 / 438056 | 4096 / 8192 | — / — | missing / missing | dynamo-sglang / dynamo-vllm | 2026-06-12 / 2026-07-30 | split_capacity_projected, physical_hosts_not_independently_verified, sparse_smaller_configuration_concurrency_sweep, sparse_larger_configuration_concurrency_sweep, software_differs, dates_differ, total_concurrency_differs
413622 / 413630 | 64 / 512 | — / — | missing / missing | dynamo-sglang / dynamo-sglang | 2026-05-18 / 2026-05-18 | split_capacity_projected, physical_hosts_not_independently_verified, sparse_smaller_configuration_concurrency_sweep, sparse_larger_configuration_concurrency_sweep, total_concurrency_differs
440856 / 428446 | 8192 / 24690 | — / — | missing / missing | dynamo-sglang / dynamo-vllm | 2026-09-01 / 2026-06-25 | split_capacity_projected, physical_hosts_not_independently_verified, sparse_smaller_configuration_concurrency_sweep, sparse_larger_configuration_concurrency_sweep, software_differs, dates_differ, total_concurrency_differs
96518 / 94822 | 768 / 1024 | — / — | missing / missing | dynamo-trt / dynamo-trt | 2026-03-23 / 2026-02-14 | split_capacity_projected, physical_hosts_not_independently_verified, sparse_smaller_configuration_concurrency_sweep, sparse_larger_configuration_concurrency_sweep, dates_differ, total_concurrency_differs
430300 / 437729 | 1024 / 8 | — / — | missing / missing | dynamo-vllm / dynamo-vllm | 2026-06-29 / 2026-07-29 | split_capacity_projected, physical_hosts_not_independently_verified, sparse_smaller_configuration_concurrency_sweep, sparse_larger_configuration_concurrency_sweep, software_differs, dates_differ, total_concurrency_differs
96189 / 94355 | 1024 / 512 | — / — | missing / missing | dynamo-sglang / dynamo-trt | 2026-03-18 / 2026-02-11 | split_capacity_projected, physical_hosts_not_independently_verified, sparse_smaller_configuration_concurrency_sweep, sparse_larger_configuration_concurrency_sweep, software_differs, dates_differ, total_concurrency_differs
430359 / 201910 | 1024 / 256 | — / 4.63 | missing / 0.07921351461353175 | dynamo-vllm / vllm | 2026-06-29 / 2026-04-25 | split_capacity_projected, physical_hosts_not_independently_verified, sparse_smaller_configuration_concurrency_sweep, sparse_larger_configuration_concurrency_sweep, software_differs, dates_differ, total_concurrency_differs, aggregated_vs_disaggregated
426936 / 426927 | 4096 / 192 | — / — | missing / missing | dynamo-sglang / dynamo-sglang | 2026-06-22 / 2026-06-22 | split_capacity_projected, physical_hosts_not_independently_verified, sparse_larger_configuration_concurrency_sweep, total_concurrency_differs
434941 / 434928 | 4096 / 192 | — / — | missing / missing | dynamo-sglang / dynamo-sglang | 2026-07-13 / 2026-07-13 | split_capacity_projected, physical_hosts_not_independently_verified, sparse_larger_configuration_concurrency_sweep, total_concurrency_differs

## Requested example coverage

- **kimik3: 16 vs 8+8**: 0 comparison records. Observed eligible allocation sizes: b200 agentic_traces [2]; b300 agentic_traces [1]; gb200 agentic_traces [1, 4]; gb300 agentic_traces [2, 4, 6, 8]; h200 agentic_traces [4].
- **minimaxm2.7: 12 vs 4+4+4**: 0 comparison records. Observed eligible allocation sizes: no rows for this exact model key.
- **dsv4: 8 vs 4+4**: 9 comparison records. Observed eligible allocation sizes: b200 agentic_traces [1]; b200 single_turn [1, 2, 3, 4, 5, 6, 7, 8]; b300 agentic_traces [1]; b300 single_turn [1, 2, 3]; gb200 agentic_traces [2, 4, 6, 7, 8]; gb200 single_turn [2, 4, 6, 8, 10, 12, 14, 15, 16, 18]; gb300 agentic_traces [1, 3, 5, 6, 7, 8, 9, 10, 12, 14, 16]; gb300 single_turn [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18]; h200 agentic_traces [1]; h200 single_turn [1].

Kimi 2.5/2.6/2.7-Code and MiniMax 2.5/2.7 remain different model keys even when the site groups them under one display model. Missing requested pairs are not substituted with a different version.

## DeepSeek regression example

Rows 428445 and 440856: doubled smaller throughput 58,048.95 output tok/s; larger throughput 69,208.08; gain 19.22%. This reproduces the earlier arithmetic and preserves its software/date mismatch. It is not necessarily the best point selected by the full-history search.

## Exclusions and audit

Reason | Rows (reasons may overlap)
--- | ---
partial_node_allocation | 27,228
partial_or_unknown_worker_placement | 7,816
single_node_label_conflicts_with_gpu_count | 6,348
throughput_gpu_denominator_conflict | 163
power_gpu_count_conflict | 89

Raw API sources, source hashes, row IDs, dates, configuration flags, profile hash and code hashes are retained in the JSON outputs and reproducibility.json. GPU count conflicts are quarantined, not silently corrected. Missing throughput is not zero. Speculative rows are exported but their synthetic-acceptance provenance is unverified; summary fixed-length tables above use no speculative decoding.

## Files and reproduction

- comparisons.csv / comparisons.json: every pair, metrics, flags and source links.
- benchmarks.csv / benchmarks.json: every normalized point, including exclusions and provisional per-point capacities.
- coverage.csv / coverage.json: discovered allocation sizes, exclusion counts, requested examples.
- profile.json: effective editable assumptions.
- reproducibility.json: snapshot and code hashes.

From the repository root, run `node scripts/inferencex/fetch.js`, then `node scripts/inferencex/provenance.js`, then `node scripts/inferencex/report.js`. Fetches use cached content-addressed snapshots unless --refresh is provided to fetch.js. Report generation is offline. Use `node scripts/inferencex/report.js --profile path/to/profile.json` to change assumptions identically on both sides. Run `node --test tests/inferencex.test.js` for validation.

API reference: https://inferencex.semianalysis.com/api
