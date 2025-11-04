import crypto from 'crypto';

// Field-level encryption helper (AES-256-GCM)
// Uses env var FIELD_ENC_KEY (hex, 32 bytes) to encrypt/decrypt sensitive
// fields like account numbers. This is a lightweight app-level approach.
// For production consider using a dedicated KMS or MongoDB FLE.

const KEY_HEX = process.env.FIELD_ENC_KEY || '';
if (!KEY_HEX) {
  // Warn in dev but don't throw to keep existing flows working in CI/early dev
  if (process.env.NODE_ENV !== 'production') {
    console.warn('FIELD_ENC_KEY not set — field-level encryption disabled.');
  }
}

function getKey() {
  return Buffer.from(KEY_HEX, 'hex');
}

export function encryptField(plainText) {
  if (!KEY_HEX) return plainText; // no-op if key not configured
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store as base64: iv:tag:cipher
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptField(cipherText) {
  if (!KEY_HEX) return cipherText; // no-op
  try {
    const data = Buffer.from(cipherText, 'base64');
    const iv = data.slice(0, 12);
    const tag = data.slice(12, 28);
    const encrypted = data.slice(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.error('Failed to decrypt field:', err);
    return cipherText; // return original if decryption fails
  }
}
