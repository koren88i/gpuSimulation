const FIXTURE_URL = "data/glm-5.2-h200-mvp.json";
const B200_FIXTURE_URL = "data/glm-5.2-b200-fragmentation.json";
const MAX_VISIBLE_SESSION_CELLS = 72;
const PHASES = [
  ["hardware", "Discovering H200 workers", 520],
  ["allocate", "Assigning serving pools", 620],
  ["weights", "Reserving model weights", 720],
  ["reserve", "Protecting runtime headroom", 650],
  ["kv", "Revealing KV budget", 680],
  ["sessions", "Admitting sessions", 1550],
  ["complete", "Allocation complete", 0]
];

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const precise = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});
const currencyPrecise = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

let fixture;
let b200Fixture;
let state;
let b200State;
let animationTimers = [];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function calculateMemory(hardware, assumptions) {
  const rawPerWorker = hardware.gpusPerServer * hardware.hbmPerGpuGb;
  const usablePerWorker = rawPerWorker * assumptions.usableMemoryFraction;
  const committedPerWorker =
    assumptions.modelWeightMemoryPerWorkerGb +
    assumptions.runtimeOverheadGb +
    assumptions.safetyReserveGb;
  const kvPerWorker = Math.max(0, usablePerWorker - committedPerWorker);
  const operationalReserve = Math.max(0, rawPerWorker - usablePerWorker);
  const shortfall = Math.max(0, committedPerWorker - usablePerWorker);

  return {
    rawPerWorker,
    usablePerWorker,
    committedPerWorker,
    kvPerWorker,
    operationalReserve,
    shortfall,
    isFeasible: shortfall === 0,
    weightPercent: clampPercent(assumptions.modelWeightMemoryPerWorkerGb / rawPerWorker),
    reservePercent: clampPercent(
      (operationalReserve + assumptions.runtimeOverheadGb + assumptions.safetyReserveGb) /
        rawPerWorker
    ),
    kvPercent: clampPercent(kvPerWorker / rawPerWorker)
  };
}

export function calculateH200Capacity(serverCount, servingModel) {
  if (
    serverCount <= 0 ||
    servingModel.observedConcurrency <= 0 ||
    servingModel.observedWorkers <= 0 ||
    servingModel.replicaEfficiency <= 0
  ) return 0;
  return (
    servingModel.observedConcurrency *
    (serverCount / servingModel.observedWorkers) *
    servingModel.replicaEfficiency
  );
}

export function calculateH200SupplyComparison(totalServers, primaryServers, secondaryServers, servingModel) {
  const unifiedCapacity = calculateH200Capacity(totalServers, servingModel);
  const splitFactor = secondaryServers > 0 ? (servingModel.splitDomainEfficiency ?? 1) : 1;
  const primaryCapacity = calculateH200Capacity(primaryServers, servingModel) * splitFactor;
  const secondaryCapacity = calculateH200Capacity(secondaryServers, servingModel) * splitFactor;
  const selectedCapacity = primaryCapacity + secondaryCapacity;
  const rawGap = unifiedCapacity - selectedCapacity;
  return {
    unifiedCapacity,
    primaryCapacity,
    secondaryCapacity,
    selectedCapacity,
    capacityGap: rawGap > 1e-9 ? rawGap : 0
  };
}

export function calculateServingUnits(servingModel) {
  const aggregatedGpuCount =
    servingModel.aggregated.workers * servingModel.aggregated.gpusPerWorker;
  const aggregatedWorkerConcurrency =
    servingModel.aggregated.observedConcurrency / servingModel.aggregated.workers;
  const disaggregatedGpuCount =
    servingModel.disaggregated.prefillWorkers *
      servingModel.disaggregated.prefillGpusPerWorker +
    servingModel.disaggregated.decodeWorkers *
      servingModel.disaggregated.decodeGpusPerWorker;
  return { aggregatedGpuCount, aggregatedWorkerConcurrency, disaggregatedGpuCount };
}

export function calculateConnectedDomain(serverCount, gpusPerServer, servingModel) {
  const totalGpus = serverCount * gpusPerServer;
  const units = calculateServingUnits(servingModel);
  let best = { capacity: -1, disaggregatedUnits: 0, aggregatedWorkers: 0, unusedGpus: 0 };
  const maxDisaggregatedUnits = Math.floor(totalGpus / units.disaggregatedGpuCount);

  for (let disaggregatedUnits = 0; disaggregatedUnits <= maxDisaggregatedUnits; disaggregatedUnits += 1) {
    const remainingGpus = totalGpus - disaggregatedUnits * units.disaggregatedGpuCount;
    const aggregatedWorkers = Math.floor(
      remainingGpus / servingModel.aggregated.gpusPerWorker
    );
    const capacity =
      disaggregatedUnits *
        servingModel.disaggregated.observedConcurrency *
        servingModel.roceTransferFactor +
      aggregatedWorkers * units.aggregatedWorkerConcurrency;
    if (capacity > best.capacity) {
      best = {
        capacity,
        disaggregatedUnits,
        aggregatedWorkers,
        unusedGpus:
          remainingGpus - aggregatedWorkers * servingModel.aggregated.gpusPerWorker
      };
    }
  }

  return { serverCount, totalGpus, ...best };
}

export function calculateLocalDomain(serverCount, gpusPerServer, servingModel) {
  const units = calculateServingUnits(servingModel);
  const workersPerServer = Math.floor(
    gpusPerServer / servingModel.aggregated.gpusPerWorker
  );
  const aggregatedWorkers = serverCount * workersPerServer;
  return {
    serverCount,
    totalGpus: serverCount * gpusPerServer,
    disaggregatedUnits: 0,
    aggregatedWorkers,
    unusedGpus:
      serverCount * (gpusPerServer - workersPerServer * servingModel.aggregated.gpusPerWorker),
    capacity: aggregatedWorkers * units.aggregatedWorkerConcurrency
  };
}

