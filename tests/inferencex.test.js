import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalize,topology} from '../scripts/inferencex/normalize.js';
import {capacity,compareValues,validateProfile,gain} from '../scripts/inferencex/capacity.js';
import {comparisons} from '../scripts/inferencex/compare.js';
import {profilingErrors,matchAggregate} from '../scripts/inferencex/shortlist.js';
const p=JSON.parse(readFileSync('data/inferencex/profiles/agentx-coding-v1.json'));
const base={id:1,model:'dsv4',hardware:'b200',benchmark_type:'single_turn',precision:'fp4',spec_method:'none',
  disagg:true,is_multinode:true,num_prefill_gpu:24,num_decode_gpu:8,prefill_num_workers:3,decode_num_workers:1,
  isl:8192,osl:1024,conc:8192,date:'2026-06-25',framework:'vllm',metrics:{output_tput_per_gpu:3628.0595635398413,p90_ttft:2,p90_tpot:.05}};
test('P/D GPU accounting and output denominator',()=>{
  const r=normalize(base,{},p);
  assert.equal(r.topology.nodeEquivalents,4);
  assert.ok(Math.abs(r.outputTps-29024.47650831873)<1e-8);
});
test('shared prefill/decode devices counted once; label conflicts excluded',()=>{
  assert.equal(topology({...base,disagg:false,is_multinode:false,num_prefill_gpu:8,num_decode_gpu:8}).gpus,8);
  assert.equal(topology({...base,disagg:false,is_multinode:false,num_prefill_gpu:64,num_decode_gpu:64}).eligible,false);
});
test('AgentX direct output and denominator conflict',()=>{
  const r=normalize({...base,benchmark_type:'agentic_traces',metrics:{output_tput_tps:100,total_tput_tps:1000,tput_per_gpu:125}}, {},p);
  assert.equal(r.outputTps,100);assert.ok(r.topology.reasons.includes('throughput_gpu_denominator_conflict'));
});
test('partial workers excluded even when total fills servers',()=>{
  assert.equal(topology({...base,num_prefill_gpu:16,prefill_num_workers:4}).eligible,false);
});
test('NVL tray unit is four GPUs',()=>{
  assert.equal(topology({...base,hardware:'gb300'}).nodeEquivalents,8);
});
test('AgentX capacity respects latency, validity and common profile',()=>{
  const r=normalize({...base,benchmark_type:'agentic_traces',conc:100}, {},p,{dataset:'pinned',scenarioValid:true});
  assert.equal(r.capacity.activeSessions,80);assert.equal(r.capacity.dau,160);
  assert.equal(capacity({...r,scenarioValid:false},p).dau,null);
  assert.equal(capacity({...r,latency:{passes:false}},p).dau,null);
  assert.equal(normalize({...base,metrics:{}},{},p).latency.passes,false);
});
test('fixed proxies disabled and missing values remain null',()=>{
  assert.equal(normalize(base,{},p).capacity.dau,null);
  assert.equal(normalize({...base,metrics:{}},{},p).outputTps,null);
  assert.equal(gain(0,0),null);assert.equal(gain(1,2),-50);
});
test('DeepSeek doubling regression preserves source metrics',()=>{
  const s=normalize(base,{},p);
  const l=normalize({...base,id:2,num_prefill_gpu:48,num_decode_gpu:16,prefill_num_workers:6,decode_num_workers:2,
    metrics:{...base.metrics,output_tput_per_gpu:4325.504791222374}}, {},p);
  const c=compareValues(l,s,2);
  assert.ok(Math.abs(c.throughputGainPct-19.22364325799672)<1e-8);
  assert.equal(c.splitConcurrency,16384);assert.equal(c.largeConcurrency,8192);
  assert.equal(s.metrics.p90_ttft,2);
});
test('selection keeps raw model identities and deterministic best observations',()=>{
  const s=normalize(base,{},p);
  const l=normalize({...base,id:2,num_prefill_gpu:48,num_decode_gpu:16,prefill_num_workers:6,decode_num_workers:2}, {},p);
  assert.equal(comparisons([s,l]).length,2);
  assert.equal(comparisons([s,{...l,model:'different'}]).length,0);
  assert.deepEqual(comparisons([s,l]),comparisons([l,s]));
});
test('invalid user profiles rejected',()=>{
  assert.throws(()=>validateProfile({...p,reserveFraction:1}));
  assert.throws(()=>validateProfile({...p,activityWindowHours:0}));
});
test('generated comparisons preserve budget, formulas, and latency qualification',()=>{
  const output=JSON.parse(readFileSync('reports/inferencex/comparisons.json'));
  const rows=new Map(JSON.parse(readFileSync('reports/inferencex/benchmarks.json')).map(r=>[r.id,r]));
  for(const c of output.comparisons) {
    const s=rows.get(c.smallId),l=rows.get(c.largeId);
    assert.equal(c.largeNodeEquivalents,c.smallNodeEquivalents*c.copies);
    assert.equal(s.model,l.model);assert.equal(s.hardware,l.hardware);assert.equal(s.type,l.type);
    assert.equal(s.specMethod,l.specMethod);assert.equal(s.precision,l.precision);
    assert.equal(s.isl,l.isl);assert.equal(s.osl,l.osl);
    assert.deepEqual(compareValues(l,s,c.copies),Object.fromEntries(Object.keys(compareValues(l,s,c.copies)).map(k=>[k,c[k]])));
    if(c.policy!=='best_observed_throughput') {assert.equal(s.latency.passes,true);assert.equal(l.latency.passes,true);}
    if(c.type==='agentic_traces') {assert.ok(s.dataset);assert.equal(s.dataset,l.dataset);assert.notEqual(s.scenarioValid,false);assert.notEqual(l.scenarioValid,false);}
  }
});
test('profiling error accounting excludes overlapping warmup errors',()=>{
  const result=profilingErrors({records_total:4528,records_profiled:4174,records_dropped_total:354,records_warmup_dropped:354,records_error_dropped:275});
  assert.equal(result.errors,0);assert.equal(result.attempted,4174);assert.equal(result.errorRatePct,0);
  const small=profilingErrors({records_total:587,records_profiled:542,records_dropped_total:45,records_warmup_dropped:44,records_error_dropped:39});
  assert.equal(small.errors,1);assert.equal(small.attempted,543);
  assert.throws(()=>profilingErrors({records_total:10,records_profiled:5,records_dropped_total:5,records_warmup_dropped:6,records_error_dropped:0}));
});
test('shortlist audits match original aggregates and reject changed identity',()=>{
  const shortlist=JSON.parse(readFileSync('reports/inferencex/shortlist.json'));
  const rows=new Map(JSON.parse(readFileSync('reports/inferencex/benchmarks.json')).map(r=>[r.id,r]));
  for(const point of Object.values(shortlist.pointAudits)) {
    const a=JSON.parse(readFileSync(point.artifactFile)).find(a=>a.filename===point.filename).data;
    const r=rows.get(point.rowId);
    assert.ok(matchAggregate(r,a));
    assert.equal(matchAggregate({...r,hardware:'b200'},a),false);
    assert.equal(matchAggregate({...r,concurrency:r.concurrency+1},a),false);
    assert.equal(point.gpuTotal,r.topology.gpus);
  }
  for(const c of shortlist.selected) {
    assert.equal(c.productionCapacityValidated,false);
    assert.deepEqual(c.sourceAudit.small.dataset,c.sourceAudit.large.dataset);
    assert.equal(c.sourceAudit.small.modelCheckpoint,c.sourceAudit.large.modelCheckpoint);
  }
});
