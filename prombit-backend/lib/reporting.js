async function getDailyUsageReport(redis, dateStr) {
  if (!redis) return null;
  const p = redis.pipeline();
  
  // 1. Counters
  p.get(`prombit:stats:${dateStr}:cost_nano`);
  p.get(`prombit:stats:${dateStr}:hits_total`);
  p.get(`prombit:stats:${dateStr}:hits_ok`);
  p.get(`prombit:stats:${dateStr}:hits_blocked`);
  p.get(`prombit:stats:${dateStr}:hits_validation_fail`);
  p.get(`prombit:stats:${dateStr}:hits_rate_limited`);
  p.get(`prombit:stats:${dateStr}:hits_budget_locked`);
  p.get(`prombit:stats:${dateStr}:hits_denylisted`);

  // 2. Leaderboards
  p.zrevrange(`prombit:zset:${dateStr}:top_cost`, 0, 4, { withScores: true });
  p.zrevrange(`prombit:zset:${dateStr}:top_requests`, 0, 4, { withScores: true });
  p.zrevrange(`prombit:zset:${dateStr}:top_fails`, 0, 4, { withScores: true });

  const [
    costVal, totVal, okVal, blockedVal,
    valfailVal, rlVal, blVal, denyVal,
    topCost, topReq, topFail
  ] = await p.exec();

  const parseScore = (arr) => {
    const res = [];
    for (let i = 0; i < arr.length; i += 2) {
      res.push({ source: arr[i], score: Number(arr[i+1]) });
    }
    return res;
  };

  const costNano = Number(costVal) || 0;

  return {
    date: dateStr,
    cost_usd: costNano / 1e9,
    requests: {
      total: Number(totVal) || 0,
      ok: Number(okVal) || 0,
      blocked: Number(blockedVal) || 0,
      validation_fail: Number(valfailVal) || 0,
      rate_limited: Number(rlVal) || 0,
      budget_locked: Number(blVal) || 0,
      denylisted: Number(denyVal) || 0,
    },
    leaderboards: {
      top_cost: parseScore(topCost).map(x => ({ source: x.source, cost_usd: x.score / 1e9 })),
      top_requests: parseScore(topReq),
      top_suspicious: parseScore(topFail)
    }
  };
}

module.exports = { getDailyUsageReport };
