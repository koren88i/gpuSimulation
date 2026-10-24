import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {capacity,compareValues} from '../scripts/inferencex/capacity.js';
import {collectionForHardware,collectionRows,filterRows,hardwareOptions,selectionSummary} from '../report/selection.js';
const data=JSON.parse(await readFile(new URL('../data/inferencex-ui.json',import.meta.url),'utf8'));
const reportHtml=await readFile(new URL('../report/index.html',import.meta.url),'utf8');
test('five audited examples are the default collection and the page has a collapsed explainer',()=>{
  assert.match(reportHtml,/<select id="collection"><option value="shortlist">/);
  assert.match(reportHtml,/<details class="page-explainer panel">\s*<summary>What is this page\?<\/summary>/);
  assert.doesNotMatch(reportHtml,/<details class="page-explainer panel" open>/);
  assert.match(reportHtml,/Why these five by default\?/);
});
test('all collection shows 318 records without an operating-point filter',()=>{
  assert.equal(filterRows(data,'all').length,318);
  assert.equal(filterRows(data,'all',{policy:'latency_qualified_sessions'}).length,15);
  assert.equal(filterRows(data,'qualified').length,15);
  assert.equal(filterRows(data,'shortlist').length,5);
  assert.ok(filterRows(data,'all',{hardware:'b200'}).every(c=>c.hardware==='b200'));
});
test('hardware menu always exposes the full inventory and unavailable choices open the broad collection',()=>{
  assert.deepEqual(hardwareOptions(data),['b200','b300','gb200','gb300','h100','h200']);
  assert.equal(collectionForHardware(data,'shortlist','b200'),'all');
  assert.equal(collectionForHardware(data,'qualified','h200'),'all');
  assert.equal(collectionForHardware(data,'shortlist','gb200'),'shortlist');
  assert.equal(collectionForHardware(data,'qualified','gb300'),'qualified');
});
test('selection history preserves all qualified candidates and editorial subset',()=>{
  const summary=selectionSummary(data),qualified=collectionRows(data,'qualified');
  assert.deepEqual(summary.stages.map(s=>s[1]),[53003,318,64,15,5]);
  assert.equal(summary.auditedPoints,8);
  assert.equal(summary.decisions.filter(d=>!d.selected).length,10);
  for(const c of data.shortlist)assert.ok(qualified.some(q=>q.id===c.id));
  for(const c of qualified){assert.ok(data.points[c.largeId].latency.passes);assert.ok(data.points[c.smallId].latency.passes);}
});
function result(c,p=data.profile){const point=id=>({...data.points[id],capacity:capacity(data.points[id],p)});return compareValues(point(c.largeId),point(c.smallId),c.copies);}
test('UI snapshot reproduces every generated comparison',()=>{
  assert.equal(data.shortlist.length,5);
  for(const c of data.pairs){
    assert.equal(c.largeNodeEquivalents,c.smallNodeEquivalents*c.copies);
    for(const [key,value] of Object.entries(result(c)))assert.equal(value,c[key],`${c.id}: ${key}`);
  }
});
test('shared usage sensitivity preserves gains and measured throughput',()=>{
  for(const c of data.shortlist){
    const base=result(c),changed=result(c,{...data.profile,reserveFraction:0.4,activeAgentHoursPerDau:4});
    assert.ok(Math.abs(changed.largeActiveSessions/base.largeActiveSessions-0.75)<1e-12);
    assert.ok(Math.abs(changed.splitDau/base.splitDau-0.375)<1e-12);
    assert.equal(changed.largeOutputTps,base.largeOutputTps);
    assert.ok(Math.abs(changed.sessionGainPct-base.sessionGainPct)<1e-10);
  }
});
test('fixed-length points never gain invented coding estimates',()=>{
  for(const c of data.pairs.filter(c=>c.type!=='agentic_traces')){
    assert.equal(result(c).largeActiveSessions,null);
    assert.equal(result(c).splitDau,null);
  }
});
