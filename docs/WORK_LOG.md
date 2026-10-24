# Research work log

## 2026-09-05 — Interactive report viewer

- Added `/report/` with audited/broad collections, filters, GPU allocations, session/DAU/throughput selection, evidence and source links.
- Reused the calculation module in the browser; shared assumptions apply at frozen operating points. Added profile/comparison exports and shareable links.
- Exported compact data and CSV downloads, integrated the static build, and added report navigation to the simulator.
- Added `REPORT_UI.md` and refreshed the handoff. Sixteen research/UI tests, simulator checks and static build passed.
- Browser access was unavailable, so no interaction or visual QA is claimed. Public deployment requires approval.

## 2026-09-05 — Question and method established

- Clarified that the user wants a measured larger deployment compared with multiple independent smaller deployments on equal hardware, not merely single-server linear scaling.
- Reproduced a DeepSeek V4 Pro B200 4-versus-8-server example and the doubled-small throughput baseline. Preserved software/date and latency differences.
- Confirmed fixed-sequence request concurrency is not human CCU and DAU is not supplied by the benchmark API. Later corrected the scope: AgentX concurrency is root coding-session trees, making it a better session proxy.
- Agreed on code-generated calculations, JSON/CSV plus a readable report, configurable default coding profile, shared assumptions on both sides, and no simulator integration yet.

## 2026-09-05 — Broad extractor implemented

- Added full-history downloads, immutable raw response files, provenance manifests, normalization, model-key separation, GPU accounting checks, capacity functions, policy-based pairing and generated reports.
- Covered B200/B300/H200/H100 and supplemental GB200/GB300 with explicit different node units.
- Archived the broad extraction and generated 318 policy-specific comparison records. Missing metadata and failed log lookups remain documented; source conflicts were quarantined.
- Validated the DeepSeek regression, shared formulas, unit handling, null handling, model separation and every generated comparison. Offline regeneration produced matching hashes.

## 2026-09-05 — Source-audited shortlist and handoff

- Reviewed the 15 latency-qualified AgentX session comparison records, not just the largest positive gains.
- Downloaded 66 small original aggregate artifacts from five source runs. Matched eight unique selected points to the API by configuration and performance metrics.
- Verified actual checkpoints, dated corpus metadata/393 entries, allocated GPU totals and recorded router versions. Archived source job metadata and pinned producer error-accounting code.
- Identified overlap between warmup and error counters and implemented correct profiling-only error accounting with consistency checks.
- Retained five illustrative comparisons, including a same-run DeepSeek comparison, related Kimi examples and a split-favored GLM example. Excluded huge gains based on one-session small-side tests from the shortlist.
- Explicitly retained the distinction between source-verified points and unproven capacity maxima. Full replay validity, immutable corpus revision, physical placement and saturation remain unresolved.
- Added README, AGENTS.md, handoff, method documentation and this log so future sessions can continue without reconstructing the conversation.
- The current user authorization covers review, research artifacts and documentation. No simulator integration, commit, push or deployment was performed.
- Final validation: 13 tests passed, including the eight exact source matches and overlap-aware error accounting. The shortlist is regenerated from code, and the downloadable bundle includes the new documentation and source-audit files.

## 2026-09-05 � Usage-profile explanations
Added information disclosures for all four editable parameters, rationale and provenance of defaults, occupancy equations and code-generated substitutions, plus fixed root-user mapping and latency eligibility explanations. No formula changes or public deployment.

- Made the usage-profile equation explanation a native details disclosure, collapsed by default, as requested.

- Added AgentX detail links beneath larger/smaller source links for agentic points, with positive numeric ID validation and new-tab navigation. Static build and JavaScript syntax check passed.

## 2026-09-06 � Selection history and all qualified candidates
Added three collections with all 15 qualified comparisons as default; marked audited examples. Added a collapsed selection funnel, shortlist rationale table, all-candidate exploration table, and recorded exclusion/coverage counters. Counts and limitation flags are code-derived, with editorial selection separated from eligibility and missing evidence. Added selection invariant tests and rebuilt the static site.

## 2026-09-06 � All qualified source verifications
Extended cached downloader to all 18 qualified points while preserving the original shortlist manifest. Added point and pair verification, explicit incomplete/mismatch outcomes, upstream image separator normalization, generated JSON/Markdown findings, and UI audit statuses. Verified 17 points / 11 pairs; 4 pairs await explicit allocation evidence for shared point 439339. Downloaded/read 107 artifacts across 11 runs with no errors. Added identity/allocation/pair mismatch tests. No public deployment.

- Fixed all-comparisons collection retaining the session-only filter: added All operating points and reset model/hardware/policy on collection changes. Shared filter regression verifies 318/15/5 collection counts. Build passed.

- Refined comparison remarks: split cards show per-copy value times copies equals combined total; percentage equations use the already-scaled total. Added visible sweep/load/software caveats and labeled gains as differences at selected tested loads. Corrected reserve percentage notation in worked equations. Syntax check and build passed.

## 2026-09-06 � New-session documentation refresh
Rewrote HANDOFF.md and REPORT_UI.md into current-state guides, replacing stale append-only summaries. Updated README, AGENTS and method documentation for all qualified audits, 318/15/5 collections, explicit replication arithmetic, interpretation caveats, source-verification limits and refresh commands. Recorded exact validation history and stale saved Site/research-bundle status. No source-code changes, commit, push or deployment in this documentation turn.

## 2026-09-07 - Documentation review checklist

Created DOCUMENTATION_REVIEW.md following a documentation and targeted code review. It records proposals for step-by-step discussion; no plan relocation or calculation change was made. Linked it from HANDOFF.md. Existing work-log encoding issues are recorded for later review; this entry was appended without rewriting earlier bytes. No tests, report regeneration, commit, push or deployment.