export function calculateDau(concurrency, behavior) {
  const sessionDurationSeconds =
    behavior.promptsPerSession * behavior.responseSeconds +
    Math.max(0, behavior.promptsPerSession - 1) * behavior.betweenPromptsSeconds;
  if (sessionDurationSeconds <= 0 || behavior.sessionsPerDau <= 0) {
    return { dau: 0, multiplier: 0, sessionDurationSeconds };
  }
  const occupiedSeconds = behavior.activeHoursPerDay * 3600 * behavior.targetUtilization;
  const multiplier = occupiedSeconds / sessionDurationSeconds / behavior.sessionsPerDau;
  return { dau: concurrency * multiplier, multiplier, sessionDurationSeconds };
}

export function calculateServerDay(cost) {
  if (cost.mode === "owned") {
    return (cost.purchasePrice * (1 + cost.facilityUplift)) / (cost.amortizationYears * 365);
  }
  if (cost.mode === "custom") return cost.customServerDay;
  return cost.cloudHourly * 24;
}

export function calculateB200Comparison(config) {
  const unified = calculateConnectedDomain(16, 8, config.servingModel);
  const primary = calculateConnectedDomain(12, 8, config.servingModel);
  const local = calculateLocalDomain(2, 8, config.servingModel);
  const unifiedCapacity = unified.capacity;
  const primaryCapacity = primary.capacity;
  const disconnectedTwoServerCapacity = local.capacity;
  const fragmentedAggregateCapacity =
    primaryCapacity + disconnectedTwoServerCapacity * 2;
  const capacityGap = Math.max(0, unifiedCapacity - fragmentedAggregateCapacity);
  const equivalentServers = unifiedCapacity > 0
    ? (capacityGap / unifiedCapacity) * 16
    : 0;
  const unifiedDau = calculateDau(unifiedCapacity, config.behavior);
  const fragmentedDau = calculateDau(fragmentedAggregateCapacity, config.behavior);
  const dauGap = Math.max(0, unifiedDau.dau - fragmentedDau.dau);
  const serverDay = calculateServerDay(config.cost);
  return {
    unifiedCapacity,
    primaryCapacity,
    disconnectedTwoServerCapacity,
    fragmentedAggregateCapacity,
    capacityGap,
    capacityRetained: unifiedCapacity > 0
      ? fragmentedAggregateCapacity / unifiedCapacity
      : 0,
    equivalentServers,
    unifiedLayout: unified,
    primaryLayout: primary,
    localLayout: local,
    unifiedDau: unifiedDau.dau,
    fragmentedDau: fragmentedDau.dau,
    dauGap,
    dauMultiplier: unifiedDau.multiplier,
    sessionDurationSeconds: unifiedDau.sessionDurationSeconds,
    serverDay,
    dailyCost: equivalentServers * serverDay
  };
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, value * 100));
}

async function init() {
  try {
    const [response, b200Response] = await Promise.all([
      fetch(FIXTURE_URL),
      fetch(B200_FIXTURE_URL)
    ]);
    if (!response.ok || !b200Response.ok) {
      throw new Error(`Fixture request failed (${response.status}/${b200Response.status})`);
    }
    fixture = await response.json();
    b200Fixture = await b200Response.json();
    state = {
      presetId: fixture.defaults.presetId,
      requestedSessions: fixture.defaults.requestedSessions,
      clusterRequestedSessions: fixture.defaults.clusterRequestedSessions,
      hardware: { ...fixture.hardware },
      assumptions: { ...fixture.assumptions },
      servingModel: structuredClone(fixture.servingModel)
    };
    b200State = structuredClone(b200Fixture.defaults);

    bindControls();
    bindTabs();
    bindB200Controls();
    renderPresetControls();
    renderEvidence();
    renderB200Evidence();
    renderB200Topology();
    syncAssumptionInputs();
    syncB200Inputs();
    syncClusterInputs();
    render();
  } catch (error) {
    showError(error);
  }
}

function bindControls() {
  $("#session-slider").addEventListener("input", (event) => {
    state.requestedSessions = Number(event.target.value);
    render();
  });

  $("#replay-button").addEventListener("click", replayAnimation);

  $("#cluster-demand-input").addEventListener("input", (event) => {
    if (!event.target.validity.valid || event.target.value === "") return;
    state.clusterRequestedSessions = Number(event.target.value);
    render();
  });

  const inputMap = {
    "input-utilization": ["assumptions", "usableMemoryFraction", (value) => value / 100],
    "input-weights": ["assumptions", "modelWeightMemoryPerWorkerGb", Number],
    "input-runtime": ["assumptions", "runtimeOverheadGb", Number],
    "input-safety": ["assumptions", "safetyReserveGb", Number],
    "h-observed-ccu": ["servingModel", "observedConcurrency", Number],
    "h-replica-efficiency": ["servingModel", "replicaEfficiency", (value) => value / 100],
    "h-split-efficiency": ["servingModel", "splitDomainEfficiency", (value) => value / 100]
  };

  Object.entries(inputMap).forEach(([id, [group, key, transform]]) => {
    $(`#${id}`).addEventListener("input", (event) => {
      if (!event.target.validity.valid || event.target.value === "") return;
      state[group][key] = transform(Number(event.target.value));
      render();
    });
  });

  $("#h200-reset").addEventListener("click", () => {
    state.assumptions = { ...fixture.assumptions };
    state.servingModel = structuredClone(fixture.servingModel);
    syncAssumptionInputs();
    render();
  });
}

function bindTabs() {
  const tabs = $$("[role='tab']");
  const activate = (tab) => {
    tabs.forEach((item) => {
      const selected = item === tab;
      item.setAttribute("aria-selected", String(selected));
      item.tabIndex = selected ? 0 : -1;
      $(`[data-panel='${item.dataset.tab}']`).hidden = !selected;
    });
    history.replaceState(null, "", `#${tab.dataset.tab}`);
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activate(tab));
    tab.addEventListener("keydown", (event) => {
      let targetIndex = index;
      if (event.key === "ArrowRight") targetIndex = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft") targetIndex = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === "Home") targetIndex = 0;
      else if (event.key === "End") targetIndex = tabs.length - 1;
      else return;
      event.preventDefault();
      tabs[targetIndex].focus();
      activate(tabs[targetIndex]);
    });
  });

  const requestedTab = tabs.find((tab) => `#${tab.dataset.tab}` === window.location.hash);
  if (requestedTab) activate(requestedTab);
}

