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
