export const isQualified = c => c.type === 'agentic_traces' && c.policy === 'latency_qualified_sessions' && c.largeActiveSessions != null && c.splitActiveSessions != null;
export function filterRows(data,collection,{model='',hardware='',policy=''}={}) {
  return collectionRows(data,collection).filter(c=>(!model||c.model===model)&&(!hardware||c.hardware===hardware)&&(collection!=='all'||!policy||c.policy===policy));
}
export function collectionRows(data, name) {
  if (name === 'shortlist') return data.shortlist;
  if (name === 'qualified') return data.pairs.filter(isQualified);
  return data.pairs;
}
export function hardwareOptions(data) {
  return [...new Set(collectionRows(data, 'all').map(c => c.hardware))].sort();
}
export function collectionForHardware(data, collection, hardware) {
  if (!hardware || collectionRows(data, collection).some(c => c.hardware === hardware)) return collection;
  return 'all';
}
export function selectionSummary(data) {
  const qualified = collectionRows(data, 'qualified');
  const selected = new Map(data.shortlist.map(c => [c.id, c]));
  return {
    stages: [
      ['In-scope measurements', data.coverage.counts.uniqueInScope, 'Individual benchmark points, not comparisons.'],
      ['Generated comparisons', data.pairs.length, 'Compatible allocations at equal GPU budgets, across selection policies.'],
      ['AgentX comparisons', data.pairs.filter(c => c.type === 'agentic_traces').length, 'Coding-workload records across policies; not all qualify for user estimates.'],
      ['Qualified session comparisons', qualified.length, 'Both points support session estimates within the configured latency limits.'],
      ['Audited examples', data.shortlist.length, 'An editorial subset checked against original source artifacts.'],
    ],
    decisions: qualified.map(c => {
      const pick = selected.get(c.id), reasons = [];
      if (c.splitConcurrency / c.copies === 1) reasons.push('Smaller selected point has one configured session.');
      if (c.smallObservedConcurrencies.length < 3) reasons.push('Sparse smaller-side sweep.');
      if (c.largeObservedConcurrencies.length < 2) reasons.push('Only one larger-side concurrency observed.');
      if (c.largeFramework !== c.smallFramework) reasons.push('Serving frameworks differ.');
      if (c.largeImage !== c.smallImage) reasons.push('Engine images differ.');
      return {id:c.id, selected:!!pick, auditStatus:data.sourceAudit?.pairs[c.id]?.status??'incomplete', auditReason:data.sourceAudit?.pairs[c.id]?.reason??'Source audit pending', reason:pick?.reviewReason ?? 'Not selected for the illustrative subset; still eligible to explore.', limitations:reasons.join(' ') || 'Capacity maximum and replay compliance remain unproven.'};
    }),
    auditedPoints: new Set(data.shortlist.flatMap(c => [c.smallId,c.largeId])).size,
  };
}
