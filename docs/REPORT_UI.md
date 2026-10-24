# Interactive report explorer

The report is at /report/; the original simulator is at /. Read [HANDOFF.md](HANDOFF.md) for current research and deployment state.

## Behavior

Default: five source-checked editorial examples. All 15 qualified AgentX session comparisons and all 318 policy records are separately selectable. Collection changes reset filters; the broad collection starts with All operating points. The hardware menu always lists hardware represented anywhere in the 318 records. Choosing hardware absent from the current five- or 15-record collection automatically opens the broad collection and preserves that hardware choice. Model and policy filters then narrow the list.

A collapsed “What is this page?” explainer appears above the filters. It gives a plain-language account of the equal-budget pairing process, scaled split baseline, why the five examples are the default and why selected-point differences are not maximum-capacity claims.

Views show active sessions, DAU and output throughput. Split cards explicitly show per-copy value × copies = total; percentage calculations use the total once. Visible remarks distinguish selected-load results from maximum capacity and expose sparse sweeps/software differences.

Source verification is separate from editorial selection: 11 pairs verified, four incomplete because their shared point 439339 lacks explicit source GPU totals. Evidence includes configuration, latency, source links, audit findings and AgentX telemetry links. AgentX links open recorded runs, not executions.

Shared usage controls apply identical assumptions to both sides, with expandable per-input explanations. The equation explanation starts collapsed and shows live substitutions. Usage changes do not reselect benchmark points. Unsupported coding estimates remain unavailable.

The selection-history section starts collapsed. It shows generated stage counts, editorial rationales, all qualified candidate decisions and direct navigation. Earlier exclusion counters overlap and are not additive rejection counts.

Downloads include baseline CSVs, current recalculated comparison and usage profile JSON. Copy view link preserves point, metric and supported profile inputs.

## Code map

| File | Responsibility |
|---|---|
| report/index.html, report/report.css | Structure and responsive styling |
| report/report.js | Rendering, controls, exports, links and remarks |
| report/selection.js | Filtering and selection-history derivation |
| scripts/inferencex/capacity.js | Shared numerical formulas |
| scripts/inferencex/export-ui.js | Compact browser snapshot and baseline CSV export |
| scripts/inferencex/verify-qualified.js | Full qualified point/pair audit |
| data/inferencex-ui.json | Browser data and expanded audit findings |
| scripts/build.js | Static dist packaging, including report modules |

## Refresh

```powershell
node scripts/inferencex/verify-qualified.js
node scripts/inferencex/export-ui.js
node --test tests/report.test.js tests/qualified-audit.test.js tests/inferencex.test.js
npm.cmd run check
npm.cmd run build
python -m http.server 4173 --bind 127.0.0.1
```

Start the preview only when needed; open http://127.0.0.1:4173/report/ . Export requires local generated research and qualified-audit reports. Static builds use the compact snapshot without API calls. The website build excludes large raw research archives.

Browser interaction/visual QA has not been performed. Public Site version 12 contains the current validated UI at https://inference-report-explorer.frosty-moss-6059.chatgpt.site/report/ . Versions 10 and 11 are stale and must not be redeployed as the completed report.
