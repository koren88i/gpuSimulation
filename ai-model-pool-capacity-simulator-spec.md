# AI Model Pool Capacity Simulator

## Project starting specification

**Status:** Initial development baseline  
**Primary audience:** Organizational leadership, AI platform leadership, capacity planners, and inference engineers  
**Initial hardware scope:** Six NVIDIA H200 servers/GPUs  
**Initial model comparison:** Kimi 2.7 and GLM 4.7  

---

## 1. Purpose

Build an interactive simulation that explains why dividing a limited H200 fleet into dedicated pools for multiple models can reduce effective serving capacity, even when the second model is better for a narrow use case.

The initial comparison is:

- **Unified deployment:** Six H200 servers assigned to one default model, initially Kimi 2.7.
- **Split deployment:** Four H200 servers assigned to Kimi 2.7 and two assigned to GLM 4.7.
- Additional scenario of interest: a three-and-three split.

The experience should let leadership see the consequence in three forms:

1. Concurrent coding sessions receiving a good experience.
2. Developers supported, based on an adjustable relationship between active sessions and total users.
3. Financial opportunity cost of fragmented or unusable GPU capacity over time.

This is an explanatory decision tool, not merely a calculator or infrastructure dashboard.

---

## 2. Decision the simulator should support

The central question is:

> Should the organization dedicate scarce H200 capacity to another continuously deployed model because it performs better on a specific use case?

The simulator should help establish a governance principle:

> Operate one default model across the largest practical shared pool. Add a dedicated alternative-model pool only when its measured benefit exceeds its capacity fragmentation, operational, and financial costs.

It must not predetermine that one pool is always superior. If measured data shows that a split deployment is justified under a particular demand pattern, topology, or SLO, the simulation must show that result honestly.

---

## 3. Preferred product form

The preferred deliverable is an interactive HTML application or lightweight web application, rather than a static PowerPoint slide.

Reasons:

- Server allocations must be adjustable.
- Models and serving configurations must be selectable.
- The user-to-concurrent-session multiplier must be adjustable.
- Costs must update over different time horizons.
- Animated request and KV-capacity behavior is central to the explanation.
- Assumptions and evidence confidence need to remain inspectable.

A PowerPoint can later be produced from selected simulator states, but it is not the primary product.

---

## 4. Primary user experience

The screen should present two deployments side by side:

### Left: unified fleet

- Six H200 server blocks form one serving capacity domain.
- The selected default model is deployed using the selected recipe and topology.
- Incoming sessions enter a shared scheduling and batching domain.
- Available KV-cache capacity and serving headroom are visualized.
- All suitable capacity can serve the selected workload.

### Right: split fleet

- The same six servers are divided by a visible boundary.
- The initial default is four servers for Kimi 2.7 and two for GLM 4.7.
- Each model has its own weights, runtime, scheduler/queue, and KV-cache capacity domain.
- When the primary-model pool is saturated, its sessions queue or turn red.
- Spare capacity in the secondary-model pool remains visible but cannot accept sessions requiring the primary model.
- Duplicate or additional deployment overhead is marked in amber or red where supported by the topology model.

The strongest visual moment should be a request waiting next to physically available capacity that cannot serve it because that capacity belongs to the other model deployment.

---

## 5. User controls

### Main controls

Keep leadership-facing controls compact:

- Total server count.
- GPU/server type, initially H200.
- Unified or split topology.
- Model assigned to each pool.
- Number of servers assigned to each pool.
- Workload preset:
  - Code completion.
  - Agentic coding.
- Developers per concurrent session multiplier.
- Cost per H200 server-day.
- Cost horizon:
  - Day.
  - Month.
  - Year.
- Target experience/SLO preset.

### Advanced assumptions

Place engineering details behind an expandable section:

- Serving engine and version, such as vLLM or llm-d.
- Tensor parallelism.
- Pipeline parallelism.
- Data parallelism/replica count.
- Quantization and numerical precision.
- Maximum and average context length.
- Input and output token distributions.
- Prefix-cache assumptions and hit rate.
- KV-cache data type.
- GPU memory utilization target.
- Scheduler and batching configuration.
- Request arrival pattern.
- Target TTFT, ITL/TBT, end-to-end latency, and/or tokens per second.
- Operational headroom.

### Demand distribution

A detailed Kimi/GLM traffic-mix control should not appear in the main leadership interface.

Nevertheless, the simulation needs a demand distribution to calculate stranded capacity. Represent this through understandable scenarios:

- Normal coding day.
- Agent-heavy period.
- Peak primary-model demand.
- Custom demand distribution.

The default leadership story is that most demand targets the default model while the alternative model supports a narrower use case. Exact percentages remain inspectable in advanced assumptions.

---

## 6. Required outputs

Show four primary results for both deployments:

