import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { normalize } from './normalize.js';
import { comparisons } from './compare.js';
import { validateProfile, compareValues } from './capacity.js';

const root='data/inferencex',out='reports/inferencex';
const profilePath=process.argv[process.argv.indexOf('--profile')+1];
const p=validateProfile(JSON.parse(await readFile(process.argv.includes('--profile')?profilePath:`${root}/profiles/agentx-coding-v1.json`,'utf8')));
const m=JSON.parse(await readFile(`${root}/manifest.json`,'utf8'));
let provenance={entries:{},errors:[]};
try { provenance=JSON.parse(await readFile(`${root}/provenance.json`,'utf8')); } catch(e) {if(e.code!=='ENOENT') throw e;}
const key=r=>JSON.stringify([r.run_url,r.model,r.hardware,r.framework,r.image,r.offload_mode]);
const seen=new Map(),conflicts=new Set();
let downloaded=0;
for (const entry of m.queries) {
  const text=await readFile(`${root}/raw/${entry.sha256}.json`,'utf8');
  if (createHash('sha256').update(text).digest('hex')!==entry.sha256) throw new Error(`Corrupt snapshot: ${entry.url}`);
  for (const r of JSON.parse(text)) {
    downloaded++;
    if (!m.hardware.includes(r.hardware)) continue;
    if (p.selection?.asOfDate && r.date>p.selection.asOfDate) continue;
    if (p.selection?.maxAgeDays!=null && (Date.parse(p.selection.asOfDate)-Date.parse(r.date))/86400000>p.selection.maxAgeDays) continue;
    const id=String(r.id);
    if (seen.has(id)) {
      if (JSON.stringify(seen.get(id).raw)!==JSON.stringify(r)) conflicts.add(id);
      continue;
    }
    seen.set(id,{raw:r,row:normalize(r,{url:entry.url,sha256:entry.sha256},p,provenance.entries[key(r)])});
  }
}
const rows=[...seen].filter(([id])=>!conflicts.has(id)).map(([,v])=>v.row).sort((a,b)=>Number(a.id)-Number(b.id));
const pairs=comparisons(rows).filter(r=>p.selection?.maxPairDateGapDays==null||Math.abs(Date.parse(r.smallDate)-Date.parse(r.largeDate))/86400000<=p.selection.maxPairDateGapDays);
const counts={downloaded,uniqueInScope:rows.length,conflictingIds:[...conflicts],
  topologyQualified:rows.filter(r=>r.topology.eligible).length,
  agenticRows:rows.filter(r=>r.type==='agentic_traces').length,
  comparisons:pairs.length,agenticComparisons:pairs.filter(r=>r.type==='agentic_traces').length,
  latencyQualifiedComparisons:pairs.filter(r=>r.policy!=='best_observed_throughput').length,
  historyErrors:m.errors,provenanceErrors:provenance.errors};
const coverage=new Map(),exclusions={};
for(const r of rows) {
  const k=[r.model,r.hardware,r.type].join('|');
  if(!coverage.has(k)) coverage.set(k,{model:r.model,hardware:r.hardware,type:r.type,rows:0,sizes:new Set(),qualifiedRows:0,latencyQualifiedRows:0});
  const c=coverage.get(k);c.rows++;
  if(r.topology.eligible) {c.sizes.add(r.topology.nodeEquivalents);c.qualifiedRows++;if(r.latency.passes)c.latencyQualifiedRows++;}
  for(const reason of r.topology.reasons) exclusions[reason]=(exclusions[reason]??0)+1;
}
const coverageRows=[...coverage.values()].map(c=>({...c,sizes:[...c.sizes].sort((a,b)=>a-b)})).sort((a,b)=>[a.model,a.hardware,a.type].join().localeCompare([b.model,b.hardware,b.type].join()));
const flatten=r=>({id:r.id,model:r.model,hardware:r.hardware,type:r.type,precision:r.precision,
  specMethod:r.specMethod,framework:r.framework,image:r.image,date:r.date,
  nodeEquivalents:r.topology.nodeEquivalents,gpus:r.topology.gpus,gpusPerNode:r.topology.nodeGpus,
  nodeUnit:r.topology.unit,topologyEligible:r.topology.eligible,topologyReasons:r.topology.reasons,
  concurrency:r.concurrency,concurrencyUnit:r.concurrencyUnit,
  isl:r.isl,osl:r.osl,dataset:r.dataset,scenarioValid:r.scenarioValid,
  outputTps:r.outputTps,outputMethod:r.outputMethod,rps:r.rps,rpsMethod:r.rpsMethod,
  medianTtft:r.metrics.median_ttft??null,p90Ttft:r.metrics.p90_ttft??null,p90Tpot:r.metrics.p90_tpot??null,
  meanResponseSeconds:r.metrics.mean_e2el??null,latencyPasses:r.latency.passes,
  latencyReasons:r.latency.reasons,activeSessions:r.capacity.activeSessions,dau:r.capacity.dau,
  capacityStatus:r.capacity.status,profileId:r.capacity.profileId,runUrl:r.runUrl,sourceUrl:r.source.url,sourceSha256:r.source.sha256});
