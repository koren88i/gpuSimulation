# InferenceX next steps

Updated: 2026-09-07. Status: open research requirements, retained when the original plan was archived with user approval.

This is the active location for unfinished research work. The [original plan](archive/inferencex-extraction-plan.md) is historical context; [HANDOFF.md](HANDOFF.md) describes current delivery state and [INFERENCEX_METHOD.md](INFERENCEX_METHOD.md) describes current calculations. Review these items step by step before choosing implementation scope. No requirement below has been completed or waived by archiving the plan.

## 1. Throughput/latency frontier

Meaning: identify tested settings that offer useful tradeoffs between processing more work and responding faster. A setting is dominated if another compatible setting is at least as good on every chosen metric and strictly better on at least one.

Current state: the code selects best observed points under each policy and exports observed concurrency sweeps. The targeted review found no explicit frontier computation.

- [ ] Agree which latency metrics and configuration groups define the frontier.
- [ ] Decide whether to implement the original requirement or explicitly defer/revise it.
- [ ] If implemented, generate frontier membership in code, preserve source-point identities, test dominance and ties, and document how users access it.

Completion requires an explicit decision or verified implementation. A frontier of tested points does not prove a deployment's maximum capacity.

### Planned interaction: latency-limit sliders — deferred

User decision (2026-09-07): add this feature to next steps; do not implement it now. It provides an interactive way to explore the latency/capacity tradeoff. A separate explicit frontier calculation/chart has not been approved or waived by this decision.

Proposed behavior:

- Two sliders with editable numeric values: p90 first-token latency (seconds) and p90 time per output token (milliseconds), initially using the current profile defaults.
- Apply identical limits to both sides and reselect the best qualifying measured points under the chosen selection policy. Update sessions, DAU, throughput and gains together from those points.
- Show “No qualifying measurement” when either side lacks a qualifying point. Missing required latency metrics do not pass.
- Results change only at observed-point transitions; do not interpolate measurements. The unconstrained best-throughput policy remains explicitly separate from latency-qualified views.

Implementation checklist for a later session:

- [ ] Choose slider ranges, increments and how dynamic results interact with the existing collections and editorial examples.
- [ ] Export the candidate measurements needed for reselection; the current compact browser snapshot contains only previously selected points.
- [ ] Share selection/calculation logic with the reporting pipeline, preserving equal GPU budgets, compatible workloads, shared profiles and per-copy replication arithmetic.
- [ ] Make source links and audit labels follow the exact newly selected points/pair; do not carry verification from an old selection onto an unaudited one.
- [ ] Preserve selected latency limits in view links and exports, with reset to the baseline profile.
- [ ] Test point changes, missing metrics, no qualifying pair, policy behavior and baseline results; perform browser interaction/visual QA and update the UI guide and handoff.

Changing latency limits would intentionally add reselection behavior; existing usage assumptions currently scale estimates at frozen points. No UI or calculation changes have been made for this planned feature.

## 2. Stronger comparison evidence

Meaning: establish which facts make two benchmark measurements comparable, separately from confirming that their numbers match original source files.

Current state: expanded source matching is complete as an audit pass, with incomplete outcomes retained. Full replay validity, immutable corpus identity, physical placement and saturation are not established.

- [ ] Seek explicit GPU allocation evidence for point 439339; retain incomplete status for its four pairs unless the evidence supports verification.
- [ ] Investigate exact corpus revision, context variant, replay settings and scenario validity on each side.
- [ ] Investigate physical GPU/host placement independently of server/tray equivalents.
- [ ] Assess whether comparable load sweeps approach the latency boundary on both sides; document where maximum-capacity conclusions remain unsupported.

Record sources and unresolved findings separately for each question. Missing evidence stays missing, not a confirmed mismatch. Mark each item verified, explicitly deferred or unresolved with a reason; do not infer completion from matching source metrics.

## 3. Matching deployment configurations — resolved

Meaning: topology describes how GPUs divide the work, such as separate pools for reading prompts and generating answers. Software, routing and other recipe settings can also affect the result.

Current state: selection groups match model, hardware, precision, workload and speculative method. They can select different software or topology on each side and flag differences. This compares selected measured deployments; it does not isolate the effect of combining GPUs.

- [x] Decide whether the current broader comparison answers the intended question.
- [x] Record the accepted scope in the method and handoff.

Decision (2026-09-07): user does not require stricter matching or an additional matched subset. Accept each deployment's settings as the benchmark submitter's best chosen setup for that deployment, as a working assumption rather than proof of optimal tuning. The original exact-topology requirement is explicitly revised to the current broader selection. Existing model/hardware/workload/precision/speculation grouping, equal GPU budgets, shared profiles and difference flags remain in force. No code change is needed. This does not close the evidence or frontier items above.

## Other open delivery and coverage items

- Exact requested Kimi K3 and MiniMax 2.7 size pairs were not found; preserve those gaps without substituting model versions.
- Browser interaction/visual QA remains outstanding.
- Public Site version 12 is current at https://inference-report-explorer.frosty-moss-6059.chatgpt.site/report/ . It defaults to the five audited examples and includes the plain-language top-page explainer. Versions 10 and 11 and the older research ZIP are stale.

Track documentation-only cleanup in [DOCUMENTATION_REVIEW.md](DOCUMENTATION_REVIEW.md). After material research changes, update the handoff/work log and follow AGENTS.md for generated outputs, evidence preservation and relevant checks.
