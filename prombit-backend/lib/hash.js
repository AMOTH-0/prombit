const crypto = require('crypto');

function hashIdentifier(value) {
  if (!value) return 'unknown';
  const salt = process.env.TELEMETRY_SALT;
  if (!salt) throw new Error('TELEMETRY_SALT environment variable is required');
  return crypto.createHmac('sha256', salt).update(String(value)).digest('hex').substring(0, 16);
}

module.exports = { hashIdentifier };