const quote=x=>'"'+String(x==null?'':typeof x==='object'?JSON.stringify(x):x).replaceAll('"','""')+'"';
function csv(records) {if(!records.length)return '';const keys=[...new Set(records.flatMap(Object.keys))];return [keys.map(quote).join(','),...records.map(r=>keys.map(k=>quote(r[k])).join(','))].join('\n')+'\n';}
const n=x=>x==null?'—':x.toLocaleString('en-US',{maximumFractionDigits:2});
const md=x=>String(x??'—').replaceAll('|','\\|').replaceAll('\n',' ');
const table=(headers,records)=>[headers.map(md).join(' | '),headers.map(()=>'---').join(' | '),...records.map(r=>r.map(md).join(' | '))].join('\n');
function pairTable(list) {
  return table(['Model / hardware / precision','Workload','Unit','Large vs split','Large / split output tok/s','Throughput gain','Large / split active sessions','Large / split DAU','Source rows'],list.map(c=>[
    `${c.model} / ${c.hardware} / ${c.precision}`,c.type==='agentic_traces'?`AgentX (${c.specMethod})`:`${c.isl}/${c.osl}`,
    c.gpusPerNode===4?'4-GPU trays':'8-GPU servers',
    `${c.largeNodeEquivalents} vs ${Array(c.copies).fill(c.smallNodeEquivalents).join('+')}`,
    `${n(c.largeOutputTps)} / ${n(c.splitOutputTps)}`,`${n(c.throughputGainPct)}%`,
    `${n(c.largeActiveSessions)} / ${n(c.splitActiveSessions)}`,`${n(c.largeDau)} / ${n(c.splitDau)}`,
    `[${c.largeId}](${c.largeRunUrl}) / [${c.smallId}](${c.smallRunUrl})`]));
}
function diverse(list,limit=20) {
  const chosen=[],groups=new Set();
  for(const r of list) {const k=[r.model,r.hardware].join('|');if(!groups.has(k)){chosen.push(r);groups.add(k);}if(chosen.length>=limit)break;}
  return chosen;
}
const order=(a,b)=>a.copies-b.copies||b.smallNodeEquivalents-a.smallNodeEquivalents||a.id.localeCompare(b.id);
const agentic=pairs.filter(c=>c.policy==='latency_qualified_sessions').sort(order);
const fixed=pairs.filter(c=>c.type==='single_turn'&&c.policy==='best_observed_throughput'&&c.specMethod==='none').sort(order);
const latencyFixed=pairs.filter(c=>c.type==='single_turn'&&c.policy==='latency_qualified_throughput'&&c.specMethod==='none').sort((a,b)=>b.largeNodeEquivalents-a.largeNodeEquivalents||b.throughputGainPct-a.throughputGainPct);
const examples=[['kimik3',16,8],['minimaxm2.7',12,4],['dsv4',8,4]];
const requested=examples.map(([model,large,small])=>({model,large,small,
  matches:pairs.filter(c=>c.model===model&&c.largeNodeEquivalents===large&&c.smallNodeEquivalents===small).map(c=>c.id),
  available:coverageRows.filter(c=>c.model===model).map(c=>({hardware:c.hardware,type:c.type,sizes:c.sizes}))}));
let regression=null;
const small=rows.find(r=>r.id==='428445'),large=rows.find(r=>r.id==='440856');
if(small&&large) regression={smallId:small.id,largeId:large.id,...compareValues(large,small,2)};
const profileHash=createHash('sha256').update(JSON.stringify(p)).digest('hex');
const shown=[...diverse(agentic),...diverse(fixed),...diverse(latencyFixed)];
const detailTable=table(['Rows large / small','Configured concurrency large / split','p90 TTFT seconds large / small','p90 TPOT seconds large / small','Software large / small','Dates large / small','Flags'],shown.map(c=>[
  `${c.largeId} / ${c.smallId}`,`${c.largeConcurrency} / ${c.splitConcurrency}`,
  `${n(c.largeP90Ttft)} / ${n(c.smallP90Ttft)}`,`${c.largeP90Tpot??'missing'} / ${c.smallP90Tpot??'missing'}`,
  `${c.largeFramework} / ${c.smallFramework}`,`${c.largeDate} / ${c.smallDate}`,c.flags.join(', ')]));
