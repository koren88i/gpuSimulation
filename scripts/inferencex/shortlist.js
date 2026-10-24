import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {compareValues} from './capacity.js';

export function profilingErrors(a) {
  const errors=a.records_dropped_total-a.records_warmup_dropped;
  const attempted=a.records_total-a.records_warmup_dropped;
  if(!Number.isInteger(errors)||errors<0||errors>a.records_error_dropped||attempted<=0||a.records_profiled+errors!==attempted) throw new Error('Inconsistent request accounting');
  return {errors,attempted,errorRatePct:100*errors/attempted};
}
export function matchAggregate(row,aggregate) {
  const a=aggregate;
  return a.conc===row.concurrency&&a.image===row.image&&a.infmax_model_prefix===row.model&&
    a.framework===row.framework&&a.precision===row.precision&&a.spec_decoding===row.specMethod&&
    a.disagg===row.disagg&&a.hw?.replace(/^cluster:/,'').split('-')[0]===row.hardware&&
    Math.abs((a.request_metrics?.throughput?.output?.tokens_per_second??-Infinity)-row.outputTps)<0.02&&
    Math.abs((a.request_metrics?.latency?.ttft?.p90??-Infinity)-row.metrics.p90_ttft)<0.00002&&
    Math.abs((a.request_metrics?.latency?.tpot?.p90??-Infinity)-row.metrics.p90_tpot)<0.00002;
}