function bindB200Controls() {
  const controls = {
    "b-agg-concurrency": (value) => { b200State.servingModel.aggregated.observedConcurrency = value; },
    "b-disagg-concurrency": (value) => { b200State.servingModel.disaggregated.observedConcurrency = value; },
    "b-roce-factor": (value) => { b200State.servingModel.roceTransferFactor = value / 100; },
    "b-prompts": (value) => { b200State.behavior.promptsPerSession = value; },
    "b-response-sec": (value) => { b200State.behavior.responseSeconds = value; },
    "b-gap-sec": (value) => { b200State.behavior.betweenPromptsSeconds = value; },
    "b-sessions-dau": (value) => { b200State.behavior.sessionsPerDau = value; },
    "b-active-hours": (value) => { b200State.behavior.activeHoursPerDay = value; },
    "b-utilization": (value) => { b200State.behavior.targetUtilization = value / 100; },
    "b-cloud-hourly": (value) => { b200State.cost.cloudHourly = value; },
    "b-purchase-price": (value) => { b200State.cost.purchasePrice = value; },
    "b-overhead": (value) => { b200State.cost.facilityUplift = value / 100; },
    "b-years": (value) => { b200State.cost.amortizationYears = value; },
    "b-custom-day": (value) => { b200State.cost.customServerDay = value; }
  };

  Object.entries(controls).forEach(([id, update]) => {
    $(`#${id}`).addEventListener("input", (event) => {
      if (!event.target.validity.valid || event.target.value === "") return;
      update(Number(event.target.value));
      renderB200();
    });
  });

  $("#b-cost-mode").addEventListener("change", (event) => {
    b200State.cost.mode = event.target.value;
    renderB200();
  });

  $("#b200-reset").addEventListener("click", () => {
    b200State = structuredClone(b200Fixture.defaults);
    syncB200Inputs();
    renderB200();
  });
}

function syncClusterInputs() {
  $("#cluster-demand-input").value = state.clusterRequestedSessions;
}

function syncB200Inputs() {
  const values = {
    "b-agg-concurrency": b200State.servingModel.aggregated.observedConcurrency,
    "b-disagg-concurrency": b200State.servingModel.disaggregated.observedConcurrency,
    "b-roce-factor": b200State.servingModel.roceTransferFactor * 100,
    "b-prompts": b200State.behavior.promptsPerSession,
    "b-response-sec": b200State.behavior.responseSeconds,
    "b-gap-sec": b200State.behavior.betweenPromptsSeconds,
    "b-sessions-dau": b200State.behavior.sessionsPerDau,
    "b-active-hours": b200State.behavior.activeHoursPerDay,
    "b-utilization": b200State.behavior.targetUtilization * 100,
    "b-cloud-hourly": b200State.cost.cloudHourly,
    "b-purchase-price": b200State.cost.purchasePrice,
    "b-overhead": b200State.cost.facilityUplift * 100,
    "b-years": b200State.cost.amortizationYears,
    "b-custom-day": b200State.cost.customServerDay
  };
  Object.entries(values).forEach(([id, value]) => { $(`#${id}`).value = value; });
  $("#b-cost-mode").value = b200State.cost.mode;
}

function renderB200Topology() {
  const connected = $(".node-grid.sixteen");
  connected.replaceChildren(...Array.from({ length: 16 }, (_, index) => buildB200Node(index + 1, true)));

  const domains = $(".fragment-domains");
  const definitions = [
    { label: "RoCE domain A", count: 12, connected: true, start: 1 },
    { label: "Local domain B · no RoCE", count: 2, connected: false, start: 13 },
    { label: "Local domain C · no RoCE", count: 2, connected: false, start: 15 }
  ];
  domains.replaceChildren(
    ...definitions.map((definition) => {
      const group = document.createElement("div");
      group.className = `domain-group${definition.connected ? " is-connected" : " is-local"}`;
      group.innerHTML = `<span>${definition.label}</span>`;
      const nodes = document.createElement("div");
      nodes.className = "domain-nodes";
      nodes.replaceChildren(
        ...Array.from({ length: definition.count }, (_, index) =>
          buildB200Node(definition.start + index, definition.connected)
        )
      );
      group.append(nodes);
      return group;
    })
  );
}

function buildB200Node(index, connected) {
  const node = document.createElement("span");
  node.className = `b200-node${connected ? " is-connected" : " is-local"}`;
  node.title = `HGX B200 server ${index}: 8 GPUs`;
  node.innerHTML = `<b>${String(index).padStart(2, "0")}</b><i>8×</i>`;
  return node;
}

