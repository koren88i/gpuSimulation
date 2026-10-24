# InferenceX deployment comparison extraction plan

Status: archived historical design, 2026-09-07. The extraction and reporting pipeline was implemented and executed, but not every original requirement was completed. Archiving does not close those requirements. Active follow-up work is tracked in [INFERENCEX_NEXT_STEPS.md](../INFERENCEX_NEXT_STEPS.md); current behavior is documented in [INFERENCEX_METHOD.md](../INFERENCEX_METHOD.md).

The original design below is preserved for context, including proposed functionality and stricter evidence goals. Its sustainable-capacity wording is not a claim about current results. Its AgentX equation assumes one root session per user; the current configurable formula also divides by rootSessionsPerUser. See [HANDOFF.md](../HANDOFF.md) for current state and reports/inferencex/report.md at the repository root for generated results.

| Original requirement | Disposition at archival |
| --- | --- |
| Archived inputs, normalization, equal-budget pairing, calculations and generated reports | Implemented; current method and limitations remain authoritative |
| Exact workload/topology selection classes | Revised by user decision on 2026-09-07: retain current workload grouping and allow software/topology differences; no stricter subset required. Submitter-chosen settings are accepted as a working assumption, not proven optimal tuning. |
| Explicit throughput/latency frontier | Pending; no explicit computation found in targeted review |
| Strict workload/replay validity and physical allocation evidence | Partially checked; unresolved evidence remains |
| Maximum sustainable capacity | Not established; comparable load sweeps remain unresolved |

Implementation notes: supplementary GB200/GB300 coverage uses four-GPU compute-tray equivalents, separately from eight-GPU servers. Physical host placement is not independently verified. AgentX corpus names were recovered from run-group logs where available, but immutable revision, per-row replay controls and scenario validity remain unverified; those comparisons are explicitly provisional. Fixed-length coding-capacity proxy estimates are disabled by default. API lookup failures and source conflicts are recorded in coverage.json. The original strict-validity goal is not claimed as achieved by provisional records.

## Objective

Find measured deployments of the same model on the same server hardware at different node counts, then compare a larger deployment with enough independent copies of a smaller deployment to use the same hardware budget. Examples: 16 versus 8+8; 12 versus 4+4+4. Report measured throughput/latency, estimated active sessions, and estimated DAU. All normalization, selection, arithmetic, and derived fields must run in code.

## 1. Discover and archive

- Fetch `/api/v1/availability` to discover model keys, hardware, workloads, precision, serving frameworks, and dates.
- Resolve display-model names using the published model mapping. Preserve the original model key and exact checkpoint from provenance when available. Do not equate versions merely because the site groups them together.
- Fetch `/api/v1/benchmarks/history?model=...&isl=...&osl=...` once per display-model/workload combination. Fetch agentic history separately using `benchmarkType=agentic_traces`.
- Omit `view=calculator` to retain full metadata and metrics. Do not require power measurements for general performance research.
- Start discovery with B200 across available models, prioritizing the user's Kimi, DeepSeek, and MiniMax examples. Also inventory B300, H200, and H100 eight-GPU server deployments for additional examples; never mix hardware within a pair. Keep GB200/GB300 rack systems separate because their compute-tray/node units are not interchangeable with eight-GPU servers.
- Archive responses with request URL, retrieval timestamp, content hash, source revision, schema version, and response counts. Cache downloads, retry transient failures with bounded backoff, and deduplicate by benchmark identity while preserving conflicting observations for review.

## 2. Normalize and validate deployment identity

Preserve model/checkpoint, GPU SKU and server type, precision, framework/image, speculative method, workload type and token lengths, concurrency, prefill/decode workers and GPU allocation, parallelism, interconnect/router/cache information when available, dates, recipe fingerprints, row IDs, and source URLs.

- For disaggregated deployments, total allocated GPUs are prefill GPUs plus decode GPUs. Validate physical host placement against recipe or provenance.
- For aggregated deployments, prefill and decode can share the same devices. Do not sum both fields or blindly multiply tensor and expert parallelism.
- Account for pipeline/context parallelism and partial-server workers. GPU count divided by eight is only a server-equivalent count until the physical deployment is verified.
- Quarantine conflicting GPU/host metadata. Existing single-node rows labeled 64 GPUs demonstrate why this is required.
- Decode-normalized output throughput must be multiplied by decode GPUs to recover whole-deployment output throughput for the inspected P/D producer. Validate normalization against the producer revision rather than applying one rule to every historical row.
- Prefer directly measured successful request throughput. Otherwise derive approximate requests/second from total output throughput and the actual mean output token count; nominal OSL is an explicitly flagged fallback.
- Keep missing values null, not zero. Preserve metric definitions and latency percentiles. Distinguish configured maximum request concurrency from observed average in-flight requests.

