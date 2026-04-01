const { addToDenylist } = require('./denylist');

// Configure sensitivity thresholds
const VAL_FAILS_MAX_1M = 5;
const BLOCKS_MAX_1M = 10;

async function trackAnomaly(redis, hashedSource, status) {
  if (!redis || !hashedSource || hashedSource === 'unknown') return;
  // We only track anomalies for suspicious statuses
  if (status === 'ok' || status === 'rate_limited' || status === 'budget_locked') return;

  try {
    const pipeline = redis.pipeline();
    const nowMin = Math.floor(Date.now() / 60000);
    let keyToTrack = null;

    if (status === 'validation_fail') {
      keyToTrack = `prombit:anom:${nowMin}:valfail:${hashedSource}`;
    } else if (status === 'blocked') { // Heuristic block
      keyToTrack = `prombit:anom:${nowMin}:block:${hashedSource}`;
    }

    if (!keyToTrack) return;

    pipeline.incr(keyToTrack);
    pipeline.expire(keyToTrack, 120); // only keep window for 2 mins
    const [hits] = await pipeline.exec();

    // Check thresholds immediately
    if (status === 'validation_fail' && hits >= VAL_FAILS_MAX_1M) {
       await addToDenylist(redis, hashedSource, 1440); // 24 hour ban
    } else if (status === 'blocked' && hits >= BLOCKS_MAX_1M) {
       await addToDenylist(redis, hashedSource, 1440); // 24 hour ban
    }
  } catch (e) {
    console.error('[ANOMALY] engine error:', e.message);
  }
}

module.exports = { trackAnomaly };