function renderB200() {
  if (!b200State) return;
  const result = calculateB200Comparison(b200State);
  const capacityRows = [
    {
      label: "16 unified",
      detail: `${result.unifiedLayout.disaggregatedUnits} disagg units + ${result.unifiedLayout.aggregatedWorkers} DTP4 workers`,
      capacity: result.unifiedCapacity,
      dau: result.unifiedDau,
      type: "unified"
    },
    {
      label: "12 + 2 + 2 fragmented",
      detail: `${number.format(result.primaryCapacity)} + ${number.format(result.disconnectedTwoServerCapacity)} + ${number.format(result.disconnectedTwoServerCapacity)} CCU`,
      capacity: result.fragmentedAggregateCapacity,
      dau: result.fragmentedDau,
      type: "fragmented"
    }
  ];
  const scaleMax = Math.max(1, ...capacityRows.map((row) => row.capacity));
  $("#b-capacity-chart").innerHTML = `
    <div class="capacity-chart-head"><span>Topology</span><span>Maximum concurrent capacity</span><span>Derived daily users</span></div>
    ${capacityRows.map((row) => b200CapacityRow(row, scaleMax)).join("")}
    <div class="capacity-summary"><span>Capacity gap</span><strong>${number.format(result.capacityGap)} CCU</strong><strong>${decimal.format(result.dauGap)} DAU</strong></div>`;

  $("#b-capacity-derivation").innerHTML = `
    <div><span>Aggregated unit</span><strong>16 GPUs → ${number.format(b200State.servingModel.aggregated.observedConcurrency)}</strong><small>4 × DTP4 workers · ${precise.format(calculateServingUnits(b200State.servingModel).aggregatedWorkerConcurrency)} sessions/worker</small></div>
    <div><span>Disaggregated unit</span><strong>20 GPUs → ${number.format(b200State.servingModel.disaggregated.observedConcurrency * b200State.servingModel.roceTransferFactor)}</strong><small>3 × 4-GPU prefill + 1 × 8-GPU decode</small></div>
    <div><span>Calculated capacities</span><strong>${number.format(result.unifiedCapacity)} vs ${number.format(result.fragmentedAggregateCapacity)}</strong><small>16 connected vs 12 connected + four local servers</small></div>`;

  $("#b-behavior-live").innerHTML = `
    <div><span>Calculated session length</span><strong>${decimal.format(result.sessionDurationSeconds / 60)} min</strong><small>Prompts × response + gaps</small></div>
    <div><span>DAU multiplier</span><strong>${precise.format(result.dauMultiplier)}×</strong><small>Daily users per concurrent slot</small></div>
    <div><span>Example: 50 slots</span><strong>${number.format(calculateDau(50, b200State.behavior).dau)} DAU</strong><small>Updates with every behavior input</small></div>`;

  $("#b-capacity-gap-label").textContent = `${number.format(result.capacityGap)} CCU · ${decimal.format(result.dauGap)} DAU difference`;
  $("#b-lost-sessions").textContent = number.format(result.capacityGap);
  $("#b-unified-capacity").textContent = `${number.format(result.unifiedCapacity)} CCU`;
  $("#b-unified-dau").textContent = `${decimal.format(result.unifiedDau)} derived DAU`;
  $("#b-fragmented-capacity").textContent = `${number.format(result.fragmentedAggregateCapacity)} CCU`;
  $("#b-fragmented-dau").textContent = `${decimal.format(result.fragmentedDau)} derived DAU`;
  $("#b-equivalent-servers").textContent = precise.format(result.equivalentServers);
  $("#b-lost-dau").textContent = decimal.format(result.dauGap);
  $("#b-cost-day").textContent = currency.format(result.dailyCost);
  $("#b-cost-month").textContent = currency.format(result.dailyCost * 30);
  $("#b-cost-year").textContent = currency.format(result.dailyCost * 365);
  $("#b-server-day-rate").textContent = `at ${currency.format(result.serverDay)}/server-day`;
  $("#b-utilized-percent").textContent = `${decimal.format(result.capacityRetained * 100)}%`;

  const equivalentLabel = result.equivalentServers === 1 ? "server" : "servers";
  $("#b-warehouse-copy").innerHTML = result.capacityGap > 0
    ? `With enough workload to fill both topologies, fragmentation lowers the fleet ceiling by <strong>${number.format(result.capacityGap)} concurrent sessions</strong>, or <strong>${decimal.format(result.dauGap)} modeled DAU</strong>. That gap equals <strong>${precise.format(result.equivalentServers)} eight-GPU HGX B200 ${equivalentLabel}</strong> of unified-fleet capacity—about <strong>${currency.format(result.dailyCost)} per day</strong> on the selected cost basis.`
    : "At the current serving anchors, both topologies have the same modeled capacity ceiling.";

  const basisLabels = {
    cloud: "CoreWeave on-demand anchor",
    owned: `Owned: purchase + ${number.format(b200State.cost.facilityUplift * 100)}% uplift`,
    custom: "Custom server-day"
  };
  $("#b-cost-basis-label").textContent = basisLabels[b200State.cost.mode];
  $$('[data-cost-field]').forEach((label) => {
    const active = label.dataset.costField === b200State.cost.mode;
    label.classList.toggle("is-inactive", !active);
    const input = $("input", label);
    input.disabled = !active;
    input.setAttribute("aria-disabled", String(!active));
  });

  const costFormula = b200State.cost.mode === "cloud"
    ? `${currencyPrecise.format(b200State.cost.cloudHourly)} × 24 hours`
    : b200State.cost.mode === "owned"
      ? `${currency.format(b200State.cost.purchasePrice)} × ${precise.format(1 + b200State.cost.facilityUplift)} ÷ (${precise.format(b200State.cost.amortizationYears)} years × 365)`
      : "Direct custom server-day rate";
  $("#b-cost-live").innerHTML = `
    <div><span>Active formula</span><strong>${costFormula}</strong><small>${basisLabels[b200State.cost.mode]}</small></div>
    <div><span>Calculated server-day</span><strong>${currency.format(result.serverDay)}</strong><small>One 8-GPU HGX B200</small></div>
    <div><span>Current fragmentation value</span><strong>${currency.format(result.dailyCost)} / day</strong><small>${precise.format(result.equivalentServers)} equivalent B200 servers</small></div>`;
  $("#b-dau-multiplier").textContent = `${precise.format(result.dauMultiplier)} DAU / concurrent slot`;
  $("#b-session-duration").textContent = `${decimal.format(result.sessionDurationSeconds / 60)} min/session`;
  $("#b-dau-examples").innerHTML = [50, 100, Math.round(result.unifiedCapacity)]
    .map((concurrency) => `<article><span>${number.format(concurrency)} concurrent</span><strong>${number.format(calculateDau(concurrency, b200State.behavior).dau)} DAU</strong></article>`)
    .join("");
}

function b200CapacityRow(row, scaleMax) {
  return `<article class="capacity-row ${row.type}">
    <div><strong>${row.label}</strong><span>${row.detail}</span></div>
    <div class="capacity-track-wrap"><div class="capacity-track"><span style="width:${(row.capacity / scaleMax) * 100}%"></span></div><small>${number.format(row.capacity)} maximum concurrent sessions</small></div>
    <div class="capacity-dau"><strong>${decimal.format(row.dau)} DAU</strong><span>at current behavior settings</span></div>
  </article>`;
}

function renderB200Evidence() {
  const container = $("#b200-evidence-grid");
  container.replaceChildren(
    ...b200Fixture.evidence.map((item) => {
      const card = document.createElement("article");
      card.className = `evidence-card ${item.kind === "editable" ? "is-estimate" : ""}`;
      const source = item.sourceUrl
        ? `<a href="${item.sourceUrl}" target="_blank" rel="noreferrer">${item.source} ↗</a>`
        : `<span class="source-text">${item.source}</span>`;
      card.innerHTML = `<span class="evidence-status">${item.status}</span><p class="evidence-field">${item.label}</p><p class="evidence-value">${item.value}</p><p class="evidence-note">${item.note}</p>${source}`;
      return card;
    })
  );
}

