export const finite = value => typeof value === 'number' && Number.isFinite(value);
export function validateProfile(p) {
  if (!p.id || !finite(p.reserveFraction) || p.reserveFraction < 0 || p.reserveFraction >= 1) throw new Error('Invalid reserve/profile');
  for (const key of ['rootSessionsPerUser','activeAgentHoursPerDau','activityWindowHours','peakToWindowAverageRatio']) {
    if (!finite(p[key]) || p[key] <= 0) throw new Error(`Invalid ${key}`);
  }
  if (p.activityWindowHours > 24 || p.activeAgentHoursPerDau > 24 || p.peakToWindowAverageRatio < 1) throw new Error('Invalid daily activity profile');
  if (!Object.keys(p.latencyLimits ?? {}).length || Object.values(p.latencyLimits).some(x=>!finite(x)||x<=0)) throw new Error('Invalid latency limits');
  if(p.selection?.asOfDate && !/^\d{4}-\d{2}-\d{2}$/.test(p.selection.asOfDate)) throw new Error('Invalid as-of date');
  for(const k of ['maxAgeDays','maxPairDateGapDays']) if(p.selection?.[k]!=null&&(!finite(p.selection[k])||p.selection[k]<0)) throw new Error(`Invalid ${k}`);
  if(p.selection?.maxAgeDays!=null&&!p.selection.asOfDate) throw new Error('Maximum age requires an as-of date');
  if (p.fixedSequenceProxy?.enabled) {
    if (!finite(p.fixedSequenceProxy.thinkSeconds) || p.fixedSequenceProxy.thinkSeconds < 0 || !(p.fixedSequenceProxy.requestsPerUserPerDay > 0)) throw new Error('Invalid proxy profile');
  }
  return p;
}
export function latencyStatus(metrics, p) {
  const reasons=[];
  for (const [key,limit] of Object.entries(p.latencyLimits)) {
    if (!finite(metrics[key])) reasons.push(`missing_${key}`);
    else if (metrics[key]>limit) reasons.push(`exceeds_${key}`);
  }
  return {passes:reasons.length===0,reasons};
}
export function capacity(row,p) {
  validateProfile(p);
  const peakRatio=24/p.activityWindowHours*p.peakToWindowAverageRatio;
  const empty={activeSessions:null,dau:null,status:'unavailable',profileId:p.id};
  if (!row.latency.passes) return {...empty,status:'latency_not_qualified'};
  if (!row.topology.eligible) return {...empty,status:'topology_not_qualified'};
  if (row.type==='agentic_traces') {
    if (row.scenarioValid===false) return {...empty,status:'invalid_agentic_scenario'};
    const activeSessions=row.concurrency*(1-p.reserveFraction)/p.rootSessionsPerUser;
    return {activeSessions,dau:activeSessions*24/(p.activeAgentHoursPerDau*peakRatio),
      status:row.scenarioValid===true&&row.dataset?'estimated_agentx':'provisional_agentx_validity_or_dataset_unverified',profileId:p.id};
  }
  if (!p.fixedSequenceProxy?.enabled) return {...empty,status:'fixed_sequence_proxy_disabled'};
  if (!finite(row.rps)||!finite(row.metrics.mean_e2el)) return {...empty,status:'missing_rps_or_mean_response'};
  const usableRps=row.rps*(1-p.reserveFraction);
  return {activeSessions:usableRps*(row.metrics.mean_e2el+p.fixedSequenceProxy.thinkSeconds),
    dau:usableRps*86400/(p.fixedSequenceProxy.requestsPerUserPerDay*peakRatio),status:'hypothetical_fixed_sequence_proxy',profileId:p.id};
}
export function gain(large,small,copies=1) {
  return finite(large)&&finite(small)&&small>0 ? (large/(small*copies)-1)*100 : null;
}
export function compareValues(large,small,copies) {
  if (!Number.isInteger(copies)||copies<2) throw new Error('Copies must be an integer >=2');
  const times=x=>finite(x)?x*copies:null;
  return {splitOutputTps:times(small.outputTps),largeOutputTps:large.outputTps,
    throughputGainPct:gain(large.outputTps,small.outputTps,copies),
    splitConcurrency:small.concurrency*copies,largeConcurrency:large.concurrency,
    splitActiveSessions:times(small.capacity.activeSessions),largeActiveSessions:large.capacity.activeSessions,
    sessionGainPct:gain(large.capacity.activeSessions,small.capacity.activeSessions,copies),
    splitDau:times(small.capacity.dau),largeDau:large.capacity.dau,
    dauGainPct:gain(large.capacity.dau,small.capacity.dau,copies)};
}
