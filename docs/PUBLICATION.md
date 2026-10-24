# Public repository scope

The GitHub publication uses fresh history and the owner's GitHub noreply commit address. It does not include the original local Git history, Sites project configuration, reference repository checkouts, exploratory root-level benchmark downloads, or earlier share/research bundles.

Optional GitHub Actions run, job and artifact-list response caches are omitted because run responses include contributor names and emails. The manifests still retain upstream run IDs, URLs and commit SHAs. Aggregate JSON and original ZIP artifacts, archive hashes, pinned request-accounting source, frozen raw API snapshots and generated reports are included unchanged. Numerical results were not edited for publication.

Offline research generation and tests work from the repository root using the commands in README.md. A network audit can recreate ignored upstream metadata caches locally; those caches must remain untracked. The optional reference checkout is needed only when downloading request-accounting source not already cached. No new website deployment is part of this GitHub publication.

The static application is built with `npm run build`; serve `dist/` with a static host. The interactive explorer is at `/report/` and the original simulator is at `/`.

## Validation before publication

All four research/report test suites passed (26 tests), simulator invariants and syntax checks passed, and the static build succeeded. The privacy scan covered included files and aggregate archive members without finding personal email addresses, local Windows user paths, Sites project identifiers or recognizable credentials. All referenced frozen snapshot hashes and original aggregate ZIP hashes were verified. No numerical inputs or generated reports were changed.
