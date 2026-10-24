# Documentation review

Created: 2026-09-07. Status: archival approved and completed; remaining documentation proposals pending review.

The user approved archiving the original plan while retaining unfinished work. Active research requirements now live in [INFERENCEX_NEXT_STEPS.md](INFERENCEX_NEXT_STEPS.md). Items 3, 4 and the research portions of item 6 below are review findings; track their ongoing decisions in that next-steps document.

## Purpose and assessment

Review coherence between the current documentation, original extraction plan and implementation. HANDOFF.md remains the current-state guide; this file tracks review decisions.

Reviewed AGENTS.md, all Markdown files in docs/, inferencex-extraction-plan.md, and relevant selection, calculation, report and packaging code. This was a documentation and targeted code review, not a fresh test run or full implementation audit.

The current docs are largely coherent. The original plan is useful historical context, but “implemented and executed” overstates completion of every original requirement. The accepted extraction/report/UI implementation is documented as complete; browser QA, publishing and research-evidence questions remain open. Maximum and production capacity have not been established.

## Step-by-step checklist

Recommendations remain proposals unless an explicit decision is recorded below. The plan has been archived; calculations and selection have not changed.

### 1. Decide where the plan belongs

- [x] Agree on role and location.
- [x] Apply the decision and update references.

Recommendation: move the root plan to `docs/archive/inferencex-extraction-plan.md`. Preserve the original design and add a disposition table: implemented, revised, deferred, unresolved. Keep current behavior in INFERENCEX_METHOD.md, current state in HANDOFF.md and UI behavior in REPORT_UI.md.

A move requires updating the README link and the hard-coded packaging paths in scripts/inferencex/package.py. Moving the file does not refresh the existing ZIP.

Decision: approved and completed on 2026-09-07. The original plan is in docs/archive/inferencex-extraction-plan.md with an archival status, disposition table and caveats. README, handoff and packaging references were updated. Unfinished research requirements remain active in INFERENCEX_NEXT_STEPS.md; no requirement was waived. The existing ZIP was not regenerated.

### 2. Correct completion and capacity wording

- [x] Agree on completion terminology.
- [x] Update the status and affected wording.

The original plan said “implemented and executed” and used “maximum sustainable request throughput.” Current methodology supports best observed points satisfying configured latency limits, not proven sustainable or maximum capacity. The archival status and disposition table now distinguish implemented delivery from unfinished requirements; historical design wording is explicitly labeled as such.

Recommendation: describe the implemented scope, list unmet requirements and replace sustainable-capacity language where it describes current results.

Decision: accepted on 2026-09-07. Close this documentation item using the archival clarification already applied. Describe current results as “best observed result within the configured latency limits.” This does not establish maximum capacity or close the research requirements in INFERENCEX_NEXT_STEPS.md. No calculations changed.

### 3. Reconcile selection scope

- [x] Decide whether to document current selection or request an implementation change.
- [x] Reconcile the plan disposition and method accordingly.

The plan calls for selection within each exact workload/topology class. scripts/inferencex/compare.js groups by model, hardware, precision, workload type/length or recorded dataset identity, and speculative method. Selection allows software and topology differences and flags them.

Recommendation: record broader best-observed selection as a revision to the original design. Stricter recipe/topology matching would be separate research work and could change results and coverage.

Decision: accepted on 2026-09-07. User does not need stricter matching and assumes each deployment uses its submitter's best chosen settings. Keep current broader selection; no stricter subset is requested. Record the assumption without claiming independently proven optimal tuning. Updated the method, next steps, archive disposition and handoff. No calculation or selection change.

### 4. Resolve the frontier promise

- [ ] Decide whether the frontier is deferred, superseded or still required.
- [ ] Record the disposition or define implementation work.

The plan promises a nondominated throughput/latency frontier. The reviewed code selects operating points and exports observed concurrency sweeps; no explicit frontier computation was found in the targeted review.

Recommendation: do not mark this complete without identifying its implementation or deliberately revising the requirement.

Decision: on 2026-09-07, user requested adding latency-limit sliders to next steps and explicitly deferred implementation. The feature is specified in INFERENCEX_NEXT_STEPS.md. The separate explicit frontier requirement remains undecided; this entry does not mark it implemented or waived.

### 5. Align the AgentX formula

- [ ] Confirm and apply the documentation correction.

The plan omits division by rootSessionsPerUser. Its equation agrees with current code only at the default of one. INFERENCEX_METHOD.md and scripts/inferencex/capacity.js include that division:

```text
estimatedActiveSessions = configuredRootSessionConcurrency
  * (1 - reserveFraction) / rootSessionsPerUser
```

Recommendation: correct the plan's equation. No calculation-code change is indicated by this finding.

Decision: pending.

### 6. Separate delivered work from unresolved evidence

- [ ] Review and classify remaining evidence and delivery checks.
- [ ] Reflect their status in the plan disposition and handoff.

The handoff records these open items:

- Explicit GPU allocation evidence for point 439339, affecting four qualified pairs.
- Immutable corpus revision, full replay controls and scenario validity.
- Physical host placement and comparable saturation sweeps.
- Missing exact requested Kimi K3 and MiniMax 2.7 size pairs; other versions cannot substitute.
- Browser interaction and visual QA.
- Public Site version 12 is published at https://inference-report-explorer.frosty-moss-6059.chatgpt.site/report/; versions 10 and 11 and the earlier ZIP are stale.

Recommendation: preserve the distinctions between delivery, source verification and capacity validation. Missing evidence is not a confirmed mismatch. Source matching does not prove maximum capacity.

Decision: pending.

### 7. Clean up historical wording and the work log

- [ ] Replace or label remaining “proposed implementation/files” language.
- [ ] Link to later explorer and expanded-audit work without rewriting historical intent.
- [ ] Repair WORK_LOG.md heading encoding and make ordering consistent.
- [ ] Preserve historical validation and artifact statements with clear dates/context.

Recommendation: use HANDOFF.md for current status. Do not imply old bundle or test statements describe the current version. WORK_LOG.md contains invalid UTF-8 bytes, so its encoding needs deliberate repair rather than an incidental rewrite.

Decision: pending.

### 8. Verify the agreed changes

- [ ] Check references and packaging paths after any move.
- [ ] Check consistency across README, AGENTS, handoff, method, UI guide and plan.
- [ ] Update HANDOFF.md and WORK_LOG.md with actual decisions and completed work.
- [ ] Record remaining items here.

Wording-only edits do not require numerical report regeneration. Any later calculation, selection, audit or UI changes must follow project instructions and appropriate checks. No publishing, commit or push is implied by this review.
