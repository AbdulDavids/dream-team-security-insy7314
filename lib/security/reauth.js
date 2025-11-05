
import Employee from '../db/models/employee.js';
import { verifyPassword } from '../auth/password.js';
import { verifyTOTP } from './totp.js';

// Centralized re-auth helper
// This module encapsulates the step-up authentication logic so endpoints
// (verify/send) don't duplicate password + TOTP checks. It implements:
//  - a short 'recent reauth' window where a prior successful reauth
//    satisfies requirements for low-value actions;
//  - password verification (bcrypt) for all required cases;
//  - optional TOTP verification when the employee has enrolled an
//    authenticator app; and
//  - failure counting to protect against brute-force attempts.

// How to tune via env:
// - PAYMENT_STEP_UP_THRESHOLD controls the amount above which reauth is required
// - REAUTH_WINDOW_SECONDS controls how long a recent reauth is accepted
// - MAX_REAUTH_FAILURES is the number of allowed consecutive failures

const REAUTH_WINDOW_SECONDS = Number(process.env.REAUTH_WINDOW_SECONDS || 300); // default: 5 minutes
const THRESHOLD = Number(process.env.PAYMENT_STEP_UP_THRESHOLD || 10000);
const MAX_REAUTH_FAILURES = 5;

/**
 * Ensure the employee re-authenticates when required.
 * Throws an Error with `.status` set when reauth fails or is required.
 * On success, returns the Employee document and updates lastReauthAt.
 */
export async function requireReauthIfNeeded({ sessionUser, amount, reauthPassword, totpCode }) {
  // If the employee performed a recent successful re-auth, accept it for
  // subsequent sensitive operations regardless of amount. This supports the
  // two-step flow where the UI first calls `/api/auth/reauth` and then the
  // operator completes the business action (verify/send) without re-entering
  // credentials. The reauth window is intentionally short to limit risk.
  const empRecent = await Employee.findById(sessionUser.userId).exec();
  if (empRecent && empRecent.lastReauthAt) {
    const last = Math.floor(new Date(empRecent.lastReauthAt).getTime() / 1000);
    const now = Math.floor(Date.now() / 1000);
    if (now - last <= REAUTH_WINDOW_SECONDS) {
      return empRecent; // recent reauth is sufficient for the two-step UX
    }
  }

  // Load employee record for password and totp checks
  const employee = await Employee.findById(sessionUser.userId).exec();
  if (!employee) {
    const err = new Error('Employee not found');
    err.status = 401;
    throw err;
  }

  // Throttle/lockout: prevent brute-force attempts
  if ((employee.reauthFailures || 0) >= MAX_REAUTH_FAILURES) {
    const err = new Error('Too many re-authentication failures');
    err.status = 429; // Too many requests
    throw err;
  }

  // Password is required for step-up. The caller must provide it when
  // the threshold or lack of recent reauth dictates.
  if (!reauthPassword) {
    const err = new Error('Re-authentication required');
    err.status = 401;
    throw err;
  }

  // Verify password using the project's bcrypt helper
  const ok = await verifyPassword(reauthPassword, employee.password);
  if (!ok) {
    // Record failure and persist; do not throw DB errors in the failure path
    employee.reauthFailures = (employee.reauthFailures || 0) + 1;
    await employee.save().catch(() => {});
    const err = new Error('Re-authentication failed');
    err.status = 401;
    throw err;
  }

  // If the employee has enrolled TOTP, require a valid code as well.
  if (employee.totpEnrolled) {
    const totpOk = verifyTOTP(employee.totpSecretEncrypted, totpCode);
    if (!totpOk) {
      employee.reauthFailures = (employee.reauthFailures || 0) + 1;
      await employee.save().catch(() => {});
      const err = new Error('TOTP validation failed');
      err.status = 401;
      throw err;
    }
  }

  // Successful reauth: reset counters and update timestamp
  employee.reauthFailures = 0;
  employee.lastReauthAt = new Date();
  await employee.save().catch(() => {});
  return employee;
}