function renderPresetControls() {
  const container = $("#preset-options");
  container.replaceChildren(
    ...fixture.presets.map((preset) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = preset.label;
      button.dataset.presetId = preset.id;
      button.setAttribute("aria-pressed", String(preset.id === state.presetId));
      button.title = preset.description;
      button.addEventListener("click", () => {
        if (state.presetId === preset.id) return;
        state.presetId = preset.id;
        renderPresetControls();
        render();
        replayAnimation();
      });
      return button;
    })
  );
}

function render() {
  const preset = fixture.presets.find((item) => item.id === state.presetId);
  const memory = calculateMemory(state.hardware, state.assumptions);
  const totalServers = preset.primaryServers + preset.secondaryServers;
  const supply = memory.isFeasible
    ? calculateH200SupplyComparison(
        totalServers,
        preset.primaryServers,
        preset.secondaryServers,
        state.servingModel
      )
    : {
        unifiedCapacity: 0,
        primaryCapacity: 0,
        secondaryCapacity: 0,
        selectedCapacity: 0,
        capacityGap: 0
      };
  const totalGpus = totalServers * state.hardware.gpusPerServer;
  const totalRawHbm = totalGpus * state.hardware.hbmPerGpuGb;
  const totalKv = totalServers * memory.kvPerWorker;

  $("#fleet-servers").textContent = number.format(totalServers);
  $("#fleet-gpus").textContent = number.format(totalGpus);
  $("#fleet-hbm").textContent = number.format(totalRawHbm);
  $("#fleet-kv").textContent = number.format(totalKv);
  $("#session-output").textContent = number.format(state.requestedSessions);

  renderFormula(memory);
  renderH200Calibration(memory, supply, preset);
  renderH200Supply(supply, preset);
  renderPools(preset, memory, supply);
  renderSessionComparison(preset, supply);
  renderInterpretation(preset, supply);
  renderClusterComparison(memory);
  syncClusterInputs();
  renderB200();
  renderEvidence();
}

function renderH200Calibration(memory, supply, preset) {
  const perWorker = state.servingModel.observedConcurrency / state.servingModel.observedWorkers;
  $("#h-memory-live").innerHTML = memory.isFeasible
    ? `<div><span>Per-worker KV headroom</span><strong>${decimal.format(memory.kvPerWorker)} GB</strong><small>Usable HBM − weights − workspace − safety</small></div>
       <div><span>Fleet KV headroom</span><strong>${number.format(memory.kvPerWorker * state.hardware.totalServers)} GB</strong><small>Memory output only; not converted into sessions</small></div>`
    : `<div class="is-warning"><span>Configuration infeasible</span><strong>${decimal.format(memory.shortfall)} GB short</strong><small>Committed memory exceeds usable HBM per worker; serving capacity is set to zero.</small></div>`;

  $("#h-serving-live").innerHTML = `
    <div><span>Normalized worker rate</span><strong>${precise.format(perWorker)} CCU</strong><small>${number.format(state.servingModel.observedConcurrency)} observed ÷ ${number.format(state.servingModel.observedWorkers)} workers</small></div>
    <div><span>Unified fleet formula</span><strong>${number.format(state.servingModel.observedConcurrency)} ÷ ${number.format(state.servingModel.observedWorkers)} × 16 × ${number.format(state.servingModel.replicaEfficiency * 100)}%</strong><small>${decimal.format(supply.unifiedCapacity)} benchmark-normalized CCU</small></div>
    <div><span>Selected allocation</span><strong>${decimal.format(supply.selectedCapacity)} CCU</strong><small>${preset.primaryServers} + ${preset.secondaryServers} servers · ${number.format(state.servingModel.splitDomainEfficiency * 100)}% split efficiency</small></div>`;
}

function renderH200Supply(supply, preset) {
  const selectedLabel = preset.secondaryServers > 0
    ? `${preset.primaryServers} + ${preset.secondaryServers} split`
    : "Selected unified 16";
  $("#h-supply-unified").textContent = decimal.format(supply.unifiedCapacity);
  $("#h-supply-selected-label").textContent = selectedLabel;
  $("#h-supply-selected").textContent = decimal.format(supply.selectedCapacity);
  $("#h-supply-gap").textContent = decimal.format(supply.capacityGap);
  $("#h-supply-equation").textContent = preset.secondaryServers > 0
    ? `${decimal.format(supply.primaryCapacity)} primary + ${decimal.format(supply.secondaryCapacity)} secondary = ${decimal.format(supply.selectedCapacity)} CCU`
    : `${decimal.format(supply.selectedCapacity)} CCU in one scheduling domain`;
}

function renderFormula(memory) {
  $("#formula-gpus").textContent = number.format(state.hardware.gpusPerServer);
  $("#formula-util").textContent = `${number.format(
    state.assumptions.usableMemoryFraction * 100
  )}%`;
  $("#formula-raw").textContent = `${number.format(memory.rawPerWorker)} GB`;
  $("#formula-usable").textContent = `${number.format(memory.usablePerWorker)} GB`;
  $("#formula-committed").textContent = `${number.format(memory.committedPerWorker)} GB`;
  $("#formula-kv").textContent = `${number.format(memory.kvPerWorker)} GB`;
}

function renderPools(preset, memory, supply) {
  const stage = $("#pool-stage");
  const isSplit = preset.secondaryServers > 0;
  stage.classList.toggle("is-split", isSplit);
  stage.style.setProperty("--primary-ratio", `${Math.max(preset.primaryServers, 4)}fr`);
  stage.style.setProperty("--secondary-ratio", `${Math.max(preset.secondaryServers, 4)}fr`);

  const pools = [
    buildPool({
      kind: "primary",
      title: isSplit ? "Primary pool" : "Unified pool",
      subtitle: isSplit ? "Local scheduling domain A" : "One shared scheduling domain",
      serverStart: 1,
      serverCount: preset.primaryServers,
      requested: state.requestedSessions,
      memory,
      capacity: supply.primaryCapacity
    })
  ];

  if (isSplit) {
    pools.push(
      buildPool({
        kind: "secondary",
        title: "Secondary pool",
        subtitle: "Local scheduling domain B",
        serverStart: preset.primaryServers + 1,
        serverCount: preset.secondaryServers,
        requested: 0,
        memory,
        capacity: supply.secondaryCapacity
      })
    );
  }

  const currentPhase = stage.dataset.phase || "complete";
  stage.replaceChildren(...pools);
  stage.dataset.phase = currentPhase;

  const primaryCapacity = supply.primaryCapacity;
  const waiting = Math.max(0, state.requestedSessions - Math.floor(primaryCapacity));
  $("#boundary-note").hidden = !(isSplit && waiting > 0 && preset.secondaryServers > 0);
}