export async function generateShortlist() {
  const out='reports/inferencex';
  const rows=JSON.parse(await readFile(`${out}/benchmarks.json`,'utf8'));
  const comparisons=JSON.parse(await readFile(`${out}/comparisons.json`,'utf8'));
  const manifest=JSON.parse(await readFile('data/inferencex/audit/manifest.json','utf8'));
  const audits={};
  for(const id of manifest.selectedIds) {
    const row=rows.find(r=>r.id===id);
    const matches=[];
    for(const art of manifest.artifacts.filter(a=>row.runUrl.includes(`/runs/${a.runId}/`))) {
      const records=JSON.parse(await readFile(art.file,'utf8'));
      for(const r of records) if(matchAggregate(row,r.data)) matches.push({artifact:art,filename:r.filename,data:r.data});
    }
    if(matches.length!==1) throw new Error(`Expected one source artifact for ${id}; found ${matches.length}`);
    const {artifact,filename,data:a}=matches[0];
    const gpuTotal=a.num_prefill_gpu+a.num_decode_gpu;
    if(gpuTotal!==row.topology.gpus) throw new Error(`GPU allocation mismatch for ${id}`);
    const errors=profilingErrors(a.request_accounting);
    if(a.dataset?.loader!==row.dataset) throw new Error(`Dataset mismatch for ${id}`);
    const run=manifest.runs.find(r=>r.id===artifact.runId);
    const peers=rows.filter(r=>r.runUrl===row.runUrl&&r.image===row.image&&r.model===row.model&&r.hardware===row.hardware&&
      r.disagg===row.disagg&&r.topology.gpus===row.topology.gpus&&JSON.stringify(r.parallelism)===JSON.stringify(row.parallelism));
    audits[id]={rowId:id,artifactId:artifact.id,artifactSha256:artifact.sha256,artifactFile:artifact.file,filename,
      runUrl:row.runUrl,sourceSha:run.sha,modelCheckpoint:a.model,dataset:a.dataset,
      gpuTotal,prefillGpu:a.num_prefill_gpu,decodeGpu:a.num_decode_gpu,
      metricMatch:true,router:a.router??null,profiledRequests:a.request_accounting.records_profiled,
      profilingErrors:errors,rawRequestAccounting:a.request_accounting,
      p90Ttft:a.request_metrics.latency.ttft.p90,p90Tpot:a.request_metrics.latency.tpot.p90,
      higherFailedConcurrencies:peers.filter(r=>r.concurrency>row.concurrency&&!r.latency.passes).map(r=>r.concurrency).sort((a,b)=>a-b),
      observedConcurrencies:[...new Set(peers.map(r=>r.concurrency))].sort((a,b)=>a-b),
      verdict:'source_aggregate_verified; capacity_maximum_and_scenario_compliance_unproven'};
  }
  // Editorial choices contain identities and explanations, never computed results.
  const picks=[
    {small:'439969',large:'439975',label:'Closest controlled comparison',reason:'Same source run, engine image and router version. Small/large measured loads scale together. Sparse sweeps do not establish the maximum capacity of either size.'},
    {small:'441056',large:'441058',label:'Kimi K3: three-copy baseline',reason:'Same source run and engine image; aggregated baseline versus P/D deployment. Small setup was tested at few concurrency values. Treat the result as an observed operating-point comparison.'},
    {small:'441056',large:'441057',label:'Kimi K3: four-copy baseline',reason:'Same source run and engine image. Shares the small baseline with the preceding example, so these are related examples, not independent replications.'},
    {small:'439841',large:'439969',label:'DeepSeek: broader small-side sweep',reason:'Small-side sweep crosses the latency limit above the selected point; larger-side maximum remains unproven. Engine and router versions differ across four days.'},
    {small:'439949',large:'440078',label:'Split-favored counterexample',reason:'Same model checkpoint and corpus; engine and router versions differ. Larger allocation has one measured concurrency, so this does not prove split deployments have greater ultimate capacity.'},
  ];
  const selected=picks.map(p=>{
    const c=comparisons.comparisons.find(c=>c.smallId===p.small&&c.largeId===p.large&&c.policy==='latency_qualified_sessions');
    if(!c) throw new Error(`Missing candidate ${p.small}/${p.large}`);
    if(audits[p.small].modelCheckpoint!==audits[p.large].modelCheckpoint) throw new Error('Checkpoint differs');
    if(JSON.stringify(audits[p.small].dataset)!==JSON.stringify(audits[p.large].dataset)) throw new Error('Dataset metadata differs');
    return {...c,reviewLabel:p.label,reviewReason:p.reason,
      ...compareValues(rows.find(r=>r.id===p.large),rows.find(r=>r.id===p.small),c.copies),
      pointVerification:'matched original aggregate',productionCapacityValidated:false,
      sourceAudit:{small:audits[p.small],large:audits[p.large]}};
  });
  const n=x=>Number(x).toLocaleString('en-US',{maximumFractionDigits:2});
  const table=(h,r)=>[h.join(' | '),h.map(()=>'---').join(' | '),...r.map(a=>a.join(' | '))].join('\n');
  const rowsMain=selected.map((c,i)=>[i+1,`${c.model} / ${c.hardware}`,`${c.largeNodeEquivalents} vs ${Array(c.copies).fill(c.smallNodeEquivalents).join('+')}`,
    `${c.largeNodeEquivalents*c.gpusPerNode}`,`${n(c.largeActiveSessions)} / ${n(c.splitActiveSessions)}`,
    `${n(c.largeDau)} / ${n(c.splitDau)}`,`${n(c.sessionGainPct)}%`,`${n(c.largeOutputTps)} / ${n(c.splitOutputTps)}`,`${n(c.throughputGainPct)}%`]);
  const report=`# Audited comparison shortlist

## Result of the review

Five illustrative AgentX comparisons were retained, using eight unique benchmark points. All eight match original small GitHub aggregate artifacts by model, image, framework, precision, speculative mode, concurrency, output throughput and p90 first-token latency. Actual model checkpoint names, allocated GPUs and dataset metadata agree within each pair. The audit downloaded ${manifest.artifacts.length} small aggregates from ${manifest.runs.length} runs, with ${manifest.errors.length} download errors.

**These verify measured operating points, not optimal setup capacity. No example is promoted to a proven production-capacity maximum.** Most larger allocations were tested at only one or two load levels. The shortlist includes a split-favored case, but that case does not establish that split will always win. Do not use the extreme percentage gains from undersampled low-concurrency baselines as general scaling factors.

## Compact comparison

All allocations below are **GB200/GB300 four-GPU compute-tray equivalents**, not eight-GPU B200 servers. Total allocated GPUs are equal on both sides. Columns show **larger measured deployment / projected independent copies**. Active sessions and DAU include the shared 20% reserve; they are estimates. Sessions assume one root coding-session tree per active user. DAU uses the shared two-active-hours/day, eight-hour window, 2x within-window peak profile. The active-session and DAU gains are identical because the conversion factors are shared.

${table(['#','Model / hardware','Tray allocation','GPUs each side','Active sessions L / split','DAU L / split','Session / DAU gain','Output tok/s L / split','Throughput gain'],rowsMain)}

All selected points pass the default p90 TTFT <= 10 seconds and p90 TPOT <= 0.1 seconds. These latency values stay unchanged when modeling independent copies.

${table(['#','Configured root sessions L / split','p90 TTFT seconds L / small','p90 TPOT ms L / small','Dates L / small'],selected.map((c,i)=>[i+1,`${c.largeConcurrency} / ${c.splitConcurrency}`,`${n(c.largeP90Ttft)} / ${n(c.smallP90Ttft)}`,`${n(1000*c.largeP90Tpot)} / ${n(1000*c.smallP90Tpot)}`,`${c.largeDate} / ${c.smallDate}`]))}

## Evidence for each example

${selected.map((c,i)=>{
    const s=c.sourceAudit.small,l=c.sourceAudit.large;
    return `### ${i+1}. ${c.reviewLabel}\n\n${c.reviewReason}\n\n- Model checkpoint: ${s.modelCheckpoint}. Corpus: ${s.dataset.loader}, split ${s.dataset.hf_split}, ${s.dataset.num_dataset_entries} entries on both sides.\n- Large allocation: ${l.prefillGpu} prefill + ${l.decodeGpu} decode GPUs; small allocation: ${s.prefillGpu} prefill + ${s.decodeGpu} decode GPUs. Decode=0 in an aggregated source means those same prefill devices perform decode too.\n- Images: large ${c.largeImage}; small ${c.smallImage}.\n- Routers: large ${JSON.stringify(l.router)}; small ${JSON.stringify(s.router)}. Null means not recorded, not proof there was no router.\n- Observed concurrency sweep: large [${l.observedConcurrencies.join(', ')}]; small [${s.observedConcurrencies.join(', ')}]. Higher measured loads failing default latency: large [${l.higherFailedConcurrencies.join(', ')}]; small [${s.higherFailedConcurrencies.join(', ')}]. An empty list does not establish unused headroom or saturation.\n- Profiling-only errors: large ${l.profilingErrors.errors}/${l.profilingErrors.attempted} (${n(l.profilingErrors.errorRatePct)}%); small ${s.profilingErrors.errors}/${s.profilingErrors.attempted} (${n(s.profilingErrors.errorRatePct)}%).\n- Sources: [large row ${c.largeId}, artifact ${l.artifactId}](${c.largeRunUrl}); [small row ${c.smallId}, artifact ${s.artifactId}](${c.smallRunUrl}). Original artifact hashes and filenames are in shortlist.json.\n`;
  }).join('\n')}

