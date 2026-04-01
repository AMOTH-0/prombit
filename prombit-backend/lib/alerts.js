async function triggerBudgetAlertOnce(redis, dateStr, thresholdPct, currentCostNano, maxCostNano) {
  if (!redis) return;
  try {
    const key = `prombit:alert:${dateStr}:budget_${thresholdPct}`;
    // NX: Set only if it does not exist
    const success = await redis.set(key, '1', { nx: true, ex: 86400 * 7 }); // Keep history for 7 days
    if (success === 'OK' || success === 1 || success === true) {
      console.warn(`[ALERT] Daily budget reached ${thresholdPct}% ($${(currentCostNano / 1e9).toFixed(2)} / $${(maxCostNano / 1e9).toFixed(2)})`);
    }
  } catch (e) {
    // Fail silently on alert writes
  }
}

module.exports = { triggerBudgetAlertOnce };