function buildPool({ kind, title, subtitle, serverStart, serverCount, requested, memory, capacity }) {
  const capacitySlots = Math.floor(capacity);
  const admitted = Math.min(requested, capacitySlots);
  const waiting = Math.max(0, requested - capacitySlots);

  const pool = document.createElement("section");
  pool.className = `pool pool-${kind}`;
  pool.dataset.serverCount = String(serverCount);
  pool.setAttribute("aria-label", `${title}: ${serverCount} servers`);

  const header = document.createElement("div");
  header.className = "pool-header";
  header.innerHTML = `
    <div>
      <span class="pool-kicker">${subtitle}</span>
      <h3>${title}</h3>
    </div>
    <div class="pool-totals">
      <strong>${number.format(serverCount)} servers · ${number.format(
        serverCount * state.hardware.gpusPerServer
      )} GPUs</strong>
      <span>${number.format(serverCount * memory.rawPerWorker)} GB raw HBM</span>
    </div>
  `;

  const serverGrid = document.createElement("div");
  serverGrid.className = "server-grid";
  for (let index = 0; index < serverCount; index += 1) {
    serverGrid.append(buildServer(serverStart + index, memory));
  }

  const capacityPanel = document.createElement("div");
  capacityPanel.className = "capacity-panel";
  const poolKv = serverCount * memory.kvPerWorker;
  capacityPanel.innerHTML = `
    <div class="capacity-summary">
      <div>
        <span>Weight footprint</span>
        <strong>${number.format(serverCount * state.assumptions.modelWeightMemoryPerWorkerGb)}</strong>
        <small>GB aggregate</small>
      </div>
      <div>
        <span>KV headroom</span>
        <strong>${number.format(poolKv)}</strong>
        <small>GB modeled</small>
      </div>
      <div>
        <span>Serving capacity</span>
        <strong>${decimal.format(capacity)}</strong>
        <small>benchmark-normalized CCU*</small>
      </div>
      <div>
        <span>${requested > 0 ? "Waiting" : "Demand assigned"}</span>
        <strong>${number.format(waiting)}</strong>
        <small>${requested > 0 ? "sessions" : "sessions"}</small>
      </div>
    </div>
  `;

  const lane = document.createElement("div");
  lane.className = "session-lane";
  const label = document.createElement("span");
  label.className = "session-lane-label";
  label.textContent = requested
    ? `${number.format(admitted)} admitted · ${number.format(waiting)} waiting`
    : `${decimal.format(capacity)} benchmark-normalized CCU available locally`;
  lane.append(label, buildSessionCells({ requested, capacity: capacitySlots, admitted, waiting }));
  capacityPanel.append(lane);

  pool.append(header, serverGrid, capacityPanel);
  return pool;
}

function buildServer(serverNumber, memory) {
  const fragment = $("#server-template").content.cloneNode(true);
  $(".server-number", fragment).textContent = `S${String(serverNumber).padStart(2, "0")}`;
  $(".server-kv", fragment).textContent = `${decimal.format(memory.kvPerWorker)} GB KV`;

  const gpuGrid = $(".gpu-grid", fragment);
  gpuGrid.setAttribute("aria-label", `${state.hardware.gpusPerServer} H200 GPUs`);
  for (let index = 0; index < state.hardware.gpusPerServer; index += 1) {
    const chip = document.createElement("span");
    chip.className = "gpu-chip";
    chip.title = `H200 GPU ${index + 1}`;
    gpuGrid.append(chip);
  }

  $(".memory-weight", fragment).style.width = `${memory.weightPercent}%`;
  $(".memory-reserve", fragment).style.width = `${memory.reservePercent}%`;
  $(".memory-kv", fragment).style.width = `${memory.kvPercent}%`;
  return fragment;
}

function buildSessionCells({ requested, capacity, admitted, waiting }) {
  const container = document.createElement("div");
  container.className = "session-cells";
  const free = Math.max(0, capacity - admitted);
  const desiredCells = requested > 0 ? admitted + waiting : free;
  const visibleCells = Math.min(desiredCells, MAX_VISIBLE_SESSION_CELLS);

  for (let index = 0; index < visibleCells; index += 1) {
    const cell = document.createElement("span");
    if (requested === 0) {
      cell.className = "session-cell is-free";
      cell.title = "Available benchmark-normalized CCU slot";
    } else if (index < admitted) {
      cell.className = "session-cell is-admitted";
      cell.title = "Session admitted to local KV budget";
    } else {
      cell.className = "session-cell is-waiting";
      cell.title = "Session waiting beyond local modeled budget";
    }
    cell.style.setProperty("--cell-index", String(index));
    container.append(cell);
  }

  if (desiredCells > visibleCells) {
    const overflow = document.createElement("span");
    overflow.className = "cell-overflow-label";
    overflow.textContent = `+${number.format(desiredCells - visibleCells)}`;
    container.append(overflow);
  }

  if (desiredCells === 0) {
    const empty = document.createElement("span");
    empty.className = "cell-overflow-label";
    empty.textContent = "No sessions assigned";
    container.append(empty);
  }

  return container;
}

