import {readFile,writeFile,copyFile} from 'node:fs/promises';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const comparison=await read('reports/inferencex/comparisons.json');
const shortlist=await read('reports/inferencex/shortlist.json');
const coverage=await read('reports/inferencex/coverage.json');
const rows=await read('reports/inferencex/benchmarks.json');
const sourceAudit=await read('reports/inferencex/qualified-audit.json');
const ids=new Set(comparison.comparisons.flatMap(c=>[c.smallId,c.largeId]));
const points=Object.fromEntries(rows.filter(r=>ids.has(r.id)).map(r=>[r.id,{
  id:r.id,model:r.model,hardware:r.hardware,type:r.type,concurrency:r.concurrency,
  outputTps:r.outputTps,rps:r.rps,dataset:r.dataset,scenarioValid:r.scenarioValid,
  topology:r.topology,latency:r.latency,metrics:{p90_ttft:r.metrics.p90_ttft,p90_tpot:r.metrics.p90_tpot,
    median_ttft:r.metrics.median_ttft,mean_e2el:r.metrics.mean_e2el},
}]));
const data={profile:comparison.profile,pairs:comparison.comparisons,
  shortlist:shortlist.selected,points,coverage:{counts:coverage.counts,requested:coverage.requested,exclusions:coverage.exclusions},
  sourceAudit,pointAudits:{...shortlist.pointAudits,...Object.fromEntries(Object.entries(sourceAudit.points).filter(([,p])=>p.status==='verified'))}};
await writeFile('data/inferencex-ui.json',JSON.stringify(data));
for (const name of ['shortlist','comparisons']) await copyFile(`reports/inferencex/${name}.csv`,`data/${name}.csv`);
console.log(`Report UI snapshot: ${data.pairs.length} comparisons, ${Object.keys(points).length} source points`);
