import { authenticator } from 'otplib';
import { decryptField } from './fieldEncryption.js';

// TOTP helper
// This module provides a thin wrapper around `otplib` so the application
// can verify one-time passwords (OTPs) produced by authenticator apps
// (Google Authenticator, Authy, etc.). Secrets are stored encrypted in
// the database using the app's field-encryption helper. The helper will
// decrypt the secret before passing it to `otplib` for verification.
//
// IMPORTANT: For production deployments consider protecting TOTP secrets
// with a hardware-backed key management service (KMS/HSM) rather than
// application-level encryption.

/**
 * Verify a TOTP code for a user.
 * @param {string} encryptedSecret - The encrypted base32 TOTP secret stored in the DB
 * @param {string|number} code - The 6-digit code supplied by the operator
 * @returns {boolean} true when the code is valid, false otherwise
 */
export function verifyTOTP(encryptedSecret, code) {
  if (!encryptedSecret || !code) return false;
  try {
    // Decrypt the stored secret (fieldEncryption handles empty-key dev-mode)
    const secret = decryptField(encryptedSecret);
    // otplib expects the secret to be base32 encoded for most authenticator apps
    return authenticator.verify({ token: String(code).trim(), secret });
  } catch (err) {
    // Log and treat failures as non-fatal verification errors
    console.error('TOTP verify failed:', err);
    return false;
  }
}

/**
 * Generate a new base32 TOTP secret for enrollment.
 * Consumer should persist the encrypted form of this value in the Employee
 * record and present a QR/URI to the user for scanning with an authenticator app.
 */
export function generateTOTPSecret() {
  return authenticator.generateSecret();
}