## What was rejected or remains unresolved

- GLM-5.2 GB300 examples with a one-session small-side test and very large published gains were excluded from the shortlist. Same image/date alone does not establish a fair capacity maximum comparison.
- DeepSeek GB300 cross-framework examples with only one large-side load point and extreme negative gains were excluded as weak capacity evidence.
- Requested Kimi K3 16 vs 8+8 and exact MiniMax 2.7 12 vs 4+4+4 were not found in the extracted compatible node-size coverage. No other model version was substituted.
- Physical host placement and isolation were not established by scheduler labels. Original aggregates do verify allocated GPU totals. Four-GPU NVL tray equivalents remain the explicit unit.
- The source aggregates record a dated corpus and entry count, but not a complete immutable corpus revision, random seed, timing-control audit, or submission-validity verdict. The source-verified shortlist is still provisional in these respects.
- MTP is recorded, but the small aggregate alone does not certify speculative-acceptance controls. No model-quality or correctness equivalence is inferred from serving throughput.
- Successful profiling metrics can omit failed requests. Profiling-only error counts are shown separately; they are not all warmup errors and are not subtracted from throughput a second time.

## Error-accounting verification

The pinned producer source independently counts warmup rows and error rows, then drops their union. Therefore profilingErrors = records_dropped_total - records_warmup_dropped, and profilingAttempts = records_total - records_warmup_dropped. Dividing records_error_dropped by total requests would incorrectly include warmup failures. The source code is archived under data/inferencex/audit/request-accounting-<commit>.py; run commit SHAs are in the audit manifest. Code checks all accounting identities before using this derivation.

## Continuation

Use this shortlist for an evidence-labeled exploratory comparison, not a single universal unification multiplier. The next validation step is to obtain full replay metadata and run comparable concurrency sweeps around the latency boundary on both allocations. Start with example 1, which has matching image/router/run and comparable offered load. See ../../docs/HANDOFF.md for project state and commands.

Generated with node scripts/inferencex/shortlist.js. Data: shortlist.json and shortlist.csv. Broad exploratory output remains report.md and comparisons.csv; its earlier provisional records are not silently rewritten by this audit.
`;
  await mkdir(out,{recursive:true});
  await writeFile(`${out}/shortlist.md`,report);
  await writeFile(`${out}/shortlist.json`,JSON.stringify({profile:comparisons.profile,selected,pointAudits:audits},null,2));
  const csvRows=selected.map(({sourceAudit,...c})=>c);
  const fields=Object.keys(csvRows[0]);
  const quote=x=>'"'+String(typeof x==='object'?JSON.stringify(x):x??'').replaceAll('"','""')+'"';
  await writeFile(`${out}/shortlist.csv`,[fields.map(quote).join(','),...csvRows.map(r=>fields.map(k=>quote(r[k])).join(','))].join('\n')+'\n');
  console.log(`Generated ${selected.length} shortlisted comparisons; verified ${Object.keys(audits).length} source points`);
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/shortlist.js')) await generateShortlist();
