// In-memory denylist cache — per-lambda-instance, TTL-bounded.
// Avoids a Redis GET on every request for known-clean sources.
const _cache = new Map(); // hashedSource → { banned: bool, expiresAt: ms }
const CLEAN_TTL  = 5 * 60 * 1000;  // 5 min: re-check clean sources
const BANNED_TTL = 60 * 60 * 1000; // 1 hr: treat bans as long-lived
const MAX_CACHE  = 2000;

function _cacheGet(hashedSource) {
  const entry = _cache.get(hashedSource);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) { _cache.delete(hashedSource); return undefined; }
  return entry.banned;
}

function _cacheSet(hashedSource, banned) {
  if (_cache.size >= MAX_CACHE) {
    // Evict oldest entry
    _cache.delete(_cache.keys().next().value);
  }
  _cache.set(hashedSource, {
    banned,
    expiresAt: Date.now() + (banned ? BANNED_TTL : CLEAN_TTL),
  });
}

async function isDenylisted(redis, hashedSource) {
  if (!redis || !hashedSource || hashedSource === 'unknown') return false;
  const cached = _cacheGet(hashedSource);
  if (cached !== undefined) return cached;
  try {
    const isBanned = !!(await redis.get(`prombit:deny:source:${hashedSource}`));
    _cacheSet(hashedSource, isBanned);
    return isBanned;
  } catch (e) {
    return false; // fail open — denylist miss is safer than blocking everyone
  }
}

async function addToDenylist(redis, hashedSource, ttlMinutes) {
  if (!redis || !hashedSource || hashedSource === 'unknown') return;
  try {
    await redis.setex(`prombit:deny:source:${hashedSource}`, ttlMinutes * 60, '1');
    _cacheSet(hashedSource, true); // reflect ban immediately in local cache
    console.warn(`[SECURITY] Auto-ban applied to source ${hashedSource} for ${ttlMinutes}m`);
  } catch (e) {
    console.error('[SECURITY] Failed to apply denylist ban:', e.message);
  }
}

module.exports = { isDenylisted, addToDenylist };