## 2026-09-07 - Extraction plan archived with active follow-up

With user approval, moved the original plan to docs/archive/inferencex-extraction-plan.md and added an archival status and requirement disposition. Created docs/INFERENCEX_NEXT_STEPS.md for the unfinished frontier, evidence and configuration-selection requirements, with plain-language explanations and review checklists. Updated README, handoff, documentation review and recursive documentation inclusion in package.py. No research requirement was waived; calculations and selection are unchanged. Existing ZIP was not regenerated. Earlier work-log bytes were preserved.

## 2026-09-07 - Completion wording review accepted

User accepted documentation review step 2. Marked it complete based on the existing archival clarification: implemented delivery is separate from open research, and current results are best observed within configured latency limits. Configuration matching remains the next undecided review item. Updated handoff; no calculations, selection, generated results or publication changed.

## 2026-09-07 - Broader deployment matching accepted

User declined stricter matching and an additional matched subset, accepting each deployment's settings as its submitter's best chosen setup. Recorded this as a working assumption, not proven optimal tuning. Closed documentation review step 3 and revised the archived requirement disposition, active next steps, method and handoff. Existing selection and evidence flags remain unchanged; frontier and evidence questions remain open. No code changes, report regeneration, tests, commit, push or deployment.

## 2026-09-07 - Latency sliders recorded for later

User requested adding latency-limit sliders to next steps and explicitly deferred implementation. Recorded proposed two-limit controls, measured-point reselection, candidate export, exact-point audit labels, links/exports and verification tasks. Updated documentation review and handoff. Separate frontier disposition remains open. No UI/code changes, report regeneration, tests or publication.

## 2026-09-07 - Current report published publicly

With explicit user approval, regenerated the qualified audit, scaling analysis and browser snapshot; ran the four relevant test files individually (24 tests total), simulator checks and the static build. Committed and pushed the validated report UI/application subset as 7423d654ca8bde9e7dc282894cf7d17148807128, saved Site version 11 and deployed it publicly at https://glm-h200-capacity-lab.frosty-moss-6059.chatgpt.site/report/ . Browser interaction/visual QA was not requested. Unrelated research artifacts and reference checkouts remain uncommitted.

## 2026-09-07 - Five-example default and page explainer

Changed the report default from all 15 qualified comparisons to the five source-checked editorial examples. Added a collapsed “What is this page?” section above the filters explaining the equal-budget process, replicated split baseline, rationale for the five-example default, shared assumptions and selected-point limitations in plain language. Added a static regression test; all six report tests, simulator checks and the static build passed. Public Site version 11 remains unchanged pending explicit approval to publish this update.

## 2026-09-07 - Five-example update published and Site renamed

After the user confirmed the live report was still unchanged, renamed the Site title to Inference Report Explorer and changed the public slug to inference-report-explorer. Updated page and social metadata for the new origin, rebuilt, saved Site version 12 and deployed it publicly at https://inference-report-explorer.frosty-moss-6059.chatgpt.site/report/ . The live report now defaults to the five audited examples and includes the collapsed “What is this page?” explainer.

## 2026-09-07 - Markdown documentation synchronized

Updated README.md, AGENTS.md, HANDOFF.md, REPORT_UI.md, INFERENCEX_NEXT_STEPS.md and DOCUMENTATION_REVIEW.md to reflect the Inference Report Explorer name and public URL, the five-example default, the top-page explainer and Site version 12 as current. Historical work-log entries and archived documents were left unchanged so their dated statements remain intact. No report data, calculations, UI source, build or deployment changed.

## 2026-10-24 - Clean GitHub publication preparation

Prepared a separate publication copy with fresh noreply Git history, defensive ignore rules and documented scope. Omitted local deployment configuration, reference checkouts, old bundles and optional GitHub response caches containing contributor identities. Preserved frozen numerical inputs, aggregate artifacts, provenance and generated results byte-for-byte. The original workspace and its history remain separate.

## 2026-10-24 - Visual README for model/setup comparisons

Refocused the public README on comparing the same actual model across hardware, GPU allocations and serving setups. Added two data-generated PNG diagrams plus their Pillow renderer: a DeepSeek V4 Pro workflow/equal-budget example and GLM-5.2 examples with opposite throughput directions. Pictures explicitly distinguish modeled split totals from measured larger points, keep per-copy multipliers visible and retain selected-load, sweep and software caveats. They are labeled as diagrams rather than screenshots; browser capture was unavailable. Numerical labels and bar lengths come from the frozen browser dataset. No application code, benchmark inputs, report outputs or website deployment changed.

Validation: both figures were visually inspected, PNG integrity and metadata checked, regeneration reproduced identical image hashes, README relative links resolved, privacy checks passed and the diff passed whitespace validation. Existing numerical reports and application code were unchanged.

## 2026-10-24 - README selection funnel; screenshots still blocked

Added a data-generated funnel illustration and README explanation. The renderer reuses `selectionSummary` from the explorer to obtain the stage definitions/counts and displays source-audit outcomes separately. The figure explicitly distinguishes measurement counts from comparison records and states that shapes are not proportional or conversion percentages. Numerical report outputs and application code are unchanged.

Retried actual explorer screenshots after the user opened the report in Chrome. The correct report window was detected, but `get_window_state` failed with `FrameArrived timed out: timed out waiting on channel`; reselecting/activating the window and retrying failed with `window capture timed out: timed out waiting on channel`. The alternative browser inventory exposed no browser. Actual explorer screenshots remain outstanding; do not describe the existing diagrams as screenshots.

Validation: visually inspected the funnel; all seven report tests passed. Deterministic rendering, PNG integrity/metadata, README links and whitespace checks passed. Existing comparison-diagram hashes were unchanged.