await mkdir(out,{recursive:true});
await writeFile(`${out}/benchmarks.json`,JSON.stringify(rows));
await writeFile(`${out}/benchmarks.csv`,csv(rows.map(flatten)));
await writeFile(`${out}/comparisons.json`,JSON.stringify({profile:p,profileHash,comparisons:pairs},null,2));
await writeFile(`${out}/comparisons.csv`,csv(pairs));
await writeFile(`${out}/coverage.json`,JSON.stringify({counts,exclusions,requested,coverage:coverageRows,regression},null,2));
await writeFile(`${out}/coverage.csv`,csv(coverageRows));
await writeFile(`${out}/profile.json`,JSON.stringify(p,null,2));
const manifestHash=createHash('sha256').update(JSON.stringify(m)).digest('hex');
await writeFile(`${out}/reproducibility.json`,JSON.stringify({schemaVersion:1,manifestHash,profileHash,
  sourceQueries:m.queries,provenanceSources:Object.values(provenance.entries).map(e=>e.source),
  sourceCodeHashes:Object.fromEntries(await Promise.all(['fetch','normalize','capacity','compare','report','provenance'].map(async file=>[file,createHash('sha256').update(await readFile(`scripts/inferencex/${file}.js`)).digest('hex')])) )},null,2));
const report=`# InferenceX: larger deployments versus independent smaller deployments

Generated entirely by scripts/inferencex/report.js from archived API responses. Profile: **${p.id}**. The CSV/JSON files contain every comparison; tables below show a spread of models/hardware, not a claim of universal scaling behavior.

For the separately reviewed source-artifact shortlist, see [shortlist.md](shortlist.md). It verifies selected points more deeply without upgrading the broad exploratory records below to validated capacity claims.

## What was found

- ${n(counts.uniqueInScope)} unique benchmark rows in scope, from ${m.queries.length} full-history queries.
- ${n(counts.topologyQualified)} rows passed allocated-node consistency checks; ${n(counts.agenticRows)} agentic rows were inspected.
- ${n(counts.comparisons)} comparison records across operating-point policies; ${n(counts.agenticComparisons)} are AgentX records. These counts are not unique model/size pairs.
- Download errors: ${m.errors.length}. Provenance lookup errors: ${provenance.errors.length}. Conflicting duplicate IDs excluded: ${conflicts.size}.

## Interpretation and units

Large deployments are measured. Split deployments multiply a measured smaller deployment's throughput/concurrency/capacity by an integer copy count; this assumes independent copies sustain their measured load. Per-request latency is unchanged. Larger deployments are described by their actual P/D allocation and serving stack, not assumed to have one globally shared KV cache.

B200/B300/H200/H100 use **eight-GPU server equivalents**. Supplemental GB200/GB300 results use **four-GPU NVL compute-tray equivalents**. We validate allocated GPU arithmetic, worker divisibility, and available throughput/power cross-checks, but exact physical host placement is not independently verified. These are allocation comparisons, not proof that all hosts belong to one scheduling or KV-sharing domain. [NVIDIA NVL hardware](https://docs.nvidia.com/enterprise-reference-architectures/nvl72-ai-factory/latest/components.html)

Do not interpret GB compute trays as eight-GPU B200 servers. All pairs use the same hardware, raw model key, precision, workload type/length and speculative method. Different software/date/offload/topology settings are flagged in comparisons.csv. Best-observed results can be old; dates are retained. No causal claim about unification alone is made.

**Best observed is not proven optimal.** Some allocation recipes were tested at only one or two concurrency settings. Large gains can reflect an undersampled smaller setup. Both sides' observed concurrency sweeps are exported, and sparse sweeps are flagged. Summary examples prefer fewer independent copies and then larger smaller-deployment sizes, rather than selecting the biggest gains. Full-history selection as of ${p.selection?.asOfDate??'latest snapshot'} uses ${p.selection?.maxAgeDays??'no'} maximum age and ${p.selection?.maxPairDateGapDays??'no'} maximum date gap (days).

## AgentX coding sessions and DAU

AgentX concurrency is live root session trees, including subagent fan-out and recorded pauses. We assume one tree per active user. Dataset names are recovered from representative logs in the same run/configuration group. **Submission validity, immutable corpus revision, and exact per-row replay controls remain unverified in these public summary records; AgentX comparisons and capacity estimates are provisional.** They must not be used as verified production capacity. [AgentX methodology](https://inferencex.semianalysis.com/about)

The shared profile uses ${p.activeAgentHoursPerDau} active agent-hours per DAU, a ${p.activityWindowHours}-hour activity window, ${p.peakToWindowAverageRatio}× peak/average within that window, and ${p.reserveFraction*100}% reserve. These human-usage and reserve values are **planning assumptions**, not claims about measured developers. The full-day peak ratio is ${(24/p.activityWindowHours*p.peakToWindowAverageRatio)}. Code computes active sessions = configured root concurrency × (1 − reserve) / sessions per user, and DAU = active sessions × 24 / (active hours per DAU × full-day peak ratio).

Latency limits: ${Object.entries(p.latencyLimits).map(([k,v])=>`${k} ≤ ${v} seconds`).join('; ')}. Missing required percentiles fail qualification. Reserve is a capacity haircut, not a prediction of new latency at a lower load. Session estimates represent occupancy capacity, not completed coding tasks per day.

### Coding-session comparisons at the same latency limits

Each side selects its highest qualifying measured root-session concurrency within the same dataset/model/hardware group. Output throughput shown belongs to that selected point; it is not separately maximized. Negative gains are retained.

${agentic.length?pairTable(diverse(agentic)):'No eligible paired AgentX operating points were identified under the default limits and workload-metadata requirements.'}

## Fixed-length throughput comparisons

These retain the original requested arithmetic: larger measured throughput versus k times smaller measured throughput. They do **not** measure multi-turn coding sessions. The coding-session/DAU fields are blank by default; enabling the separately labeled fixedSequenceProxy configuration gives hypothetical single-request user estimates, not an AgentX-derived coding capacity claim.

### Best observed throughput, without a latency ceiling

${fixed.length?pairTable(diverse(fixed)):'No qualifying pairs.'}

### Throughput under the default latency limits

${latencyFixed.length?pairTable(diverse(latencyFixed)):'No qualifying pairs.'}

### Latency, concurrency, and differences for the displayed examples

${detailTable}

## Requested example coverage

${requested.map(e=>`- **${e.model}: ${e.large} vs ${Array(e.large/e.small).fill(e.small).join('+')}**: ${e.matches.length} comparison records. Observed eligible allocation sizes: ${e.available.map(a=>`${a.hardware} ${a.type} [${a.sizes.join(', ')}]`).join('; ')||'no rows for this exact model key'}.`).join('\n')}

Kimi 2.5/2.6/2.7-Code and MiniMax 2.5/2.7 remain different model keys even when the site groups them under one display model. Missing requested pairs are not substituted with a different version.

## DeepSeek regression example

${regression?`Rows ${regression.smallId} and ${regression.largeId}: doubled smaller throughput ${n(regression.splitOutputTps)} output tok/s; larger throughput ${n(regression.largeOutputTps)}; gain ${n(regression.throughputGainPct)}%. This reproduces the earlier arithmetic and preserves its software/date mismatch. It is not necessarily the best point selected by the full-history search.`:'The original fixture rows were not in this snapshot.'}

## Exclusions and audit

${table(['Reason','Rows (reasons may overlap)'],Object.entries(exclusions).map(([k,v])=>[k,n(v)]))}

Raw API sources, source hashes, row IDs, dates, configuration flags, profile hash and code hashes are retained in the JSON outputs and reproducibility.json. GPU count conflicts are quarantined, not silently corrected. Missing throughput is not zero. Speculative rows are exported but their synthetic-acceptance provenance is unverified; summary fixed-length tables above use no speculative decoding.

## Files and reproduction

- comparisons.csv / comparisons.json: every pair, metrics, flags and source links.
- benchmarks.csv / benchmarks.json: every normalized point, including exclusions and provisional per-point capacities.
- coverage.csv / coverage.json: discovered allocation sizes, exclusion counts, requested examples.
- profile.json: effective editable assumptions.
- reproducibility.json: snapshot and code hashes.

From the repository root, run \`node scripts/inferencex/fetch.js\`, then \`node scripts/inferencex/provenance.js\`, then \`node scripts/inferencex/report.js\`. Fetches use cached content-addressed snapshots unless --refresh is provided to fetch.js. Report generation is offline. Use \`node scripts/inferencex/report.js --profile path/to/profile.json\` to change assumptions identically on both sides. Run \`node --test tests/inferencex.test.js\` for validation.

API reference: https://inferencex.semianalysis.com/api
`;
await writeFile(`${out}/report.md`,report);
console.log(JSON.stringify(counts));
