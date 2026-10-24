import {finite,latencyStatus,capacity} from './capacity.js';

// These server SKUs have eight-GPU HGX/DGX variants. We report allocated
// eight-GPU server equivalents; exact physical hosts require run provenance.
export function topology(r) {
  const m=r.metrics??{};
  const nodeGpus=['gb200','gb300'].includes(r.hardware)?4:8;
  const p=Number(r.num_prefill_gpu), d=Number(r.num_decode_gpu);
  const gpus=r.disagg?p+d:Math.max(p,d);
  const reasons=[];
  if (!Number.isInteger(gpus)||gpus<=0) reasons.push('invalid_gpu_count');
  if (gpus%nodeGpus!==0) reasons.push('partial_node_allocation');
  if (r.disagg) {
    for (const [n,w] of [[p,r.prefill_num_workers],[d,r.decode_num_workers]]) {
      if (n>0 && (!(w>0)||n/w<nodeGpus||(n/w)%nodeGpus!==0)) reasons.push('partial_or_unknown_worker_placement');
    }
  } else if (!r.is_multinode && gpus>nodeGpus) reasons.push('single_node_label_conflicts_with_gpu_count');
  const observed=finite(m.total_tput_tps)&&m.tput_per_gpu>0?m.total_tput_tps/m.tput_per_gpu:null;
  if (finite(observed)&&Math.abs(observed-gpus)>0.02*Math.max(1,gpus)) reasons.push('throughput_gpu_denominator_conflict');
  if (finite(m.avg_total_gpu_power_w)&&m.avg_power_w>0 && Math.abs(m.avg_total_gpu_power_w/m.avg_power_w-gpus)>0.1*gpus) reasons.push('power_gpu_count_conflict');
  return {gpus,nodeGpus,nodeEquivalents:gpus/nodeGpus,prefillGpus:r.disagg?p:null,decodeGpus:r.disagg?d:null,
    prefillWorkers:r.prefill_num_workers,decodeWorkers:r.decode_num_workers,
    observedThroughputGpuDenominator:observed,eligible:reasons.length===0,reasons,
    physicalHostsVerified:false,unit:nodeGpus===4?'4-GPU NVL compute-tray equivalents':'8-GPU server equivalents'};
}
export function normalize(r,source,p,provenance={}) {
  const metrics=r.metrics??{};
  const t=topology(r);
  const agentic=r.benchmark_type==='agentic_traces';
  let outputTps=null,outputMethod='missing';
  if (finite(metrics.output_tput_tps)) {outputTps=metrics.output_tput_tps;outputMethod='direct_output_tput_tps';}
  else if (finite(metrics.output_tput_per_gpu)) {
    // Agentic producer normalizes all throughput by total GPUs. Fixed P/D
    // producer normalizes output by decode GPUs. Preserve method for audit.
    const denominator=agentic?t.gpus:r.disagg?(t.decodeGpus||t.gpus):t.gpus;
    outputTps=metrics.output_tput_per_gpu*denominator;
    outputMethod=agentic?'agentic_total_gpu_normalized':r.disagg?'fixed_decode_gpu_normalized':'fixed_total_gpu_normalized';
  }
  let rps=null,rpsMethod='missing';
  if (agentic&&finite(metrics.mean_qps)) {rps=metrics.mean_qps;rpsMethod='mean_qps';}
  else if (finite(metrics.request_throughput)) {rps=metrics.request_throughput;rpsMethod='request_throughput';}
  else if (finite(outputTps)) {
    const osl=metrics.mean_output_tokens_actual??r.osl;
    if (osl>0) {rps=outputTps/osl;rpsMethod=finite(metrics.mean_output_tokens_actual)?'output_over_actual_mean_tokens':'approx_output_over_nominal_osl';}
  }
  const row={id:String(r.id),model:r.model,hardware:r.hardware,type:r.benchmark_type,
    precision:r.precision,specMethod:r.spec_method,framework:r.framework,image:r.image,
    date:r.date,recipeFingerprint:r.recipe_fingerprint,runUrl:r.run_url,source,
    isl:r.isl,osl:r.osl,concurrency:r.conc,concurrencyUnit:agentic?'root_session_trees':'maximum_inflight_requests',
    disagg:r.disagg,offloadMode:r.offload_mode,
    parallelism:Object.fromEntries(Object.entries(r).filter(([k])=>/^(prefill|decode)_(tp|ep|dp_attention|num_workers)$/.test(k))),
    topology:t,metrics,outputTps,outputMethod,rps,rpsMethod,
    dataset:provenance.dataset??null,scenarioValid:provenance.scenarioValid??null,
    provenance:provenance,latency:latencyStatus(metrics,p)};
  row.capacity=capacity(row,p);
  return row;
}
