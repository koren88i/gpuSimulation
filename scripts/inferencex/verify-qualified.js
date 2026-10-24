import {readFile,writeFile} from 'node:fs/promises';
import {matchAggregate,profilingErrors} from './shortlist.js';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
// InferenceX benchmark-mapper normalizes Enroot registry separators from # to /.
export const sourceMatches=(row,a)=>matchAggregate(row,{...a,image:a.image?.replaceAll('#','/')});
export function verifyPoint(row,a) {
  if(!sourceMatches(row,a))throw new Error('Original aggregate identity or performance metrics differ');
  if(!Number.isFinite(a.num_prefill_gpu)||!Number.isFinite(a.num_decode_gpu))throw new Error('Incomplete evidence: original aggregate omits explicit GPU allocation totals');
  if(a.num_prefill_gpu+a.num_decode_gpu!==row.topology.gpus)throw new Error('Allocated GPU total differs');
  if(!a.model||a.dataset?.loader!==row.dataset)throw new Error('Checkpoint missing or corpus loader differs');
  return {modelCheckpoint:a.model,dataset:a.dataset,gpuTotal:a.num_prefill_gpu+a.num_decode_gpu,
    prefillGpu:a.num_prefill_gpu,decodeGpu:a.num_decode_gpu,router:a.router??null,
    profilingErrors:profilingErrors(a.request_accounting),metricMatch:true};
}
export function verifyPair(c,points) {
  const small=points[c.smallId],large=points[c.largeId];
  if(small?.status!=='verified'||large?.status!=='verified')return {status:[small,large].some(p=>p?.status==='mismatch')?'mismatch':'incomplete',reason:[['Smaller',small],['Larger',large]].filter(([,p])=>p?.status!=='verified').map(([side,p])=>`${side}: ${p?.reason??'source point unavailable'}`).join(' ')};
  if(small.modelCheckpoint!==large.modelCheckpoint)return {status:'mismatch',reason:'Actual model checkpoints differ.'};
  if(JSON.stringify(small.dataset)!==JSON.stringify(large.dataset))return {status:'mismatch',reason:'Recorded corpus metadata differs.'};
  if(small.gpuTotal*c.copies!==large.gpuTotal)return {status:'mismatch',reason:'Original GPU allocations do not match the scaled budget.'};
  return {status:'verified',reason:'Both original aggregates match API identity, allocation, metrics and profiling accounting; checkpoint and recorded corpus metadata agree across the pair.'};
}
async function main(){
  const manifest=await read('data/inferencex/audit/manifest-qualified.json');
  const rows=await read('reports/inferencex/benchmarks.json');
  const {comparisons}=await read('reports/inferencex/comparisons.json');
  const qualified=comparisons.filter(c=>c.policy==='latency_qualified_sessions'&&c.largeActiveSessions!=null&&c.splitActiveSessions!=null);
  const artifacts=await Promise.all(manifest.artifacts.map(async art=>({...art,records:await read(art.file)})));
  const points={};
  for(const id of manifest.selectedIds){
    const row=rows.find(r=>r.id===id),matches=[];
    for(const art of artifacts.filter(a=>row.runUrl.includes(`/runs/${a.runId}/`)))
      for(const record of art.records)if(sourceMatches(row,record.data))matches.push({art,record});
    if(matches.length!==1){points[id]={status:'incomplete',reason:`Expected one exact original aggregate match; found ${matches.length}.`,runUrl:row.runUrl};continue;}
    const {art,record}=matches[0];
    try{points[id]={status:'verified',...verifyPoint(row,record.data),rowId:id,artifactId:art.id,artifactSha256:art.sha256,
      artifactFile:art.file,filename:record.filename,runUrl:row.runUrl,sourceSha:manifest.runs.find(r=>r.id===art.runId)?.sha};}
    catch(e){points[id]={status:e.message.startsWith('Incomplete evidence:')?'incomplete':'mismatch',reason:e.message,artifactFile:art.file,runUrl:row.runUrl};}
  }
  const pairs=Object.fromEntries(qualified.map(c=>[c.id,verifyPair(c,points)]));
  const count=items=>Object.values(items).reduce((a,v)=>(a[v.status]=(a[v.status]??0)+1,a),{});
  const output={points,pairs,counts:{points:count(points),pairs:count(pairs)},downloadErrors:manifest.errors,
    limitations:'Aggregate verification does not prove optimal capacity, complete replay compliance, immutable corpus revision, physical host placement or production suitability.'};
  await writeFile('reports/inferencex/qualified-audit.json',JSON.stringify(output,null,2));
  const lines=['# Source verification of all qualified session comparisons','',output.limitations,'',
    '| Model / hardware | Allocation | Status | Finding |','|---|---|---|---|',
    ...qualified.map(c=>`| ${c.model} / ${c.hardware} | ${c.largeNodeEquivalents} vs ${Array(c.copies).fill(c.smallNodeEquivalents).join('+')} | ${pairs[c.id].status} | ${pairs[c.id].reason} |`)];
  await writeFile('reports/inferencex/qualified-audit.md',lines.join('\n')+'\n');
  console.log(JSON.stringify(output.counts));
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/verify-qualified.js'))await main();
