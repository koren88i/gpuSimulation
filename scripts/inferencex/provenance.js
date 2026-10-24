import { readFile, writeFile } from 'node:fs/promises';
import { cached,root,hardware } from './fetch.js';
import { topology } from './normalize.js';
export const provenanceKey = r => JSON.stringify([r.run_url,r.model,r.hardware,r.framework,r.image,r.offload_mode]);
const manifest=JSON.parse(await readFile(`${root}/manifest.json`,'utf8'));
const groups=new Map();
for (const entry of manifest.queries.filter(e=>e.type==='agentic_traces')) {
  const rows=JSON.parse(await readFile(`${root}/raw/${entry.sha256}.json`,'utf8'));
  for (const r of rows) {
    if (hardware.includes(r.hardware)&&topology(r).eligible) {
      const key=provenanceKey(r);
      if (!groups.has(key)) groups.set(key,r);
    }
  }
}
const entries={},errors=[];
const jobs=[...groups];
for (let i=0;i<jobs.length;i+=3) {
  const results=await Promise.allSettled(jobs.slice(i,i+3).map(async ([key,r])=>{
    const {entry,data}=await cached(`/api/v1/server-log-search?id=${r.id}&q=public-dataset&limit=20`);
    const text=(data.matches??[]).map(m=>m.before+m.match+m.after).join('\n');
    const names=[...new Set(text.match(/semianalysis_cc_traces_weka(?:_[a-zA-Z0-9]+)*/g)??[])];
    // Only date-pinned names; rolling aliases and multiple corpora need review.
    const pinned=names.filter(n=>/\d{6}/.test(n));
    return [key,{dataset:pinned.length===1?pinned[0]:null,datasetCandidates:names,scenarioValid:null,
      representativeRow:String(r.id),scope:'inferred from same run/model/hardware/framework/image/offload group',
      caveat:'Dataset revision, seed, sampling, scenario validity and exact per-row replay controls not verified',source:entry}];
  }));
  results.forEach((r,j)=>r.status==='fulfilled'?entries[r.value[0]]=r.value[1]:errors.push({key:jobs[i+j][0],error:String(r.reason)}));
  await writeFile(`${root}/provenance.json`,JSON.stringify({entries,errors},null,2));
  console.log(`Provenance ${Math.min(i+3,jobs.length)}/${jobs.length}; errors ${errors.length}`);
}