1. **Good-experience concurrent sessions**  
   Active sessions supported while meeting the selected SLO.

2. **Developers supported**  
   Good-experience concurrent sessions multiplied by the selected user multiplier.

3. **Stranded capacity**  
   Capacity remaining in one pool while eligible demand is queued or rejected in another.

4. **Financial opportunity cost**  
   The cost of the equivalent capacity unavailable to serve the dominant workload.

Recommended language examples:

> The split fleet supports 240 fewer developers under this scenario.

> The capacity loss is equivalent to disconnecting 1.8 H200 servers from the useful serving fleet.

> At the selected fully loaded cost, the fragmented capacity represents $X per day and $Y per year.

Never hard-code the claim that a 3+3 split always loses exactly two servers. Display this only when the selected or measured capacity curves support that equivalence.

---

## 7. Capacity is a derived output

Concurrent-session capacity must not be a mandatory user input.

The user selects the model, hardware, deployment topology, serving recipe, workload profile, and SLO. The system derives capacity automatically.

Manual measurements or overrides must also be supported, both to improve accuracy and to accommodate internal/on-prem deployments for which no public benchmark exists.

### Evidence hierarchy

Use the best available source in this order:

1. Internal measurements for the exact configuration.
2. Published benchmark for the same model, hardware, engine, and topology.
3. Published deployment recipe plus measured or published performance components.
4. Analytical estimate based on model memory, KV-cache footprint, token distributions, batching, and throughput.
5. AI-assisted research that locates and interprets public recipes and benchmarks.

A ChatGPT or other LLM call may help locate, normalize, and interpret evidence. The LLM response itself is not authoritative evidence. Preserve the underlying sources, dates, assumptions, and confidence level.

### Capacity evidence labels

Every result must show its provenance:

- Internally measured.
- Published benchmark.
- Recipe-based estimate.
- Analytical estimate.
- Manual override.

Also show:

- Confidence level or range.
- Date collected.
- Exact configuration match quality.
- Key assumptions that materially affect the result.

---

## 8. Two concurrency concepts

Do not use one ambiguous concurrency value.

### KV-resident concurrency

The number of sessions whose current KV state can technically remain resident under the modeled memory and topology constraints.

### Good-experience concurrency

The number of active sessions that can be served while meeting the selected user-experience SLO.

The application uses **good-experience concurrency** to calculate developers supported. KV-resident concurrency helps explain the mechanics but is not sufficient: many sessions may fit in memory while token throughput or latency is already unacceptable.

---

## 9. Core calculations

### Capacity curve

For each model and deployment recipe, maintain or derive a topology-dependent curve:

```text
C(model, hardware, recipe, server_count, workload, SLO)
  = good-experience concurrent sessions
```

Do not assume linear scaling with server count. The curve must be able to represent:

- Tensor- and pipeline-parallel effects.
- Replication versus sharding.
- Model-weight footprint.
- KV-cache capacity and fragmentation.
- Continuous batching behavior.
- Prefix-cache behavior.
- Input/output length distribution.
- Communication overhead.
- Engine and kernel versions.
- Operational headroom.
- The SLO defining a good experience.

### Developers supported

```text
developers_supported
  = good_experience_concurrent_sessions
    * developers_per_concurrent_session
```

The multiplier is adjustable because interactive code completion and long-running coding agents create different concurrency ratios.

### Served demand per model pool

```text
served_sessions(model_pool)
  = min(eligible_demand(model_pool), capacity(model_pool))
```

### Stranded capacity

Capacity is stranded when all of the following are true:

- One model pool has unused good-experience capacity.
- Another model pool has eligible sessions queued, rejected, or pushed beyond the SLO.
- The spare pool cannot serve those sessions without loading or routing them to a different model.

### Equivalent disconnected servers

Calculate this against the unified deployment's measured or estimated capacity curve:

```text
equivalent_disconnected_servers
  = unified_server_count
    - inverse_unified_capacity(effective_split_capacity)
```

Use interpolation when the inverse falls between measured server counts. Clearly label the output as an equivalence, not a count of physically idle servers.

### Financial opportunity cost

```text
daily_opportunity_cost
  = equivalent_disconnected_servers
    * fully_loaded_cost_per_server_day

period_opportunity_cost
  = daily_opportunity_cost * selected_period_days
```

The fully loaded rate may include acquisition amortization, power, cooling, networking, support, datacenter allocation, and platform overhead. The UI must state which cost basis is selected.

---

## 10. Technical explanation and visualization accuracy

Avoid claiming that six GPUs literally expose one universal KV cache shared arbitrarily between different models.

The accurate message is:

> Each model deployment forms its own non-transferable serving capacity domain. Model weights, KV-cache tensors, batching opportunities, scheduler state, and headroom allocated to one model cannot immediately absorb a request that requires another model.

