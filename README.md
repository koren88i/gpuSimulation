# GPU capacity comparison project

This workspace contains an existing capacity simulator and a reproducible InferenceX research pipeline. The current research asks: **for one model on one hardware type, how does a larger coordinated deployment compare with independent smaller deployments using the same GPU budget?**

Start with the public [Inference Report Explorer](https://inference-report-explorer.frosty-moss-6059.chatgpt.site/report/) or the [audited shortlist](reports/inferencex/shortlist.md). For local development, use `http://127.0.0.1:4173/report/` after starting the server. For continuation in another session, read [the handoff](docs/HANDOFF.md).

## Main outputs

- [Interactive UI guide](docs/REPORT_UI.md): five source-checked editorial examples by default, with all 15 qualified comparisons and all 318 policy records also available. A collapsed “What is this page?” explainer summarizes the method and limitations.
- [Full qualified source audit](reports/inferencex/qualified-audit.md): 11 pairs verified, four incomplete; [machine-readable results](reports/inferencex/qualified-audit.json). All 15 were checked; incomplete pairs share a point missing explicit source GPU totals.

- [Audited shortlist](reports/inferencex/shortlist.md), [CSV](reports/inferencex/shortlist.csv), [JSON and source audit](reports/inferencex/shortlist.json).
- [Broad extraction report](reports/inferencex/report.md) and [all comparison records](reports/inferencex/comparisons.csv).
- [Unified-versus-split scaling analysis](reports/inferencex/scaling-analysis.md), with [machine-readable sensitivity results](reports/inferencex/scaling-analysis.json) and [all qualified AgentX pairs](reports/inferencex/scaling-agentx.csv).
- [Coverage and exclusions](reports/inferencex/coverage.json).
- [Editable coding profile](data/inferencex/profiles/agentx-coding-v1.json).

The shortlist verifies source measurements; it does not establish optimal or production-validated capacity. Source metadata and concurrency-sweep limitations are documented with every example. GB200/GB300 allocations use four-GPU compute-tray equivalents, separately from eight-GPU B200/B300/H200/H100 servers.

## Research commands

Requires Node.js 24+; no npm dependencies for the extractor. Python 3 and an authenticated GitHub CLI are needed only for the source-artifact audit. Run commands from this directory.

```powershell
# Offline regeneration from included snapshots
node scripts/inferencex/report.js
node scripts/inferencex/shortlist.js
node scripts/inferencex/verify-qualified.js
node scripts/inferencex/export-ui.js
node --test tests/inferencex.test.js tests/qualified-audit.test.js tests/report.test.js

# Refresh broad API coverage (network)
node scripts/inferencex/fetch.js --refresh
node scripts/inferencex/provenance.js

# Source audit (network only for uncached GitHub records/artifacts)
python scripts/inferencex/audit_sources.py --all-qualified

# Package data, code, reports, tests and handoff documents
python scripts/inferencex/package.py
```

Changing the broad snapshot can invalidate fixed shortlist row selections. Review the shortlist identities and evidence before regenerating it against refreshed data. Profile changes use `node scripts/inferencex/report.js --profile path/to/profile.json`, then regenerate the shortlist. This overwrites the generated reports with the selected profile; restore the default by rerunning without `--profile`.

## Existing simulator

`app.js`, `index.html`, `styles.css`, the original `data/glm-*` files, and `tests/simulator.test.js` belong to the existing simulator. Its calculations remain separate; its navigation now links to the new InferenceX report at `/report/`.

```powershell
npm.cmd run check
npm.cmd run build
npm.cmd run serve
```

The current public deployment is named **Inference Report Explorer** and is available at https://inference-report-explorer.frosty-moss-6059.chatgpt.site/report/ . Local hosting configuration is excluded from this public repository.

## Documentation

- [Handoff and current state](docs/HANDOFF.md)
- [Methods, units, assumptions and source pitfalls](docs/INFERENCEX_METHOD.md)
- [Work log](docs/WORK_LOG.md)
- [Report UI and refresh instructions](docs/REPORT_UI.md)
- [Active research next steps](docs/INFERENCEX_NEXT_STEPS.md)
- [Archived original extraction design](docs/archive/inferencex-extraction-plan.md)
- [Original simulator specification](ai-model-pool-capacity-simulator-spec.md)

Publication scope and offline reproducibility are documented in [docs/PUBLICATION.md](docs/PUBLICATION.md).