## 3. Build comparison candidates

- Partition by actual model, server hardware, precision, workload type, and input/output lengths or identical trace dataset.
- Enumerate observed smaller/larger node counts where the larger count is an integer multiple of the smaller count.
- Build `large` versus `k * small` comparisons only when both measured deployment sizes exist. Do not invent missing larger-cluster points.
- Preserve actual topology descriptions: a larger deployment may be P/D-disaggregated or routed workers, not a globally shared KV cache or one model-parallel instance.
- Label evidence quality: matched software/workload; best-observed setups with software/date differences; or insufficient metadata.
- Keep synthetic speculative-acceptance tests separate from normal decoding tests. Surface other material recipe differences.

## 4. Select measured operating points

- Retain every concurrency point and the nondominated throughput/latency frontier.
- Produce a best-observed-throughput view and a latency-qualified capacity view separately.
- In the capacity view, select maximum sustainable request throughput among measured points satisfying the same configured latency limits. Evaluate requested percentiles explicitly; missing p95/p99 does not pass a p95/p99 limit.
- Apply a configurable as-of date, age policy, and comparison-date-gap policy. Record the selection rule and why other rows were excluded.
- Retain distinct software recipes. A best-observed comparison may select different frameworks, but must expose that difference.
- If no point qualifies, report unavailable with a reason. Preserve high-latency observations in the raw-throughput view without calling them usable interactive capacity.
- Do not interpolate in the first implementation. Independent replica scaling is the explicit modeled operation.

## 5. Implement pure calculation functions

Shared configurable profile inputs:

- Mean reading/typing gap between requests, in seconds.
- Requests per daily active user.
- Peak-to-average request-rate ratio, defined over the full 24-hour day.
- Capacity reserve fraction.
- Latency thresholds and percentile policy.
- One outstanding request per user for the initial session model.

For a selected, latency-qualified fixed-sequence benchmark:

```js
usableRps = observedRps * (1 - reserveFraction);
estimatedActiveSessions = usableRps * (meanResponseSeconds + thinkSeconds);
estimatedDau = usableRps * 86400 / (requestsPerUserPerDay * peakToAverageRatio);
```

These estimate demand capacity, not actual user populations. The session formula is an approximate steady-state interactive-user model: mean response time comes from the measured operating point, and reserve is a planning haircut, not a queueing simulation. Do not substitute median response time silently. If mean response time is unavailable, leave the session estimate unavailable or use a separately labeled alternative method.

The formula can count more sessions at a slower acceptable response time. Therefore select points by throughput under latency limits, never by maximizing the derived session number. Always display latency with sessions; DAU and usable requests/sec are the primary capacity measures.

For k independent copies of the same smaller measured deployment:

```js
splitThroughput = k * smallThroughput;
splitConfiguredConcurrency = k * smallConfiguredConcurrency;
splitEstimatedActiveSessions = k * smallEstimatedActiveSessions;
splitEstimatedDau = k * smallEstimatedDau;
gainFraction = largeValue / splitValue - 1;
```

Per-request latency remains that of each small deployment. Do not add latencies or divide them by k. Do not average percentiles to manufacture a pooled latency distribution. Label the split result as projected independent-copy capacity and the larger result as measured. Report negative gains too.

### Preferred coding profile: AgentX

AgentX is the preferred workload for the user's active-coding-session question. Its `conc` means live root session trees, including dependent subagents, rather than HTTP request concurrency. This corrects the earlier single-turn-only interpretation of the field. One root session is a proxy for one active user, not proof of distinct human identities.

Source methodology: https://inferencex.semianalysis.com/about

Default corpus identity: `semianalysis_cc_traces_weka_062126`, as shown in the published AgentX command. Match its actual dataset revision, context variant, replay timing, and submission validity from metadata. If data instead uses another pinned corpus, form a separate comparison group with that identity; do not silently call it the default corpus. A rolling alias without a resolvable revision is insufficient for a strict comparison.

The benchmark preserves recorded inter-turn delays and subagent relationships. Its ten-second globally-idle cap is not a mean human think time and must not be substituted for one. Do not add a separate think-time estimate on top of AgentX replay concurrency.

For latency-qualified, scenario-valid AgentX points, use a session-occupancy conversion:

```js
estimatedActiveSessions = configuredRootSessionConcurrency * (1 - reserveFraction);
estimatedDau = estimatedActiveSessions * 86400 /
  (activeAgentSecondsPerDau * peakToAverageSessionRatio);
```

