import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const analysis = JSON.parse(readFileSync('reports/inferencex/scaling-analysis.json'));

test('scaling analysis covers the frozen comparison corpus', () => {
  assert.equal(analysis.scope.comparisonRecords, 318);
  assert.equal(analysis.scope.fixedBestObservedRecords, 254);
  assert.equal(analysis.scope.fixedWorkloadFamilies, 56);
  assert.equal(analysis.scope.agentxLatencyQualifiedSessionRecords, 15);
  assert.equal(analysis.agentx.rows.length, 15);
});

test('scaling sensitivity and closest controlled comparison remain explicit', () => {
  assert.equal(analysis.fixedLength.bothSidesMoreSweptPairRecords.records, 21);
  assert.equal(analysis.agentx.differencesAndSweepCoverage.eitherSweepSparse, 15);
  assert.equal(analysis.agentx.closestControlled.id, 'latency_qualified_sessions:439969:439975:2');
  assert.equal(analysis.agentx.closestControlled.sessionGainPct, 0);
  assert.ok(Math.abs(analysis.agentx.closestControlled.throughputGainPct - 4.810170088872501) < 1e-12);
});

test('AgentX gain signs agree between selected session capacity and throughput', () => {
  for (const row of analysis.agentx.rows) {
    if (row.sessionGainPct === 0) continue;
    assert.equal(Math.sign(row.sessionGainPct), Math.sign(row.throughputGainPct));
  }
});
