const { Redis } = require('@upstash/redis');
const { getDailyUsageReport } = require('../lib/reporting');

// Re-use logic for environment
const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ? Redis.fromEnv() : null;

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  
  const authHeader = req.headers.authorization || '';
  const expectedToken = process.env.ADMIN_TOKEN;
  
  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  // Rate Limiting on Admin Route (Max 5/min, 100/hr)
  const forwarded = req.headers['x-forwarded-for'];
  const rawIp = forwarded ? forwarded.split(',')[0].trim() : (req.headers['x-real-ip'] || 'unknown');
  
  if (redis) {
    try {
      const minKey = `prombit:admin:min:${rawIp}`;
      const hrKey = `prombit:admin:hr:${rawIp}`;
      const [minHits, hrHits] = await redis.pipeline()
        .incr(minKey).incr(hrKey)
        .expire(minKey, 60, { nx: true }).expire(hrKey, 3600, { nx: true })
        .exec();
        
      if (minHits > 5 || hrHits > 100) return res.status(429).json({ error: 'TOO_MANY_REQUESTS' });
    } catch (e) {
      return res.status(503).json({ error: 'RATE_LIMIT_UNAVAILABLE' });
    }
  }

  const dateStr = req.query.date || new Date().toISOString().split('T')[0];
  
  if (!redis) {
    return res.status(503).json({ error: 'REDIS_NOT_CONFIGURED' });
  }

  try {
    const report = await getDailyUsageReport(redis, dateStr);
    return res.status(200).json(report);
  } catch (e) {
    console.error('[ADMIN] Report failed:', e.message);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
};
