import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const inputPath = 'reports/inferencex/comparisons.json';
const auditPath = 'reports/inferencex/qualified-audit.json';
const outDir = 'reports/inferencex';

const inputText = await readFile(inputPath, 'utf8');
const input = JSON.parse(inputText);
const audit = JSON.parse(await readFile(auditPath, 'utf8'));
const comparisons = input.comparisons;

const finite = value => typeof value === 'number' && Number.isFinite(value);
const hasFlag = (row, flag) => row.flags.includes(flag);
const median = values => quantile(values, 0.5);

function quantile(values, p) {
  const sorted = values.filter(finite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function distribution(rows, value) {
  const values = rows.map(value).filter(finite);
  return {
    records: values.length,
    unifiedWins: values.filter(x => x > 0).length,
    ties: values.filter(x => Math.abs(x) <= 1e-9).length,
    splitWins: values.filter(x => x < 0).length,
    unifiedWinPct: values.length ? 100 * values.filter(x => x > 0).length / values.length : null,
    withinTenPct: values.filter(x => Math.abs(x) <= 10).length,
    withinTwentyFivePct: values.filter(x => Math.abs(x) <= 25).length,
    unifiedAtLeastDouble: values.filter(x => x >= 100).length,
    splitAtLeastDouble: values.filter(x => x <= -50).length,
    q25GainPct: quantile(values, 0.25),
    medianGainPct: median(values),
    q75GainPct: quantile(values, 0.75),
    minGainPct: values.length ? Math.min(...values) : null,
    maxGainPct: values.length ? Math.max(...values) : null
  };
}

function group(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    const id = key(row);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(row);
  }
  return groups;
}

const workloadFamilyKey = row => JSON.stringify([
  row.model, row.hardware, row.precision, row.specMethod, row.isl, row.osl
]);
const modelHardwareKey = row => `${row.model}|${row.hardware}`;

function collapsedFamilyDistribution(rows, value) {
  const familyMedians = [...group(rows, workloadFamilyKey).values()].map(family => median(family.map(value)));
  return distribution(familyMedians, x => x);
}

function groupedDistribution(rows, key, value) {
  return [...group(rows, key).entries()].map(([name, members]) => ({
    name,
    ...distribution(members, value)
  })).sort((a, b) => b.records - a.records || a.name.localeCompare(b.name));
}

function differenceCounts(rows) {
  const smallSparse = row => hasFlag(row, 'sparse_smaller_configuration_concurrency_sweep');
  const largeSparse = row => hasFlag(row, 'sparse_larger_configuration_concurrency_sweep');
  return {
    records: rows.length,
    smallerSweepSparse: rows.filter(smallSparse).length,
    largerSweepSparse: rows.filter(largeSparse).length,
    eitherSweepSparse: rows.filter(row => smallSparse(row) || largeSparse(row)).length,
    bothSweepsSparse: rows.filter(row => smallSparse(row) && largeSparse(row)).length,
    neitherSweepSparse: rows.filter(row => !smallSparse(row) && !largeSparse(row)).length,
    softwareDiffers: rows.filter(row => hasFlag(row, 'software_differs')).length,
    datesDiffer: rows.filter(row => hasFlag(row, 'dates_differ')).length,
    deploymentModeDiffers: rows.filter(row => hasFlag(row, 'aggregated_vs_disaggregated') || hasFlag(row, 'offload_differs')).length,
    selectedTotalConcurrencyDiffers: rows.filter(row => hasFlag(row, 'total_concurrency_differs')).length
  };
}

function latencyDirection(row) {
  const ttft = row.largeP90Ttft < row.smallP90Ttft ? 'better' : row.largeP90Ttft > row.smallP90Ttft ? 'worse' : 'same';
  const tpot = row.largeP90Tpot < row.smallP90Tpot ? 'better' : row.largeP90Tpot > row.smallP90Tpot ? 'worse' : 'same';
  if (ttft === 'better' && tpot === 'better') return 'unified_better_both';
  if (ttft === 'worse' && tpot === 'worse') return 'unified_worse_both';
  return `mixed_ttft_${ttft}_tpot_${tpot}`;
}

const fixed = comparisons.filter(row => row.policy === 'best_observed_throughput' && row.type === 'single_turn');
const fixedNoSpec = fixed.filter(row => row.specMethod === 'none');
const fixedDoubling = fixed.filter(row => row.copies === 2);
const fixedBothSwept = fixed.filter(row =>
  !hasFlag(row, 'sparse_smaller_configuration_concurrency_sweep') &&
  !hasFlag(row, 'sparse_larger_configuration_concurrency_sweep'));
const agentx = comparisons.filter(row => row.policy === 'latency_qualified_sessions');
const agentxVerified = agentx.filter(row => audit.pairs[row.id]?.status === 'verified');

const latencyDirections = Object.fromEntries(
  [...group(agentx, latencyDirection).entries()].map(([key, rows]) => [key, rows.length])
);

const agentxRows = agentx
  .map(row => ({
    id: row.id,
    model: row.model,
    hardware: row.hardware,
    nodeUnit: row.nodeUnit,
    comparison: `${row.largeNodeEquivalents} vs ${row.copies}x${row.smallNodeEquivalents}`,
    largeNodeEquivalents: row.largeNodeEquivalents,
    smallNodeEquivalents: row.smallNodeEquivalents,
    copies: row.copies,
    largeConcurrency: row.largeConcurrency,
    splitConcurrency: row.splitConcurrency,
    sessionGainPct: row.sessionGainPct,
    throughputGainPct: row.throughputGainPct,
    largeP90Ttft: row.largeP90Ttft,
    smallP90Ttft: row.smallP90Ttft,
    largeP90Tpot: row.largeP90Tpot,
    smallP90Tpot: row.smallP90Tpot,
    latencyDirection: latencyDirection(row),
    smallerSweepPoints: row.smallObservedConcurrencies.length,
    largerSweepPoints: row.largeObservedConcurrencies.length,
    auditStatus: audit.pairs[row.id]?.status ?? 'not_checked',
    softwareDiffers: hasFlag(row, 'software_differs'),
    datesDiffer: hasFlag(row, 'dates_differ'),
    deploymentModeDiffers: hasFlag(row, 'aggregated_vs_disaggregated') || hasFlag(row, 'offload_differs'),
    selectedTotalConcurrencyDiffers: hasFlag(row, 'total_concurrency_differs')
  }))
  .sort((a, b) => a.model.localeCompare(b.model) || a.hardware.localeCompare(b.hardware) || a.largeNodeEquivalents - b.largeNodeEquivalents || a.copies - b.copies);

const closestControlledId = 'latency_qualified_sessions:439969:439975:2';
const closestControlled = agentxRows.find(row => row.id === closestControlledId);

const analysis = {
  schemaVersion: 1,
  source: {
    comparisonFile: inputPath,
    comparisonSha256: createHash('sha256').update(inputText).digest('hex'),
    profileHash: input.profileHash,
    auditFile: auditPath
  },
  definitions: {
    gain: '100 * (measured larger value / (copies * measured smaller value) - 1)',
    positiveGain: 'measured larger deployment (unified) wins at the selected tested points',
    negativeGain: 'modeled fleet of independent smaller deployments (split) wins at the selected tested points',
    familyCollapse: 'one median result per exact model, hardware, precision, speculative method and fixed workload-length family',
    moreSweptSubset: 'both selected configurations have more than two observed concurrency settings for the exact dated stack/configuration; this is not proof of saturation'
  },
  scope: {
    comparisonRecords: comparisons.length,
    fixedBestObservedRecords: fixed.length,
    agentxLatencyQualifiedSessionRecords: agentx.length,
    fixedWorkloadFamilies: group(fixed, workloadFamilyKey).size,
    agentxModelHardwareFamilies: group(agentx, modelHardwareKey).size,
    agentxModels: [...new Set(agentx.map(row => row.model))].sort(),
    agentxHardware: [...new Set(agentx.map(row => row.hardware))].sort()
  },
  fixedLength: {
    allPairRecords: distribution(fixed, row => row.throughputGainPct),
    collapsedWorkloadFamilies: collapsedFamilyDistribution(fixed, row => row.throughputGainPct),
    noSpeculativeDecodingPairRecords: distribution(fixedNoSpec, row => row.throughputGainPct),
    noSpeculativeDecodingCollapsedFamilies: collapsedFamilyDistribution(fixedNoSpec, row => row.throughputGainPct),
    doublingPairRecords: distribution(fixedDoubling, row => row.throughputGainPct),
    doublingCollapsedFamilies: collapsedFamilyDistribution(fixedDoubling, row => row.throughputGainPct),
    bothSidesMoreSweptPairRecords: distribution(fixedBothSwept, row => row.throughputGainPct),
    bothSidesMoreSweptCollapsedFamilies: collapsedFamilyDistribution(fixedBothSwept, row => row.throughputGainPct),
    differencesAndSweepCoverage: differenceCounts(fixed),
    byModel: groupedDistribution(fixed, row => row.model, row => row.throughputGainPct),
    byHardware: groupedDistribution(fixed, row => row.hardware, row => row.throughputGainPct),
    byCopies: groupedDistribution(fixed, row => String(row.copies), row => row.throughputGainPct)
  },
  agentx: {
    sessionCapacityAll: distribution(agentx, row => row.sessionGainPct),
    throughputAtSessionSelectedPointsAll: distribution(agentx, row => row.throughputGainPct),
    sessionCapacitySourceVerified: distribution(agentxVerified, row => row.sessionGainPct),
    auditCounts: audit.counts,
    differencesAndSweepCoverage: differenceCounts(agentx),
    latencyDirections,
    byModelHardware: groupedDistribution(agentx, modelHardwareKey, row => row.sessionGainPct),
    closestControlled,
    rows: agentxRows
  },
  interpretationLimits: [
    'Split capacity is projected by multiplying one measured smaller deployment; a simultaneous split fleet was not measured.',
    'Selected points are best observed under each policy, not proven capacity maxima or exhaustive tuning results.',
    'Overlapping allocation pairs and policies are not statistically independent experiments.',
    'Source verification confirms recorded identity, allocation and metrics; it does not repair sparse sweeps or configuration differences.',
    'The larger allocation can itself be prefill/decode-disaggregated; unified means one larger measured allocation rather than one monolithic server or proven shared scheduling domain.'
  ]
};

const fmt = value => value == null ? '—' : Number(value).toLocaleString('en-US', { maximumFractionDigits: 1 });
const pct = value => `${fmt(value)}%`;
const ratio = summary => `${summary.unifiedWins} / ${summary.ties} / ${summary.splitWins}`;
const table = (headers, rows) => [
  headers.join(' | '),
  headers.map(() => '---').join(' | '),
  ...rows.map(row => row.map(value => String(value).replaceAll('|', '\\|')).join(' | '))
].join('\n');

const modelRows = analysis.fixedLength.byModel.map(row => [
  row.name,
  row.records,
  ratio(row),
  pct(row.unifiedWinPct),
  pct(row.medianGainPct),
  `${pct(row.q25GainPct)} to ${pct(row.q75GainPct)}`
]);

const agentRows = agentxRows.map(row => [
  `${row.model} / ${row.hardware}`,
  row.comparison,
  `${fmt(row.largeConcurrency)} / ${fmt(row.splitConcurrency)}`,
  pct(row.sessionGainPct),
  pct(row.throughputGainPct),
  row.latencyDirection,
  `${row.smallerSweepPoints} / ${row.largerSweepPoints}`,
  row.auditStatus
]);

const fixedAll = analysis.fixedLength.allPairRecords;
const fixedFamilies = analysis.fixedLength.collapsedWorkloadFamilies;
const fixedSwept = analysis.fixedLength.bothSidesMoreSweptPairRecords;
const agentSessions = analysis.agentx.sessionCapacityAll;
const differences = analysis.agentx.differencesAndSweepCoverage;

const markdown = `# InferenceX unified-versus-split scaling analysis

Generated by \`scripts/inferencex/analyze-scaling.js\` from the frozen comparison and qualified-audit outputs. Here, **unified** means one measured larger allocation. **Split** means the measured smaller deployment multiplied by the integer copy count at the same total GPU budget.

## Result in one paragraph

The data does not support a universal winner. The broad fixed-length view leans unified at its selected best-observed points: ${fixedAll.unifiedWins} of ${fixedAll.records} pair records favor unified, with a median gain of ${pct(fixedAll.medianGainPct)}. That headline is not robust enough to use as a planning multiplier. The ${fixedAll.records} records come from only ${analysis.scope.fixedWorkloadFamilies} exact workload families; after giving each family one median vote, the split remains unified-leaning at ${ratio(fixedFamilies)}, with a median of ${pct(fixedFamilies.medianGainPct)}. However, in the ${fixedSwept.records} fixed pair records where both exact configurations have more than two observed concurrency settings, unified wins ${fixedSwept.unifiedWins} and split wins ${fixedSwept.splitWins}, with a median of ${pct(fixedSwept.medianGainPct)}. This sensitivity to sweep coverage, plus strong model-to-model variation, means deployment-specific saturation testing matters more than the overall average.

For AgentX session capacity under the configured latency limits, ${agentSessions.unifiedWins} of ${agentSessions.records} selected comparisons favor unified, ${agentSessions.splitWins} favor split and ${agentSessions.ties} ties; the median selected-point difference is ${pct(agentSessions.medianGainPct)}. But all ${differences.records} have a sparse concurrency sweep on at least one side, only ${analysis.scope.agentxModels.length} model keys and ${analysis.scope.agentxModelHardwareFamilies} model/hardware families are represented, and none proves maximum capacity. The closest controlled comparison, DeepSeek V4 Pro GB200 ${closestControlled.comparison}, has ${pct(closestControlled.sessionGainPct)} session gain and ${pct(closestControlled.throughputGainPct)} throughput gain: essentially linear session scaling with a small unified throughput edge.

## Fixed-length throughput sensitivity

${table(
  ['View', 'Records', 'Unified / tie / split', 'Unified win rate', 'Median gain', 'Middle 50%'],
  [
    ['All best-observed pairs', fixedAll.records, ratio(fixedAll), pct(fixedAll.unifiedWinPct), pct(fixedAll.medianGainPct), `${pct(fixedAll.q25GainPct)} to ${pct(fixedAll.q75GainPct)}`],
    ['One median per workload family', fixedFamilies.records, ratio(fixedFamilies), pct(fixedFamilies.unifiedWinPct), pct(fixedFamilies.medianGainPct), `${pct(fixedFamilies.q25GainPct)} to ${pct(fixedFamilies.q75GainPct)}`],
    ['No speculative decoding', analysis.fixedLength.noSpeculativeDecodingPairRecords.records, ratio(analysis.fixedLength.noSpeculativeDecodingPairRecords), pct(analysis.fixedLength.noSpeculativeDecodingPairRecords.unifiedWinPct), pct(analysis.fixedLength.noSpeculativeDecodingPairRecords.medianGainPct), `${pct(analysis.fixedLength.noSpeculativeDecodingPairRecords.q25GainPct)} to ${pct(analysis.fixedLength.noSpeculativeDecodingPairRecords.q75GainPct)}`],
    ['Two-way splits only', analysis.fixedLength.doublingPairRecords.records, ratio(analysis.fixedLength.doublingPairRecords), pct(analysis.fixedLength.doublingPairRecords.unifiedWinPct), pct(analysis.fixedLength.doublingPairRecords.medianGainPct), `${pct(analysis.fixedLength.doublingPairRecords.q25GainPct)} to ${pct(analysis.fixedLength.doublingPairRecords.q75GainPct)}`],
    ['Both configurations more swept', fixedSwept.records, ratio(fixedSwept), pct(fixedSwept.unifiedWinPct), pct(fixedSwept.medianGainPct), `${pct(fixedSwept.q25GainPct)} to ${pct(fixedSwept.q75GainPct)}`]
  ])}

"More swept" only means more than two observed concurrency settings for both exact selected configurations. It improves context but does not establish saturation or comparable optimization.

## Fixed-length results vary by model

${table(['Model key', 'Records', 'Unified / tie / split', 'Unified win rate', 'Median gain', 'Middle 50%'], modelRows)}

These are record counts, not independent experiment counts. Models with many allocation sizes create many overlapping pair records.

## All latency-qualified AgentX session comparisons

${table(['Model / hardware', 'Large vs split', 'Configured sessions large / split', 'Session gain', 'Throughput gain', 'Unified latency direction', 'Sweep points small / large', 'Source audit'], agentRows)}

Latency direction compares the selected larger point with one measured smaller copy. Split replication does not multiply per-request latency. A larger point can carry more sessions while also using more of the allowed latency budget.

## Evidence shape

- ${analysis.scope.comparisonRecords} policy-specific comparison records exist in total: ${analysis.scope.fixedBestObservedRecords} fixed-length best-throughput records and ${analysis.scope.agentxLatencyQualifiedSessionRecords} latency-qualified AgentX session records, plus AgentX records selected under the other policies.
- In fixed-length best-throughput comparisons, ${analysis.fixedLength.differencesAndSweepCoverage.eitherSweepSparse} of ${analysis.fixedLength.differencesAndSweepCoverage.records} have a sparse sweep on at least one side; software differs in ${analysis.fixedLength.differencesAndSweepCoverage.softwareDiffers}, and dates differ in ${analysis.fixedLength.differencesAndSweepCoverage.datesDiffer}.
- In AgentX session comparisons, ${differences.eitherSweepSparse} of ${differences.records} have a sparse sweep on at least one side; software differs in ${differences.softwareDiffers}, and deployment mode or offload differs in ${differences.deploymentModeDiffers}.
- Source checking verified ${audit.counts.points.verified} of ${audit.counts.points.verified + audit.counts.points.incomplete} unique AgentX points completely and ${audit.counts.pairs.verified} of ${audit.counts.pairs.verified + audit.counts.pairs.incomplete} pairs completely. This verifies provenance, not capacity maxima.

## Practical rule of thumb supported by the data

Use the split fleet as the linear baseline, then require the larger allocation to demonstrate a repeatable advantage under the actual latency target and a comparable saturation sweep. If the result is near parity, splitting is the safer capacity assumption because it already delivers the linear baseline and adds placement, failure-isolation and rollout flexibility. Prefer the larger allocation when it repeatedly delivers materially better per-GPU throughput or qualifying session capacity, or when the model/request cannot fit the smaller unit. Prefer split when its multiplied smaller result wins, when latency or isolation matters more than pooling, or when the apparent unified gain depends on an under-tested smaller baseline.

Do not use the largest percentages in this dataset as expected scaling factors. They are selected-point differences, and several use one- or two-point smaller sweeps, different software, or aggregated-versus-disaggregated serving. The correct operational question is: **at the same total GPUs and latency SLA, does the larger allocation beat the measured linear split baseline after both sides have been tuned and swept to their boundary?**

## Interpretation limits

${analysis.interpretationLimits.map(limit => `- ${limit}`).join('\n')}
`;

const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
const csv = [
  Object.keys(agentxRows[0]).map(quote).join(','),
  ...agentxRows.map(row => Object.values(row).map(quote).join(','))
].join('\n') + '\n';

await mkdir(outDir, { recursive: true });
await writeFile(`${outDir}/scaling-analysis.json`, JSON.stringify(analysis, null, 2) + '\n');
await writeFile(`${outDir}/scaling-analysis.md`, markdown);
await writeFile(`${outDir}/scaling-agentx.csv`, csv);

console.log(JSON.stringify({
  output: `${outDir}/scaling-analysis.json`,
  comparisonRecords: analysis.scope.comparisonRecords,
  fixedRecords: fixedAll.records,
  fixedFamilies: fixedFamilies.records,
  agentxRecords: agentSessions.records
}));
