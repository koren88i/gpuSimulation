import {compareValues,finite} from './capacity.js';
export function groupKey(r) {
  return JSON.stringify([r.model,r.hardware,r.precision,r.type,r.isl,r.osl,
    r.type==='agentic_traces'?r.dataset:null,r.specMethod]);
}
export function comparisons(rows) {
  const groups=new Map();
  for (const r of rows) {
    if (!r.topology.eligible||!finite(r.outputTps)||r.outputTps<=0) continue;
    // Unknown validity stays explicit and produces provisional comparisons.
    // Known invalid scenarios and unidentifiable workloads are excluded.
    if (r.type==='agentic_traces'&&(!r.dataset||r.scenarioValid===false)) continue;
    const key=groupKey(r);
    if (!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(r);
  }
  const out=[];
  for (const group of groups.values()) {
    for (const policy of ['best_observed_throughput','latency_qualified_throughput','latency_qualified_sessions']) {
      if (policy==='latency_qualified_sessions'&&group[0].type!=='agentic_traces') continue;
      const eligible=group.filter(r=>policy==='best_observed_throughput'||r.latency.passes);
      const selected=new Map();
      for (const r of eligible) {
        const n=r.topology.nodeEquivalents;
        const prev=selected.get(n);
        const score=policy==='latency_qualified_sessions'?r.concurrency:r.outputTps;
        const prevScore=prev?(policy==='latency_qualified_sessions'?prev.concurrency:prev.outputTps):-Infinity;
        if (score>prevScore || (score===prevScore && (r.date>prev.date||(r.date===prev.date&&Number(r.id)>Number(prev.id))))) selected.set(n,r);
      }
      const sizes=[...selected.keys()].sort((a,b)=>a-b);
      for (const smallN of sizes) for (const largeN of sizes) {
        const k=largeN/smallN;
        if (k<2||!Number.isInteger(k)) continue;
        const small=selected.get(smallN),large=selected.get(largeN);
        const sweep=point=>[...new Set(group.filter(r=>r.topology.nodeEquivalents===point.topology.nodeEquivalents&&
          r.date===point.date&&r.framework===point.framework&&r.image===point.image&&r.disagg===point.disagg&&
          JSON.stringify(r.parallelism)===JSON.stringify(point.parallelism)&&r.offloadMode===point.offloadMode).map(r=>r.concurrency))].sort((a,b)=>a-b);
        const smallSweep=sweep(small),largeSweep=sweep(large);
        const flags=['split_capacity_projected','physical_hosts_not_independently_verified'];
        if(smallSweep.length<=2) flags.push('sparse_smaller_configuration_concurrency_sweep');
        if(largeSweep.length<=2) flags.push('sparse_larger_configuration_concurrency_sweep');
        if (small.type==='agentic_traces'&&(small.scenarioValid!==true||large.scenarioValid!==true)) flags.push('agentic_scenario_validity_unverified');
        if (small.type==='agentic_traces') flags.push('dataset_revision_replay_controls_unverified');
        if (small.framework!==large.framework||small.image!==large.image) flags.push('software_differs');
        if (small.date!==large.date) flags.push('dates_differ');
        if (small.concurrency*k!==large.concurrency) flags.push('total_concurrency_differs');
        if (small.offloadMode!==large.offloadMode) flags.push('offload_differs');
        if (small.specMethod!=='none') flags.push('speculative_acceptance_provenance_not_verified');
        if (small.disagg!==large.disagg) flags.push('aggregated_vs_disaggregated');
        out.push({id:`${policy}:${small.id}:${large.id}:${k}`,policy,model:small.model,hardware:small.hardware,
          type:small.type,precision:small.precision,specMethod:small.specMethod,isl:small.isl,osl:small.osl,dataset:small.dataset,
          nodeUnit:small.topology.unit,gpusPerNode:small.topology.nodeGpus,
          smallNodeEquivalents:smallN,largeNodeEquivalents:largeN,copies:k,
          smallId:small.id,largeId:large.id,smallDate:small.date,largeDate:large.date,
          smallFramework:small.framework,largeFramework:large.framework,
          smallImage:small.image,largeImage:large.image,
          smallObservedConcurrencies:smallSweep,largeObservedConcurrencies:largeSweep,
          smallRunUrl:small.runUrl,largeRunUrl:large.runUrl,
          smallMedianTtft:small.metrics.median_ttft??null,largeMedianTtft:large.metrics.median_ttft??null,
          smallP90Ttft:small.metrics.p90_ttft??null,largeP90Ttft:large.metrics.p90_ttft??null,
          smallP90Tpot:small.metrics.p90_tpot??null,largeP90Tpot:large.metrics.p90_tpot??null,
          smallPrefillGpus:small.topology.prefillGpus,largePrefillGpus:large.topology.prefillGpus,
          smallDecodeGpus:small.topology.decodeGpus,largeDecodeGpus:large.topology.decodeGpus,
          flags,...compareValues(large,small,k)});
      }
    }
  }
  return out.sort((a,b)=>a.id.localeCompare(b.id));
}
