async function safeTelemetryEvent(redis, { dateStr, status, costNano, inTokens, outTokens, promptLength, hashedSource }) {
  if (!redis) return;
  try {
    const p = redis.pipeline();
    
    // 1. Aggregate global counters
    p.incr(`prombit:stats:${dateStr}:hits_total`);
    p.incr(`prombit:stats:${dateStr}:hits_${status}`);
    
    if (costNano > 0) {
      p.incrby(`prombit:stats:${dateStr}:cost_nano`, costNano);
    }

    // 2. Top Source Trackers (Sorted Sets)
    if (hashedSource && hashedSource !== 'unknown') {
      p.zincrby(`prombit:zset:${dateStr}:top_requests`, 1, hashedSource);
      
      if (costNano > 0) {
        p.zincrby(`prombit:zset:${dateStr}:top_cost`, costNano, hashedSource);
      }
      
      // Track suspicious behavior
      if (status !== 'ok') {
        p.zincrby(`prombit:zset:${dateStr}:top_fails`, 1, hashedSource);
      }
    }
    
    // 3. Maintain 30-day retention on stats
    const ttl = 86400 * 30;
    p.expire(`prombit:stats:${dateStr}:hits_total`, ttl);
    p.expire(`prombit:stats:${dateStr}:hits_${status}`, ttl);
    p.expire(`prombit:stats:${dateStr}:cost_nano`, ttl);
    p.expire(`prombit:zset:${dateStr}:top_requests`, ttl);
    p.expire(`prombit:zset:${dateStr}:top_cost`, ttl);
    p.expire(`prombit:zset:${dateStr}:top_fails`, ttl);

    await p.exec();
    
  } catch (e) {
    console.error('[TELEMETRY_ERROR]', e.message);
  }
}

module.exports = { safeTelemetryEvent };
