import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {verifyPoint,verifyPair,sourceMatches} from '../scripts/inferencex/verify-qualified.js';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const audit=await read('reports/inferencex/qualified-audit.json');
const rows=await read('reports/inferencex/benchmarks.json');
test('all qualified pairs have explicit audit outcomes',()=>{
  assert.equal(Object.keys(audit.points).length,18);
  assert.equal(Object.keys(audit.pairs).length,15);
  assert.deepEqual(audit.counts,{points:{verified:17,incomplete:1},pairs:{verified:11,incomplete:4}});
  assert.match(audit.points['439339'].reason,/omits explicit GPU/);
});
test('registry separator normalization preserves exact source identity checks',async()=>{
  const row=rows.find(r=>r.id==='440971');
  const records=await read('data/inferencex/audit/artifact-9833004661.json');
  const a=records.find(r=>sourceMatches(row,r.data)).data;
  assert.equal(verifyPoint(row,a).gpuTotal,36);
  assert.throws(()=>verifyPoint({...row,concurrency:5},a));
  assert.throws(()=>verifyPoint(row,{...a,num_decode_gpu:64}));
});
test('pair verification rejects checkpoint, dataset and GPU-budget mismatches',()=>{
  const c={smallId:'s',largeId:'l',copies:2};
  const s={status:'verified',modelCheckpoint:'model',dataset:{loader:'corpus'},gpuTotal:8};
  const l={...s,gpuTotal:16};
  assert.equal(verifyPair(c,{s,l}).status,'verified');
  for(const change of [{modelCheckpoint:'other'},{dataset:{loader:'other'}},{gpuTotal:24}])assert.equal(verifyPair(c,{s,l:{...l,...change}}).status,'mismatch');
  assert.equal(verifyPair(c,{s,l:{status:'incomplete',reason:'Missing allocation'}}).status,'incomplete');
});
