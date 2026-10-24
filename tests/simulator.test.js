import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  calculateB200Comparison,
  calculateConnectedDomain,
  calculateDau,
  calculateH200Capacity,
  calculateH200SupplyComparison,
  calculateLocalDomain,
  calculateMemory,
  calculateServingUnits,
  calculateServerDay,
} from "../app.js";

const fixture = JSON.parse(
  await readFile(new URL("../data/glm-5.2-h200-mvp.json", import.meta.url), "utf8")
);
const b200Fixture = JSON.parse(
  await readFile(new URL("../data/glm-5.2-b200-fragmentation.json", import.meta.url), "utf8")
);
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

assert.deepEqual(
  fixture.presets.map((preset) => preset.id),
  ["unified-16", "split-8-8", "split-10-6", "split-12-4"],
  "The MVP must expose only the four corrected allocation presets"
);

for (const preset of fixture.presets) {
  assert.equal(
    preset.primaryServers + preset.secondaryServers,
    fixture.hardware.totalServers,
    `${preset.id} must allocate all 16 servers`
  );
}

assert.equal(
  fixture.presets.some((preset) => preset.id.includes("8-4")),
  false,
  "The superseded 8 + 4 preset must remain absent"
);

const memory = calculateMemory(fixture.hardware, fixture.assumptions);
assert.equal(memory.rawPerWorker, 1128);
assert.equal(memory.usablePerWorker, 1015.2);
assert.ok(Math.abs(memory.kvPerWorker - 122.2) < 1e-9);
assert.equal(memory.isFeasible, true);

const heavierMemory = calculateMemory(fixture.hardware, {
  ...fixture.assumptions,
  runtimeOverheadGb: 50,
  safetyReserveGb: 25
});
assert.ok(heavierMemory.kvPerWorker < memory.kvPerWorker);
const infeasibleMemory = calculateMemory(fixture.hardware, {
  ...fixture.assumptions,
  runtimeOverheadGb: 200
});
assert.equal(infeasibleMemory.isFeasible, false);
assert.ok(infeasibleMemory.shortfall > 0);
assert.equal(calculateH200Capacity(0, fixture.servingModel), 0);
assert.ok(Math.abs(calculateH200Capacity(1, fixture.servingModel) - 32 / 3) < 1e-9);
assert.ok(Math.abs(calculateH200Capacity(2, fixture.servingModel) - 64 / 3) < 1e-9);
assert.equal(calculateH200Capacity(3, fixture.servingModel), 32);
assert.ok(Math.abs(calculateH200Capacity(16, fixture.servingModel) - 512 / 3) < 1e-9);

assert.deepEqual(fixture.clusterComparisons, [1, 2, 3]);
const splitSupply = calculateH200SupplyComparison(16, 8, 8, fixture.servingModel);
assert.ok(Math.abs(splitSupply.unifiedCapacity - 512 / 3) < 1e-9);
assert.ok(Math.abs(splitSupply.selectedCapacity - splitSupply.unifiedCapacity) < 1e-9);
assert.equal(splitSupply.capacityGap, 0);
const penalizedSplit = calculateH200SupplyComparison(16, 8, 8, {
  ...fixture.servingModel,
  splitDomainEfficiency: 0.9
});
assert.ok(penalizedSplit.capacityGap > 0);
assert.ok(Math.abs(penalizedSplit.selectedCapacity - splitSupply.selectedCapacity * 0.9) < 1e-9);
const lowerEfficiency = calculateH200Capacity(3, {
  ...fixture.servingModel,
  replicaEfficiency: 0.8
});
assert.equal(lowerEfficiency, 25.6);
assert.equal(
  calculateH200Capacity(3, fixture.servingModel),
  32,
  "The published three-worker point must remain exact at 100% calibration"
);

assert.equal(b200Fixture.hardware.gpusPerServer, 8);
assert.equal(b200Fixture.hardware.totalServers, 16);

const servingUnits = calculateServingUnits(b200Fixture.defaults.servingModel);
assert.equal(servingUnits.aggregatedGpuCount, 16);
assert.equal(servingUnits.aggregatedWorkerConcurrency, 16);
assert.equal(servingUnits.disaggregatedGpuCount, 20);

