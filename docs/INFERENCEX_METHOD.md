# InferenceX research method

## Data and identity

Availability discovers actual raw model keys and workload combinations. `/api/v1/benchmarks/history` returns dated rows by display model and workload. A display model can contain multiple actual versions; preserve the raw key. Full histories are cached by content hash with URL/retrieval metadata. Duplicate IDs with conflicting payloads are quarantined, not overwritten.

Primary reference: https://inferencex.semianalysis.com/api

Aggregated runs can use the same devices for prefill and decode. Disaggregated runs allocate distinct pools. Historical API records can incorrectly label 8-GPU runs as 64 GPUs through TP/EP multiplication. Throughput totals, power totals, source parallelism and original GPU allocation must be checked before treating a row as a larger deployment. The broad pipeline excludes conflicting rows; the shortlist also checks original aggregates.

B200/B300/H200/H100 comparisons use eight-GPU server equivalents. GB200/GB300 comparisons use four-GPU NVL compute-tray equivalents. Physical placement/isolation is a separate evidence question. Never compare a GB tray count with a B200 server count as if they were the same unit.

## Throughput units

Prefer the direct whole-deployment `output_tput_tps` field. In inspected fixed-sequence P/D producers, output throughput per GPU is normalized by **decode GPUs**. In AgentX aggregates, throughput is normalized by **total GPUs**. Recover the total using the correct denominator and preserve which normalization method was used. Code and source revisions are authoritative; do not assume a future producer retains the same convention.

## Comparison selection

Partition by actual model, hardware, precision, speculative method and exact fixed workload lengths or agentic corpus identity. Compare observed integer-multiple allocation sizes with equal total GPU budgets. Keep software, date, router, topology, offload and sweep differences visible.

Accepted scope (2026-09-07): stricter software/topology matching and an additional matched subset are not required. The user accepts each deployment's configuration as the benchmark submitter's best chosen setup for that deployment. This is a working assumption, not independently verified optimal tuning. Compare the selected measured deployment options under the existing grouping and policy rules; configuration differences remain visible and do not disqualify a pair by themselves. This decision does not resolve missing allocation/workload evidence or establish capacity maxima.

The broad report has best-throughput, latency-qualified-throughput and AgentX latency-qualified-session selection policies. A selected point is the best **observed** point under its policy, not proof of exhaustive tuning. There is no interpolation. Different policies can select different points; never combine the best throughput from one point with the best sessions from another.

Split throughput and estimated capacity equal k times the smaller point. Split configured concurrency equals k times smaller configured concurrency. Per-request latency remains the smaller point's latency; percentiles cannot be averaged into a new pooled distribution. Negative gains are valid findings.

All available integer-multiple size pairs are generated within each compatible group and policy, including one-unit baselines. Equal budget means equal GPU count, not cost. A measured simultaneous fleet of smaller copies is not required. The displayed split value already includes the multiplier; applying it again double-counts replication.

The 318 records are policy-specific comparisons, not independent experiments. The 15 qualified AgentX session records meet workload/allocation/latency eligibility; that does not establish saturation or comparable tuning. The five examples are an editorial subset, not an additional eligibility gate. The UI exposes all 15 by default and all 318 through its broad collection.

## Sessions and DAU

AgentX `conc` is live root session trees, with recorded delays and subagent fan-out. It is not HTTP request concurrency. One root tree per human is a mapping assumption. Fixed-sequence `conc` instead describes maximum in-flight requests. Do not attach AgentX session labels to it.

Default parameters live in `data/inferencex/profiles/agentx-coding-v1.json`. The dated AgentX corpus supplies workload behavior. Two active agent-hours per DAU, eight-hour daily activity window, 2x within-window peak ratio, 20% reserve and latency thresholds are planning assumptions, not observed human-population measurements.

```text
full_day_peak_ratio = (24 / activity_window_hours) * within_window_peak_ratio
active_sessions = root_concurrency * (1 - reserve) / root_sessions_per_user
DAU = active_sessions * 24 / (active_agent_hours_per_DAU * full_day_peak_ratio)
gain_percent = 100 * (large / (copies * small) - 1)
```

Latencies must meet the same configured thresholds. Missing required percentiles do not pass. Reserve scales capacity, not the observed latency. The occupancy-based DAU estimate is not a count of completed coding tasks or a prediction of actual adoption.

A fixed-sequence one-outstanding-request proxy exists but is disabled by default. Its think-time/request-per-day assumptions are hypothetical and not an AgentX-derived profile. Mean response time is required for that formula; do not silently replace it with a median.

## Source audit and error accounting

The shortlist matches exact API point metrics to small original `bmk_agentic_*` GitHub artifacts. The original artifact fixes model checkpoint, corpus loader/split/entry count, image, router, request accounting and allocated GPU totals. Run SHAs and archive hashes are stored in `data/inferencex/audit/manifest.json` and `shortlist.json`.

The producer counts warmup and errors independently, then drops their union. Consequently:

```text
profiling_errors = records_dropped_total - records_warmup_dropped
profiling_attempts = records_total - records_warmup_dropped
profiling_error_rate = profiling_errors / profiling_attempts
```

The implementation checks that profiled successes plus profiling errors equals attempts. `records_error_dropped` alone includes warmup failures. These are accounting-derived rates for the recorded benchmark, not a blanket production reliability guarantee. Throughput already reflects the producer's successful profiling records; do not subtract failures again.

## Evidence labels

The expanded audit (`verify-qualified.js`) checked all 18 unique points behind the 15 qualified pairs: 17 points and 11 pairs verified, four pairs incomplete through shared point 439339. That aggregate matches performance but omits explicit GPU totals. Missing evidence is kept distinct from a confirmed mismatch. Original source images normalize the Enroot registry separator `#` to `/`, following upstream ingestion. Results and reasons are recorded in `qualified-audit.json`; the original five-example audit remains separate.

The expanded verifier checks source identity, output throughput, p90 TTFT/TPOT, explicit allocation totals, recorded corpus loader and profiling-error accounting. Pair checks compare checkpoint, recorded corpus metadata and scaled GPU totals. This does not constitute a full replay-control or immutable-corpus audit.

- **Exploratory/provisional:** broad API comparison; workload or validity metadata incomplete.
- **Source-aggregate verified:** selected API metrics/configuration match original aggregate. This does not certify replay compliance or physical placement.
- **Capacity maximum unproven:** insufficient concurrency sweep around the latency boundary. Applies to the current shortlist.
- **Production-capacity validated:** not achieved by current work; never imply this status from matching images or small profiling error rates.

Source methodology: https://inferencex.semianalysis.com/about