function renderInterpretation(preset, supply) {
  const primarySlots = Math.floor(supply.primaryCapacity);
  const admitted = Math.min(state.requestedSessions, primarySlots);
  const waiting = Math.max(0, state.requestedSessions - primarySlots);
  const isSplit = preset.secondaryServers > 0;

  if (waiting > 0 && isSplit) {
    $("#result-title").textContent = "Total supply is unchanged; routing is constrained.";
    $("#result-copy").textContent =
      "The selected split preserves the benchmark-normalized fleet ceiling, but primary-routed sessions cannot automatically consume the secondary scheduler’s capacity.";
  } else if (waiting > 0) {
    $("#result-title").textContent = "The unified benchmark-normalized ceiling is full.";
    $("#result-copy").textContent =
      "All workers participate in one routing domain, but the selected workload exceeds the capacity normalized from NVIDIA’s published operating point.";
  } else if (isSplit) {
    $("#result-title").textContent = "The selected load fits inside the primary pool.";
    $("#result-copy").textContent =
      "The split has the same modeled total supply as unified, while each scheduler retains its own independent serving ceiling.";
  } else {
    $("#result-title").textContent = "The selected load fits inside one shared domain.";
    $("#result-copy").textContent =
      "All sixteen workers are available to the same request scheduler at the benchmark-normalized fleet ceiling.";
  }

  $("#result-admitted").textContent = number.format(admitted);
  $("#result-waiting").textContent = number.format(waiting);
  $("#result-secondary").textContent = isSplit ? decimal.format(supply.secondaryCapacity) : "—";
}

function renderSessionComparison(preset, supply) {
  const container = $("#session-comparison");
  const totalServers = preset.primaryServers + preset.secondaryServers;
  const rows = [
    {
      label: `Unified ${totalServers}`,
      detail: "All primary demand can reach all workers",
      capacity: supply.unifiedCapacity,
      requested: state.requestedSessions,
      type: "unified"
    }
  ];

  if (preset.secondaryServers > 0) {
    rows.push({
      label: `Primary ${preset.primaryServers}`,
      detail: "Sessions routed here",
      capacity: supply.primaryCapacity,
      requested: state.requestedSessions,
      type: "primary"
    });
    rows.push({
      label: `Secondary ${preset.secondaryServers}`,
      detail: "No primary demand routed",
      capacity: supply.secondaryCapacity,
      requested: 0,
      type: "secondary"
    });
  }

  const scaleMax = Math.max(
    state.requestedSessions,
    ...rows.map((row) => row.capacity),
    1
  );
  container.innerHTML = `
    <div class="session-comparison-head">
      <div>
        <span>Routing stress test</span>
        <strong>${number.format(state.requestedSessions)} sessions target the primary workload</strong>
      </div>
      <div class="session-bar-legend">
        <span><i class="capacity-key"></i> Capacity</span>
        <span><i class="admitted-key"></i> Admitted</span>
        <span><i class="demand-key"></i> Demand</span>
      </div>
    </div>
    <div class="session-comparison-rows">
      ${rows.map((row) => sessionComparisonRow(row, scaleMax)).join("")}
    </div>
    <p class="session-comparison-note">* CCU is normalized from NVIDIA’s three-worker H200 operating point. The 16-worker result is an editable DP estimate, not a measured fleet curve.</p>
  `;
}

function sessionComparisonRow(row, scaleMax) {
  const capacitySlots = Math.floor(row.capacity);
  const admitted = Math.min(row.requested, capacitySlots);
  const waiting = Math.max(0, row.requested - capacitySlots);
  const capacityWidth = (row.capacity / scaleMax) * 100;
  const admittedWidth = (admitted / scaleMax) * 100;
  const demandPosition = (row.requested / scaleMax) * 100;
  const status = row.requested === 0
    ? `${number.format(row.capacity)} available locally`
    : `${number.format(admitted)} admitted · ${number.format(waiting)} waiting`;

  return `
    <div class="session-comparison-row ${row.type}">
      <div class="session-row-label">
        <strong>${row.label}</strong>
        <span>${row.detail}</span>
      </div>
      <div class="session-bar-wrap">
        <div class="session-capacity-track">
          <span class="session-capacity-fill" style="width: ${capacityWidth}%"></span>
          <span class="session-admitted-fill" style="width: ${admittedWidth}%"></span>
          ${row.requested > 0 ? `<i class="session-demand-marker" style="left: min(calc(${demandPosition}% - 1px), calc(100% - 2px))"></i>` : ""}
        </div>
        <span class="session-capacity-value">${decimal.format(row.capacity)} CCU*</span>
      </div>
      <strong class="session-row-status${waiting > 0 ? " has-waiting" : ""}">${status}</strong>
    </div>
  `;
}

function renderClusterComparison(memory) {
  const container = $("#cluster-comparison");
  const comparisons = fixture.clusterComparisons || [1, 2, 3];
  const capacities = comparisons.map((serverCount) =>
    memory.isFeasible ? calculateH200Capacity(serverCount, state.servingModel) : 0
  );
  const scaleMax = Math.max(...capacities, state.clusterRequestedSessions, 1);

  container.innerHTML = `
    <div class="cluster-comparison-head">
      <div>
        <span>Benchmark-normalized serving capacity</span>
        <strong>Shared demand: ${number.format(state.clusterRequestedSessions)} sessions</strong>
      </div>
      <span>64K-median agentic trace · H200 aggregated</span>
    </div>
    <div class="cluster-rows">
      ${comparisons
        .map((serverCount, index) =>
          clusterComparisonRow(
            serverCount,
            capacities[index],
            scaleMax,
            memory,
            state.clusterRequestedSessions
          )
        )
        .join("")}
    </div>
  `;
}