const connected16 = calculateConnectedDomain(16, 8, b200Fixture.defaults.servingModel);
assert.equal(connected16.disaggregatedUnits, 6);
assert.equal(connected16.aggregatedWorkers, 2);
assert.equal(connected16.capacity, 800);

const lowFabric16 = calculateConnectedDomain(16, 8, {
  ...b200Fixture.defaults.servingModel,
  roceTransferFactor: 0.5
});
assert.equal(lowFabric16.disaggregatedUnits, 0);
assert.equal(lowFabric16.aggregatedWorkers, 32);
assert.equal(lowFabric16.capacity, 512);

const connected12 = calculateConnectedDomain(12, 8, b200Fixture.defaults.servingModel);
assert.equal(connected12.disaggregatedUnits, 4);
assert.equal(connected12.aggregatedWorkers, 4);
assert.equal(connected12.capacity, 576);

const disconnected2 = calculateLocalDomain(2, 8, b200Fixture.defaults.servingModel);
assert.equal(disconnected2.aggregatedWorkers, 4);
assert.equal(disconnected2.capacity, 64);

const comparison = calculateB200Comparison(b200Fixture.defaults);
assert.equal(comparison.unifiedCapacity, 800);
assert.equal(comparison.fragmentedAggregateCapacity, 704);
assert.equal(comparison.capacityGap, 96);
assert.equal(comparison.capacityRetained, 0.88);
assert.ok(Math.abs(comparison.unifiedDau - 3180.1242236024845) < 1e-9);
assert.ok(Math.abs(comparison.fragmentedDau - 2798.509316770186) < 1e-9);
assert.ok(Math.abs(comparison.dauGap - 381.6149068322984) < 1e-9);
assert.ok(Math.abs(comparison.equivalentServers - 1.92) < 1e-9);
assert.ok(Math.abs(comparison.serverDay - 1651.2) < 1e-9);
assert.ok(Math.abs(comparison.dailyCost - 3170.304) < 1e-9);

const dau50 = calculateDau(50, b200Fixture.defaults.behavior);
const dau100 = calculateDau(100, b200Fixture.defaults.behavior);
assert.ok(Math.abs(dau100.dau - 2 * dau50.dau) < 1e-9);
assert.ok(Math.abs(dau50.multiplier - 3.9751552795031055) < 1e-9);
const morePrompts = calculateDau(50, {
  ...b200Fixture.defaults.behavior,
  promptsPerSession: b200Fixture.defaults.behavior.promptsPerSession + 1
});
assert.ok(morePrompts.dau < dau50.dau, "More prompts per session must reduce DAU turnover");

assert.ok(
  Math.abs(calculateServerDay({
    ...b200Fixture.defaults.cost,
    mode: "owned"
  }) - 511.09589041095893) < 1e-9
);
assert.equal(
  calculateServerDay({ ...b200Fixture.defaults.cost, mode: "custom" }),
  b200Fixture.defaults.cost.customServerDay
);

for (const requiredId of [
  "tab-h200",
  "tab-clusters",
  "tab-b200",
  "panel-h200",
  "panel-clusters",
  "panel-b200",
  "b-equivalent-servers",
  "b-lost-dau",
  "b-cost-day",
  "b-capacity-chart",
  "b-unified-capacity",
  "b-fragmented-capacity",
  "h-supply-unified",
  "h-supply-selected",
  "h-supply-gap",
  "h-memory-live",
  "h-serving-live",
  "h200-reset",
  "h-split-efficiency"
]) {
  assert.match(html, new RegExp(`id=["']${requiredId}["']`), `${requiredId} must exist in the UI`);
}
assert.match(html, /id=["']b-behavior-live["']/, "Behavior controls need colocated live output");
assert.match(html, /id=["']b-cost-live["']/, "Cost controls need colocated live output");
assert.doesNotMatch(html, /id=["']input-gpus["']/, "The fixed TP8\/EP8 H200 recipe must not expose GPU count as an independent control");
assert.match(await readFile(new URL("../app.js", import.meta.url), "utf8"), /edited assumption/, "Edited H200 values must lose their published-default status");

const ids = [...html.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, "HTML ids must be unique");

console.log("Simulator invariants and calculations passed.");