In a multi-node inference deployment, weights and KV-cache tensors are distributed or replicated according to the parallelism and serving topology. The visual should simplify this without misrepresenting it as a single hardware-level cache shared by every GPU.

Distinguish three potential sources of capacity loss:

1. **Deployment duplication/overhead**  
   Resources independently committed to weights, runtimes, replicas, and operational reserves.

2. **Pool-size/topology efficiency loss**  
   Changes in batching opportunity, scheduling flexibility, parallelism, communication, or topology-dependent performance.

3. **Demand fragmentation**  
   Idle capacity in one model pool while another model pool is saturated.

The third is the clearest leadership argument. The first two must be quantified using measurements or defensible estimates rather than asserted universally.

---

## 11. Animation storyboard

Animations occur only following a user action or explicit replay. They must not loop continuously and must respect reduced-motion preferences.

### Scene 1: unified capacity

- Six H200 server blocks visually connect into one serving domain.
- The selected model and recipe load across the chosen topology.
- Weight/runtime allocation becomes visible.
- Remaining KV-cache/session capacity appears as cells or blocks.
- Coding sessions arrive through one queue.
- Sessions occupy capacity while the good-experience counter updates.

### Scene 2: add a specialized model

- The user selects a split topology or adds GLM 4.7.
- A divider enters the fleet.
- Servers move to their selected allocations, initially four and two.
- Each side loads its own model/runtime allocation.
- Capacity and developer totals recalculate.

### Scene 3: reveal fragmentation

- Default-model traffic fills the primary pool.
- Excess sessions queue or turn red as the SLO is exceeded.
- Spare cells remain green in the specialized-model pool.
- A waiting request visually attempts to cross the boundary.
- The boundary rejects it with the label: **Capacity exists, but not for this model.**

### Scene 4: translate sessions into people

- The user moves the developers-per-concurrent-session slider.
- Both deployments update simultaneously.
- The difference in supported developers is emphasized.

### Scene 5: translate fragmentation into money

- Lost effective capacity converts into equivalent disconnected servers.
- The equivalent server blocks visually detach or dim.
- Cost accumulates for a day, month, and year.
- Closing statement appears:

> A specialized model is not free because the GPUs already exist. Its cost includes the shared capacity it removes.

---

## 12. Visual language

- **Green:** capacity currently useful for eligible demand.
- **Red:** queued/rejected sessions, SLO breach, or capacity loss requiring attention.
- **Amber:** committed overhead or uncertain/estimated capacity.
- **Neutral:** unused capacity when there is no competing unmet demand.

Do not label every unused cell as waste. Capacity becomes stranded only when another eligible workload cannot use it and would otherwise benefit from it.

Pair colors with text, patterns, or icons so the explanation remains accessible.

---

## 13. Suggested data model

### Model definition

```json
{
  "modelId": "kimi-2.7",
  "displayName": "Kimi 2.7",
  "architecture": "unknown-or-configured",
  "parameterMetadata": {},
  "defaultRecipes": []
}
```

### Deployment recipe

```json
{
  "recipeId": "recipe-id",
  "modelId": "kimi-2.7",
  "engine": "vllm",
  "engineVersion": "configured-version",
  "hardware": "h200",
  "gpuCount": 6,
  "tensorParallel": null,
  "pipelineParallel": null,
  "replicas": null,
  "precision": null,
  "kvCacheDtype": null,
  "maxModelLength": null,
  "gpuMemoryUtilization": null,
  "otherEngineArgs": {}
}
```

### Workload profile

```json
{
  "workloadId": "agentic-coding-default",
  "displayName": "Agentic coding",
  "arrivalPattern": {},
  "inputTokens": {},
  "outputTokens": {},
  "activeIdleBehavior": {},
  "prefixReuse": {},
  "sloId": "interactive-agent-slo"
}
```

### Capacity evidence

```json
{
  "evidenceId": "evidence-id",
  "recipeId": "recipe-id",
  "workloadId": "agentic-coding-default",
  "capacityType": "good-experience-concurrency",
  "value": 0,
  "lowerBound": null,
  "upperBound": null,
  "provenance": "internal-measurement",
  "sourceUrl": null,
  "sourceTitle": null,
  "collectedAt": null,
  "assumptions": [],
  "confidence": "high"
}
```

### Scenario

```json
{
  "scenarioId": "six-h200-four-two",
  "totalServers": 6,
  "pools": [
    { "modelId": "kimi-2.7", "serverCount": 4 },
    { "modelId": "glm-4.7", "serverCount": 2 }
  ],
  "workloadPreset": "code-completion",
  "demandScenario": "peak-primary-model",
  "developersPerConcurrentSession": 5,
  "costPerServerDay": null,
  "costBasis": "fully-loaded",
  "sloId": "selected-slo"
}
```