This is an occupancy-based DAU scenario, not a task-productivity claim. Inspect completed work, errors, and latency alongside session counts. Select the highest qualifying root-session concurrency within each exact workload/topology class, and retain the throughput at that point. Also retain the independently selected maximum-throughput point. These are distinct operating-point objectives and must not be presented as one measurement.

Initial configurable planning assumptions for this profile:

| Parameter | Default | Basis |
| --- | ---: | --- |
| Root sessions per active user | 1 | User-mapping assumption |
| Daily active agent-session time per DAU | 2 hours | Planning assumption; not measured by AgentX |
| Daily activity window | 8 hours | Planning assumption |
| Peak/average concurrency within activity window | 2 | Planning assumption |
| Full-day peak/average session ratio | `(24 / 8) * 2 = 6` | Calculated from the two preceding assumptions |
| Capacity reserve | 20% | Planning assumption |
| p90 first-token latency limit | 10 seconds | Configurable experience target |
| p90 time-per-output-token limit | 100 milliseconds | Configurable experience target |

Preserve all these labels and sources in the exported profile. The workload behavior is sourced from AgentX; user activity, reserve, and acceptable latency are not published user-population measurements. The defaults yield two DAU per reserved active-session slot; code computes this multiplier, and the report exposes it prominently. Sensitivity profiles change daily activity and latency limits consistently on both sides.

Use dedicated adapters for agentic root sessions and fixed-sequence requests. Do not pool their rankings or compare them against each other. Fixed-sequence examples retain throughput/latency and request concurrency; their coding-session/DAU estimates require separately stated proxy assumptions and cannot establish long-context cache behavior. Do not force an AgentX profile onto unrelated fixed-length measurements just to fill every column.

## 6. Deliverables

Proposed implementation uses the existing project's Node.js ES modules, with a standalone CLI and pure calculation modules. Avoid modifying simulator behavior during extraction work.

- Raw JSON snapshots and a provenance manifest.
- Normalized benchmark JSON/CSV.
- Comparison JSON/CSV with both source rows, topology, software/date differences, concurrency, throughput, latency, active-session estimates, DAU estimates, gain percentages, profile version, and evidence status.
- A coverage/exclusion report: models and node counts found, missing requested pairs, model aliases, invalid metadata, missing metrics, and failed latency requirements.
- A readable report generated from calculated comparison records; no manually authored numerical results.
- Profile configuration and a documented command to reproduce results offline from saved snapshots.

Confirmed delivery: JSON/CSV data plus a readable Markdown report. No simulator integration is included in this extraction. All profile values live in a versioned configuration file. The report is generated from computed records, with sources and limitations assembled from structured evidence flags.

## 6a. Implementation sequence

1. Create the standalone fetch CLI, immutable snapshot manifest, and versioned profile configuration.
2. Implement row normalization and topology checks; exercise them against saved DeepSeek fixtures before processing all models.
3. Fetch full histories and discover AgentX dataset/validity provenance through the documented diagnostic endpoints and linked run artifacts as necessary.
4. Implement separate AgentX and single-turn adapters, point-selection policies, and independent-copy comparison functions.
5. Generate all available equal-budget pairs, the machine-readable outputs, and the report. Add a coverage table for the user's specific examples even when a requested pair is absent.
6. Run formula/provenance tests and reproduce outputs offline from the same snapshots.

Proposed files: `scripts/inferencex/fetch.js`, `scripts/inferencex/normalize.js`, `scripts/inferencex/capacity.js`, `scripts/inferencex/compare.js`, `scripts/inferencex/report.js`, `data/inferencex/profiles/agentx-coding-v1.json`, `data/inferencex/raw/`, and `reports/inferencex/`.

## 7. Verification and acceptance

- Test GPU accounting for shared-device aggregated runs, P/D runs, partial-node workers, and known conflicting metadata.
- Test historical metric normalization, missing values, model-version separation, and deterministic point selection.
- Test split scaling, session/DAU formulas, invalid profile inputs, zero denominators, and positive/negative comparison gains.
- Use the verified DeepSeek four-server and eight-server rows as a regression fixture: output throughput 29,024.4765083187304 and 69,208.076659557984 tokens/sec, with a two-copy baseline and approximately 19.2236% throughput gain. Preserve the software/date mismatch flag.
- Verify each comparison uses equal hardware budgets, compatible workloads, and the same profile; each number traces to code, source data, and units.
- Re-running against identical snapshots and configuration must reproduce the same results.

API reference: https://inferencex.semianalysis.com/api
