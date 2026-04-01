async function isDenylisted(redis, hashedSource) {
  if (!redis || !hashedSource || hashedSource === 'unknown') return false;
  try {
    const isBanned = await redis.get(`prombit:deny:source:${hashedSource}`);
    return !!isBanned;
  } catch (e) {
    return false; // fail open for denylist check to prevent API outage if Redis is slow
  }
}

async function addToDenylist(redis, hashedSource, ttlMinutes) {
  if (!redis || !hashedSource || hashedSource === 'unknown') return;
  try {
    await redis.setex(`prombit:deny:source:${hashedSource}`, ttlMinutes * 60, '1');
    console.warn(`[SECURITY] Auto-ban applied to source ${hashedSource} for ${ttlMinutes}m`);
  } catch (e) {
    console.error('[SECURITY] Failed to apply denylist ban:', e.message);
  }
}

module.exports = { isDenylisted, addToDenylist };