Names and model metadata above are placeholders until exact internal model identifiers and configurations are confirmed.

---

## 14. Capacity-estimation service

Treat automatic capacity derivation as a separate component from the visualization.

Suggested responsibilities:

1. Accept a normalized model, hardware, recipe, workload, and SLO query.
2. Look for an exact internal measurement.
3. Look for compatible published benchmark evidence.
4. Retrieve known serving recipes and model configuration.
5. Estimate memory-limited KV concurrency.
6. Estimate throughput/SLO-limited concurrency.
7. Reconcile multiple sources and return a range.
8. Report provenance, configuration differences, assumptions, and confidence.
9. Allow an administrator to add or override results manually.

Suggested response contract:

```json
{
  "kvResidentConcurrency": {
    "estimate": null,
    "range": [null, null]
  },
  "goodExperienceConcurrency": {
    "estimate": null,
    "range": [null, null]
  },
  "evidence": [],
  "assumptions": [],
  "confidence": "insufficient-data",
  "warnings": []
}
```

If evidence is insufficient, do not fabricate a precise number. Return a range or an explicit insufficient-data state and invite manual benchmark ingestion.

---

## 15. MVP scope

### MVP 1: simulation shell

- Side-by-side unified and split deployments.
- Six configurable H200 servers.
- Kimi 2.7 and GLM 4.7 labels.
- Server allocation control.
- Code-completion and agentic-coding presets.
- Adjustable user concurrency multiplier.
- Adjustable server-day cost and cost horizon.
- Animated server, capacity-cell, request, and boundary behavior.
- Capacity supplied by a local mock data file.
- Clear evidence labels and an illustrative-data warning.

### MVP 2: capacity model

- Recipe schema.
- Internal/manual benchmark ingestion.
- Capacity curves by server count.
- Interpolation and equivalent-disconnected-server calculation.
- KV-resident versus good-experience concurrency.
- Confidence ranges.

### MVP 3: evidence retrieval

- Search/retrieval of public model recipes and benchmarks.
- Source normalization and configuration matching.
- Optional LLM-assisted extraction.
- Evidence review workflow before newly retrieved data becomes trusted.

### MVP 4: operational integration

- Import measurements from the organization's benchmark pipeline.
- Versioned model and recipe catalog.
- Saved leadership scenarios.
- Export selected states as images or presentation slides.

---

## 16. Acceptance criteria for the first interactive prototype

The first prototype is successful when:

- A user can compare six unified servers with 4+2 and 3+3 splits.
- Changing server allocation visibly redistributes model/runtime and KV/session capacity.
- A saturated primary pool can coexist with visible spare capacity in the secondary pool.
- The application explains why that spare capacity cannot serve the waiting request.
- The user multiplier updates supported-developer counts immediately.
- Cost updates for daily, monthly, and yearly horizons.
- The simulator never presents an estimate as a measurement.
- The simulator never assumes linear multi-node scaling.
- The phrase “equivalent to disconnected servers” is backed by the selected capacity curve.
- Both code-completion and agentic-coding workloads can produce materially different results.
- The interface remains understandable to leadership without opening advanced assumptions.

---

## 17. Open decisions and required research

Before the simulator can produce defensible production numbers, determine:

1. Exact internal identifiers and configurations behind “Kimi 2.7” and “GLM 4.7.”
2. Whether a “server” means one H200 GPU, a multi-GPU server, or another node shape.
3. Which vLLM/llm-d recipes are currently supported for each model.
4. Capacity curves for one through six servers under each valid parallelism topology.
5. Target SLOs for code completion and agentic coding.
6. Representative input/output lengths and request-arrival distributions.
7. Appropriate developers-per-concurrent-session range for each workload.
8. Fully loaded H200 server-day cost and its accounting basis.
9. How model quality improvements for specialized use cases should be represented alongside capacity cost.
10. Whether alternative-model requests may fall back to the default model and with what quality penalty.

---

## 18. Recommended implementation principle

Separate the project into three layers:

```text
Evidence and capacity estimation
            ↓
Deterministic scenario calculation
            ↓
Interactive leadership visualization
```

- The evidence layer determines defensible capacity curves and confidence.
- The calculation layer remains deterministic and testable.
- The visualization layer animates the result without inventing technical behavior.

This separation allows the UI to be developed immediately using illustrative fixtures while the benchmark and research pipeline matures independently.

---

## 19. Initial leadership takeaway

The simulator should ultimately make this insight visually unavoidable:

> Six installed H200 servers are not necessarily six usable servers for the workload that needs them. Once the fleet is divided into model-specific serving domains, spare capacity on one side cannot automatically relieve pressure on the other. The cost of an additional model is therefore not only its own runtime—it is also the flexibility and shared capacity removed from the primary service.

