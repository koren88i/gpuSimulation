import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const root = 'data/inferencex';
export const base = 'https://inferencex.semianalysis.com';
export const mapping = {
  dsr1:'DeepSeek-R1-0528', gptoss120b:'gpt-oss-120b', llama70b:'Llama-3.3-70B-Instruct-FP8',
  'qwen3.5':'Qwen-3.5-397B-A17B', 'qwen3.8next':'Qwen3.8-Flash-Next',
  'kimik2.5':'Kimi-K2.5', 'kimik2.6':'Kimi-K2.5', 'kimik2.7-code':'Kimi-K2.5', kimik3:'Kimi-K3',
  'minimaxm2.5':'MiniMax-M2.5', 'minimaxm2.7':'MiniMax-M2.5', minimaxm3:'MiniMax-M3',
  glm5:'GLM-5', 'glm5.1':'GLM-5', 'glm5.2':'GLM-5.2', dsv4:'DeepSeek-V4-Pro',
};
export const hardware = ['b200','b300','h200','h100','gb200','gb300'];
export const hash = text => createHash('sha256').update(text).digest('hex');
export async function cached(path, refresh = false) {
  const url = base + path;
  const key = hash(url).slice(0,24);
  await mkdir(`${root}/raw`, {recursive:true});
  if (!refresh) {
    try {
      const entry = JSON.parse(await readFile(`${root}/raw/${key}.meta.json`, 'utf8'));
      const body = await readFile(`${root}/raw/${entry.sha256}.json`, 'utf8');
      if (hash(body) !== entry.sha256) throw new Error('Snapshot checksum mismatch');
      return {entry, data:JSON.parse(body)};
    } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  let last;
  for (let attempt=0; attempt<3; attempt++) {
    try {
      const response = await fetch(url, {signal:AbortSignal.timeout(60000)});
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      const body = await response.text();
      const data = JSON.parse(body);
      const sha256 = hash(body);
      const entry = {url,sha256,retrievedAt:new Date().toISOString(),bytes:Buffer.byteLength(body),count:Array.isArray(data)?data.length:null};
      await writeFile(`${root}/raw/${sha256}.json`, body);
      await writeFile(`${root}/raw/${key}.meta.json`, JSON.stringify(entry,null,2));
      return {entry,data};
    } catch (e) {
      last=e;
      if (attempt<2) await new Promise(resolve=>setTimeout(resolve,1000*2**attempt));
    }
  }
  throw last;
}
export async function download() {
  const refresh = process.argv.includes('--refresh');
  const availability = await cached('/api/v1/availability', refresh);
  const queries = new Map();
  for (const r of availability.data) {
    if (!hardware.includes(r.hardware) || !mapping[r.model]) continue;
    const query = new URLSearchParams({model:mapping[r.model]});
    if (r.benchmark_type==='agentic_traces') query.set('benchmarkType','agentic_traces');
    else if (r.isl && r.osl) { query.set('isl',r.isl);query.set('osl',r.osl); }
    else continue;
    queries.set(query.toString(),{displayModel:mapping[r.model],type:r.benchmark_type});
  }
  const manifest = {schemaVersion:1,availability:availability.entry,hardware,mapping,queries:[],errors:[]};
  const jobs=[...queries];
  for (let i=0;i<jobs.length;i+=3) {
    const results = await Promise.allSettled(jobs.slice(i,i+3).map(async ([q,info])=>{
      const {entry,data}=await cached(`/api/v1/benchmarks/history?${q}`, refresh);
      if (!Array.isArray(data)) throw new Error(`Unexpected history payload: ${q}`);
      return {...entry,...info};
    }));
    results.forEach((r,j)=>r.status==='fulfilled'?manifest.queries.push(r.value):manifest.errors.push({query:jobs[i+j][0],error:String(r.reason)}));
    console.log(`History ${Math.min(i+3,jobs.length)}/${jobs.length}; errors ${manifest.errors.length}`);
    await writeFile(`${root}/manifest.json`,JSON.stringify(manifest,null,2));
  }
  console.log(`Saved ${manifest.queries.length} histories; ${manifest.errors.length} errors`);
  if (manifest.errors.length) process.exitCode=1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await download();
