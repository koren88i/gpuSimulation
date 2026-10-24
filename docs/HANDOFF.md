# Session handoff

Last updated: 2026-09-07. Read this first, then REPORT_UI.md for UI work and INFERENCEX_METHOD.md for calculations. WORK_LOG.md records history; this document describes current state.

## Objective and accepted decisions

Deliver reproducible data, reports and an interactive report UI comparing a measured larger model deployment with an integer multiple of one measured smaller deployment. Generate every compatible integer-multiple pairing, including 1×2 vs 2, 1×8 vs 8 and 2×3 vs 6. Equal GPU budget means equal GPU counts of the same hardware, not equal cost. The split baseline multiplies a single smaller measured result; a benchmark of simultaneous copies is not required. Per-request latency is never multiplied.

The UI is at /report/; the original simulator remains at /. Its calculations remain separate. All numerical results must come from code. Preserve negative gains and exact model versions.

User decision (2026-09-07): no stricter software/topology matching or additional matched subset is needed. Accept each deployment's settings as its submitter's best chosen setup, as a working assumption rather than independently proven optimal tuning. Keep current grouping, equal GPU budgets, shared profiles and visible difference flags. Allocation/workload evidence and capacity-maxima limitations remain separate.

## Snapshot and source audit

- 53,003 in-scope measurements; 318 policy-specific comparison records; 64 AgentX records; 15 latency-qualified AgentX session comparisons. These are different units, not a percentage-conversion funnel or counts of independent experiments.
- Policies select best observed throughput, latency-qualified throughput or latency-qualified configured sessions. They can select different points for the same size pair. Qualified does not mean comparable tuning, saturation or proven maximum capacity.
- Five illustrative editorial examples remain in reports/inferencex/shortlist.*. They are not the only eligible or source-verified comparisons.
- All 15 qualified pairs, using 18 unique points, were source-checked from 107 aggregate artifacts across 11 runs with zero download errors. Result: 17 points and 11 pairs verified; one point and four pairs incomplete; no confirmed mismatches. See reports/inferencex/qualified-audit.json and .md.
- Four incomplete pairs share DeepSeek V4 Pro GB300 point 439339. Its identity and performance match, but the original aggregate omits explicit GPU totals. Missing evidence is not a mismatch. Do not certify allocation by assuming TP×EP. Source: data/inferencex/audit/artifact-9030893014.json.
- Original shortlist manifest: data/inferencex/audit/manifest.json. Expanded manifest: manifest-qualified.json in the same directory. Preserve both. Image registry separator normalization (# to /) follows upstream benchmark-mapper.ts.
- Nine conflicting IDs and eight failed source-log lookups belong to the earlier broad extraction, separately from the successful expanded aggregate downloads.

## Current UI

- Default collection: five illustrative audited examples. Also selectable: all 15 qualified session comparisons and all 318 records.
- A collapsed “What is this page?” explainer at the top describes the equal-budget comparison process, scaled split baseline, rationale for the five default examples and the main interpretation limits in plain language.
- Collection changes reset model/hardware/policy. The all-records collection starts with All operating points, fixing the bug where the old session-only filter still showed 15.
- The hardware menu always exposes the full six-hardware inventory. Selecting hardware unavailable in the five-example or 15-qualified collection automatically switches to all 318 records while preserving the hardware choice.
- Sessions, DAU and throughput views; allocations, dates, latency, configuration, source evidence; CSV/JSON downloads and shareable point/profile links.
- AgentX links beneath source links open https://inferencex.semianalysis.com/inference/agentic/<pointId> in a new tab for agentic points only. These open recorded telemetry, not new benchmark executions.
- Shared usage inputs have expandable parameter help and default rationale. The full equation explanation starts collapsed and includes code-generated worked substitutions.
- The collapsed selection-history section shows stage counts, shortlist rationales, every qualified candidate with direct navigation, audit outcomes, overlapping exclusion flags and missing requested coverage.
- Split cards explicitly show per-copy value × copies = combined total. The gain equation uses that total once. Gains are labeled differences at selected tested loads. Visible remarks identify sparse sweeps and software differences.
- Source verification and editorial shortlist selection are separate concepts. Neither establishes a maximum-capacity advantage.

## Numerical interpretation to preserve

AgentX supplies recorded workload behavior, pauses and subagents. Numeric user defaults are illustrative planning assumptions, not measured human averages: one root session per user, 20% reserve, two active session-hours per DAU, eight-hour activity window and 2× within-window peak. Fixed-length coding estimates are disabled.

S = C × (1 − reserve) / rootsPerUser.
DAU = S × windowHours / (activeHours × peakRatio).

The browser and reports share scripts/inferencex/capacity.js. Usage controls scale estimates at frozen selected points; they do not reselect measurements or change latency. GB200/GB300 units are four-GPU tray equivalents; B200/B300/H200/H100 units are eight-GPU server equivalents. Physical host placement is not independently verified.

Recent interpretation checks:

- DeepSeek GB200 8 vs 4+4: 512 vs 2×256 configured sessions yields equal users and about 4.8% more throughput. Both sides already separate prefill/decode. Maximum capacity is unknown.
- DeepSeek GB300 9 vs 3+3+3 and 3 vs 1+1+1: 4/(8×3) and 8/(16×3) both yield −83.3%. Sparse sweeps/software changes make these weak evidence of the isolated unification effect.
- GLM-5.2 GB300 12 vs six copies of 2: smaller 4×0.8 = 3.2 per copy; ×6 = 19.2 combined. Larger 259×0.8 = 207.2. Gain +979.2%. Do not multiply 19.2 by six again. The extreme percentage is not proof of maximum capacity.
- GLM-5.2 GB200 8 vs four copies of 2 favors split at tested loads but larger has faster latency. Preserve both facts.

## Unified-versus-split synthesis

`scripts/inferencex/analyze-scaling.js` generates `reports/inferencex/scaling-analysis.{json,md}` and `scaling-agentx.csv` from the frozen comparison and qualified-audit outputs. It reports pair-level distributions, one-median-per-workload-family sensitivity, no-speculation and two-way-split views, sweep-coverage sensitivity, model variation and every qualified AgentX pair.

The supported rule is conditional rather than universal. The broad best-observed fixed-length data leans unified, but the magnitude is highly model-dependent and the direction is not stable in the small subset with broader sweeps on both sides. Qualified AgentX points also lean unified in count, while every pair remains sparse on at least one side. The closest controlled DeepSeek GB200 comparison shows linear session scaling and only a small throughput edge for the larger allocation. Use split as the linear baseline and require a repeatable, latency-qualified advantage from comparable boundary sweeps before budgeting a unified premium. Source verification does not establish capacity maxima.

## Continue locally

Run from the repository root:

```powershell
node scripts/inferencex/verify-qualified.js
node scripts/inferencex/analyze-scaling.js
node scripts/inferencex/export-ui.js
node --test tests/inferencex.test.js tests/qualified-audit.test.js tests/report.test.js tests/scaling-analysis.test.js
npm.cmd run check
npm.cmd run build
# Start only if the preview is not already running:
python -m http.server 4173 --bind 127.0.0.1
```

Open http://127.0.0.1:4173/report/ . Do not assume the old preview process survives a session. Uncached source audit: python scripts/inferencex/audit_sources.py --all-qualified (requires authenticated gh). Refreshing the API can invalidate fixed point selections; do not silently overwrite the frozen snapshot.

Validation history: the publication refresh on 2026-09-07 regenerated the qualified audit, scaling analysis and UI snapshot; all four relevant test files passed individually (24 tests total), followed by `npm.cmd run check` and the static build. The later default-collection/explainer UI change passed all six report tests, simulator checks and the static build. Browser interaction/visual QA was not requested and has not been performed.

Scaling-analysis regeneration and all relevant test files passed individually on 2026-09-07. A single multi-file Node test invocation hit a Windows sandbox `spawn EPERM` before executing tests; rerunning the same files individually passed. No UI code changed, so browser export/build was not required for this analysis.

## Remaining work and publishing state

- The original extraction plan is archived in [archive/inferencex-extraction-plan.md](archive/inferencex-extraction-plan.md). Unfinished research requirements remain active in [INFERENCEX_NEXT_STEPS.md](INFERENCEX_NEXT_STEPS.md); archiving does not mark them complete. [DOCUMENTATION_REVIEW.md](DOCUMENTATION_REVIEW.md) tracks documentation cleanup. Calculations and selection are unchanged.
- Documentation review steps 2 (completion/capacity wording) and 3 (configuration matching) were accepted on 2026-09-07. Keep best-observed wording and current broader selection; no stricter subset is required. Next discussion is step 4, the throughput/latency frontier; its disposition remains undecided.
- User requested latency-limit sliders be recorded for later, with no implementation now. See INFERENCEX_NEXT_STEPS.md for proposed two-limit controls, candidate-point reselection and audit-label requirements. The separate frontier requirement remains undecided; current UI behavior is unchanged.
- Requested UI and documentation work is complete. Next research opportunity: obtain explicit allocation evidence for 439339. Full replay controls, immutable corpus revision, physical placement and comparable saturation sweeps remain unresolved.
- Exact requested Kimi K3 16 vs 8+8 and MiniMax 2.7 12 vs 4+4+4 pairs were not found. Do not substitute other versions.
- Public Site version 13 was deployed on 2026-09-07 at https://inference-report-explorer.frosty-moss-6059.chatgpt.site/report/ after explicit user approval. Its source commit is 8d54428244316f8bc06bc1d1bfb79f397fa0e695. It keeps all six hardware families visible in every collection and automatically opens all 318 records when the chosen hardware is absent from the five-example or 15-qualified collection. Versions 10–12 are stale and must not be redeployed as the current report.
- README, AGENTS and active planning/review documents were refreshed after publication to point to version 12 and the current default behavior. Historical work-log entries retain their original dated status.
- The publication commit intentionally contains only the validated application/report UI changes, generated browser snapshot and related tests/docs. Much research remains modified/untracked. Inspect git status; do not add the whole workspace. Reference clones, older exploration JSON and user ZIPs are not application source.
- reports/inferencex-bundle.zip predates current UI/full-audit work. Repackage before presenting a refreshed bundle; do not call the old ZIP current.

## GitHub publication copy

This repository starts with fresh public history using a GitHub noreply author address. Local Sites configuration, reference checkouts, previous share bundles and optional GitHub run/job/artifact-list caches are excluded. Frozen API snapshots, aggregate JSON/ZIP artifacts, source hashes, manifests and pinned request-accounting source remain byte-for-byte unchanged. See [PUBLICATION.md](PUBLICATION.md).

## 2026-10-24 - Visual README for model/setup comparisons

Refocused the public README on comparing the same actual model across hardware, GPU allocations and serving setups. Added two data-generated PNG diagrams plus their Pillow renderer: a DeepSeek V4 Pro workflow/equal-budget example and GLM-5.2 examples with opposite throughput directions. Pictures explicitly distinguish modeled split totals from measured larger points, keep per-copy multipliers visible and retain selected-load, sweep and software caveats. They are labeled as diagrams rather than screenshots; browser capture was unavailable. Numerical labels and bar lengths come from the frozen browser dataset. No application code, benchmark inputs, report outputs or website deployment changed.

Validation: both figures were visually inspected, PNG integrity and metadata checked, regeneration reproduced identical image hashes, README relative links resolved, privacy checks passed and the diff passed whitespace validation. Existing numerical reports and application code were unchanged.
