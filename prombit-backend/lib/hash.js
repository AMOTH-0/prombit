const crypto = require('crypto');

function hashIdentifier(value) {
  if (!value) return 'unknown';
  const salt = process.env.TELEMETRY_SALT || 'prombit_fallback_salt_2026';
  return crypto.createHmac('sha256', salt).update(String(value)).digest('hex').substring(0, 16);
}

module.exports = { hashIdentifier };