function clusterComparisonRow(serverCount, capacity, scaleMax, memory, demand) {
  const capacitySlots = Math.floor(capacity);
  const admitted = Math.min(demand, capacitySlots);
  const waiting = Math.max(0, demand - capacitySlots);
  const capacityWidth = (capacity / scaleMax) * 100;
  const admittedWidth = (admitted / scaleMax) * 100;
  const demandPosition = (demand / scaleMax) * 100;
  const isPublishedPoint =
    serverCount === fixture.servingModel.observedWorkers &&
    state.servingModel.observedConcurrency === fixture.servingModel.observedConcurrency &&
    state.servingModel.replicaEfficiency === fixture.servingModel.replicaEfficiency;

  return `
    <article class="cluster-row">
      <div class="cluster-identity">
        <span>${isPublishedPoint ? "Published operating point" : "Normalized estimate"}</span>
        <strong>${serverCount} ${serverCount === 1 ? "server" : "servers"}</strong>
        <small>${serverCount * state.hardware.gpusPerServer} H200 GPUs</small>
      </div>
      <div class="cluster-layout">
        <span>Parallel layout</span>
        <strong>TP8 · EP8 · DP${serverCount}</strong>
        <small>${serverCount} full-weight ${serverCount === 1 ? "worker" : "workers"}</small>
      </div>
      <div class="cluster-capacity">
        <div class="cluster-capacity-label">
          <span>Concurrent session capacity*</span>
          <strong>${decimal.format(capacity)}</strong>
        </div>
        <div class="cluster-capacity-track">
          <span class="cluster-capacity-fill" style="width: ${capacityWidth}%"></span>
          <span class="cluster-admitted-fill" style="width: ${admittedWidth}%"></span>
          <i class="cluster-demand-marker" style="left: min(calc(${demandPosition}% - 1px), calc(100% - 2px))"></i>
        </div>
        <div class="cluster-capacity-caption">
          <span>${number.format(admitted)} admitted</span>
          <span class="${waiting > 0 ? "has-waiting" : ""}">${number.format(waiting)} waiting</span>
        </div>
      </div>
      <div class="cluster-memory">
        <span>Aggregate memory</span>
        <strong>${number.format(serverCount * memory.kvPerWorker)} GB KV</strong>
        <small>${number.format(serverCount * memory.rawPerWorker)} GB raw HBM</small>
      </div>
    </article>
  `;
}

function renderEvidence() {
  const container = $("#evidence-grid");
  container.replaceChildren(
    ...fixture.evidence.map((item) => {
      const current = currentH200Evidence(item);
      const card = document.createElement("article");
      const isMissing = current.value === null || current.status.includes("missing");
      const isEstimate = current.status.includes("estimate") || current.status.includes("assumption") || current.status.includes("recipe limit");
      card.className = `evidence-card${isMissing ? " is-missing" : ""}${
        isEstimate ? " is-estimate" : ""
      }`;
      card.dataset.field = item.field;

      const source = current.sourceUrl
        ? `<a href="${current.sourceUrl}" target="_blank" rel="noreferrer">${current.source} ↗</a>`
        : `<span class="source-text">${current.source}</span>`;
      card.innerHTML = `
        <span class="evidence-status">${current.status}</span>
        <p class="evidence-field">${humanizeField(item.field)}</p>
        <p class="evidence-value">${formatEvidenceValue(current)}</p>
        ${current.note ? `<p class="evidence-note">${current.note}</p>` : ""}
        ${source}
      `;
      return card;
    })
  );
}

function currentH200Evidence(item) {
  const values = {
    hbmPerGpuGb: state.hardware.hbmPerGpuGb,
    modelWeightMemoryPerWorkerGb: state.assumptions.modelWeightMemoryPerWorkerGb,
    usableMemoryFraction: state.assumptions.usableMemoryFraction * 100,
    runtimeOverheadGb: state.assumptions.runtimeOverheadGb,
    safetyReserveGb: state.assumptions.safetyReserveGb,
    observedConcurrency: state.servingModel.observedConcurrency,
    replicaEfficiency: state.servingModel.replicaEfficiency * 100,
    splitDomainEfficiency: state.servingModel.splitDomainEfficiency * 100
  };
  if (!(item.field in values)) return item;
  const value = values[item.field];
  if (value === item.value) return { ...item, value };
  return {
    ...item,
    value,
    status: "edited assumption",
    source: "User-edited value",
    sourceUrl: null,
    note: "This value differs from the loaded source/default and is treated as an assumption."
  };
}

function syncAssumptionInputs() {
  $("#input-utilization").value = state.assumptions.usableMemoryFraction * 100;
  $("#input-weights").value = state.assumptions.modelWeightMemoryPerWorkerGb;
  $("#input-runtime").value = state.assumptions.runtimeOverheadGb;
  $("#input-safety").value = state.assumptions.safetyReserveGb;
  $("#h-observed-ccu").value = state.servingModel.observedConcurrency;
  $("#h-replica-efficiency").value = state.servingModel.replicaEfficiency * 100;
  $("#h-split-efficiency").value = state.servingModel.splitDomainEfficiency * 100;
}

function replayAnimation() {
  clearAnimationTimers();
  const stage = $("#pool-stage");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reducedMotion) {
    stage.dataset.phase = "complete";
    stage.classList.remove("is-running");
    $("#phase-label").textContent = "Allocation complete · motion reduced";
    return;
  }

  stage.classList.add("is-running");
  let elapsed = 0;
  PHASES.forEach(([phase, label, duration]) => {
    const timer = window.setTimeout(() => {
      stage.dataset.phase = phase;
      $("#phase-label").textContent = label;
      if (phase === "complete") stage.classList.remove("is-running");
    }, elapsed);
    animationTimers.push(timer);
    elapsed += duration;
  });
}

function clearAnimationTimers() {
  animationTimers.forEach((timer) => window.clearTimeout(timer));
  animationTimers = [];
}

function formatEvidenceValue(item) {
  if (item.value === null) return "Not measured";
  return `${number.format(item.value)} ${item.unit}`;
}

function humanizeField(field) {
  const labels = {
    hbmPerGpuGb: "HBM per H200",
    modelWeightMemoryPerWorkerGb: "FP8 weight footprint",
    contextLimitTokens: "H200 recipe context limit",
    kvBytesPerToken: "KV bytes per token",
    observedConcurrency: "Published H200 concurrency",
    replicaEfficiency: "DP replica efficiency",
    splitDomainEfficiency: "Split-domain efficiency",
    usableMemoryFraction: "Usable memory target",
    runtimeOverheadGb: "Runtime workspace",
    safetyReserveGb: "Safety reserve"
  };
  return labels[field] || field;
}

function showError(error) {
  console.error(error);
  const stage = $("#pool-stage");
  stage.innerHTML = `
    <div class="error-state" role="alert">
      <strong>The simulator fixture could not be loaded.</strong><br />
      Run this project through a local web server so the JSON data file is available.
    </div>
  `;
  $("#phase-label").textContent = "Data unavailable";
}

if (typeof document !== "undefined") {
  init();
}
