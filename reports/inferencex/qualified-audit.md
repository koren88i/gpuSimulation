# Source verification of all qualified session comparisons

Aggregate verification does not prove optimal capacity, complete replay compliance, immutable corpus revision, physical host placement or production suitability.

| Model / hardware | Allocation | Status | Finding |
|---|---|---|---|
| dsv4 / gb300 | 9 vs 3+3+3 | verified | Both original aggregates match API identity, allocation, metrics and profiling accounting; checkpoint and recorded corpus metadata agree across the pair. |
| dsv4 / gb300 | 3 vs 1+1+1 | incomplete | Smaller: Incomplete evidence: original aggregate omits explicit GPU allocation totals |
| dsv4 / gb300 | 5 vs 1+1+1+1+1 | incomplete | Smaller: Incomplete evidence: original aggregate omits explicit GPU allocation totals |
| dsv4 / gb300 | 9 vs 1+1+1+1+1+1+1+1+1 | incomplete | Smaller: Incomplete evidence: original aggregate omits explicit GPU allocation totals |
| dsv4 / gb300 | 7 vs 1+1+1+1+1+1+1 | incomplete | Smaller: Incomplete evidence: original aggregate omits explicit GPU allocation totals |
| dsv4 / gb200 | 4 vs 2+2 | verified | Both original aggregates match API identity, allocation, metrics and profiling accounting; checkpoint and recorded corpus metadata agree across the pair. |
| dsv4 / gb200 | 8 vs 2+2+2+2 | verified | Both original aggregates match API identity, allocation, metrics and profiling accounting; checkpoint and recorded corpus metadata agree across the pair. |
| glm5.2 / gb300 | 12 vs 2+2+2+2+2+2 | verified | Both original aggregates match API identity, allocation, metrics and profiling accounting; checkpoint and recorded corpus metadata agree across the pair. |
| glm5.2 / gb300 | 8 vs 2+2+2+2 | verified | Both original aggregates match API identity, allocation, metrics and profiling accounting; checkpoint and recorded corpus metadata agree across the pair. |
| glm5.2 / gb200 | 8 vs 2+2+2+2 | verified | Both original aggregates match API identity, allocation, metrics and profiling accounting; checkpoint and recorded corpus metadata agree across the pair. |
| dsv4 / gb200 | 8 vs 4+4 | verified | Both original aggregates match API identity, allocation, metrics and profiling accounting; checkpoint and recorded corpus metadata agree across the pair. |
| glm5.2 / gb300 | 9 vs 3+3+3 | verified | Both original aggregates match API identity, allocation, metrics and profiling accounting; checkpoint and recorded corpus metadata agree across the pair. |
| glm5.2 / gb300 | 12 vs 3+3+3+3 | verified | Both original aggregates match API identity, allocation, metrics and profiling accounting; checkpoint and recorded corpus metadata agree across the pair. |
| kimik3 / gb300 | 8 vs 2+2+2+2 | verified | Both original aggregates match API identity, allocation, metrics and profiling accounting; checkpoint and recorded corpus metadata agree across the pair. |
| kimik3 / gb300 | 6 vs 2+2+2 | verified | Both original aggregates match API identity, allocation, metrics and profiling accounting; checkpoint and recorded corpus metadata agree across the pair. |
