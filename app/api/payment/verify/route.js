// API: Verify Payment (employee)
// Purpose: Let an authorized employee mark a pending payment as VERIFIED.
// Security and behavior notes:
// - Requires an authenticated employee session
// - Validates CSRF token (double-submit cookie pattern)
// - Accepts an optional `confirmSwift` string from the client; if supplied
//   the server will compare it (case-insensitive) with the stored
//   `payment.swiftCode` to provide an additional human confirmation step.
// - Writes an audit record describing the verification and whether the
//   optional SWIFT confirmation matched. Audit failures do not block the
//   main operation but are logged to the server console.
import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/db/connection.js';
import Payment from '../../../../lib/db/models/payment.js';
import Audit from '../../../../lib/db/models/audit.js';
import { sinkAudit } from '../../../../lib/security/auditSink.js';
import { getSession, requireRole, validateCsrfToken } from '../../../../lib/auth/session.js';
import rateLimiter from '../../../../lib/security/rateLimiter.js';
import Employee from '../../../../lib/db/models/employee.js';
import { verifyPassword } from '../../../../lib/auth/password.js';
import { rotateSession } from '../../../../lib/auth/session.js';
import { requireReauthIfNeeded } from '../../../../lib/security/reauth.js';

export async function POST(request) {
  try {
    // Rate limit check to protect the verify endpoint from abuse/automation
    const rl = rateLimiter.checkRateLimit(request);
    if (!rl.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter || 60) } });
    }

    // Validate session and role
    const session = getSession(request);
    if (!session || !session.isValid) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Ensure only employees can verify payments
    if (session.user.role !== 'employee') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Validate CSRF token (double submit)
    if (!validateCsrfToken(request)) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

  // Read JSON body and provides the SWIFT confirmation if given
  const body = await request.json().catch(() => null);
  const { paymentId, confirmSwift } = body || {};

    if (!paymentId || typeof paymentId !== 'string') {
      return NextResponse.json({ error: 'paymentId is required' }, { status: 400 });
    }

    await dbConnect();

    const payment = await Payment.findOne({ paymentId }).exec();

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    if (payment.status !== 'pending') {
      return NextResponse.json({ error: 'Payment is not pending' }, { status: 409 });
    }

    // Step-up authentication for high-value payments.
    // requireReauthIfNeeded supports password + optionalTOTP verification and failure counting.
    try {
      // validates password and optional TOTP when required.
      // The helper will throw an Error with `.status` set for common failure
  const { reauthPassword, totpCode } = body || {};
  await requireReauthIfNeeded({ sessionUser: session.user, amount: payment.amount, reauthPassword, totpCode });

      // Record a re-auth success audit entry.
      try {
        // To avoid storing sensitive values (passwords or TOTP codes), we only record
        // the method of re-authentication (e.g., 'password' or 'recent-window') and whether
        // a TOTP code was provided, but never the actual password or TOTP code themselves.
        const reauthAudit = await Audit.create({
          employeeId: session.user.userId,
          employeeIdentifier: session.user.userName || null,
          action: 'reauth_success',
          paymentId: payment.paymentId,
          details: { method: reauthPassword ? 'password' : 'recent-window', totpProvided: Boolean(totpCode) }
        });
        // Export to the append-only audit sink (best-effort).
        //  Audit sink failures are logged but do not block the user operation.
        sinkAudit(reauthAudit).catch(() => {});
      } catch (auditErr) {
        // Log audit write failures for monitoring/alerting.
        console.error('Failed to write reauth success audit:', auditErr);
      }
    } catch (reauthErr) {
      // On failure, create a reauth_failure audit.
      try {
        const failAudit = await Audit.create({
          employeeId: session.user.userId,
          employeeIdentifier: session.user.userName || null,
          action: 'reauth_failure',
          paymentId: payment.paymentId,
          details: { error: reauthErr.message || 'reauth_failed' }
        });
        sinkAudit(failAudit).catch(() => {});
      } catch (auditErr) {
        console.error('Failed to write reauth failure audit:', auditErr);
      }

      // Surface a friendly error message to the client 
      return NextResponse.json({ error: reauthErr.message || 'Re-authentication required' }, { status: reauthErr.status || 401 });
    }

  // If the client supplied a SWIFT confirmation value, require it to match
    // the payment's stored swift code to add an extra verification step.
    // This protects against an employee mistakenly verifying the wrong beneficiary.
    let swiftMatch = true;
    if (typeof confirmSwift === 'string') {
      swiftMatch = confirmSwift.trim().toUpperCase() === (payment.swiftCode || '').toUpperCase();
      if (!swiftMatch) {
        // Return a clear error; the client may surface this to the operator.
        return NextResponse.json({ error: 'SWIFT code confirmation does not match' }, { status: 400 });
      }
    }

    // Update status to verified and persist audit fields
    payment.status = 'verified';
    payment.verifiedBy = session.user.userId || null; // employee's ObjectId string
    payment.verifiedAt = new Date();
    payment.updatedAt = new Date();
    await payment.save();

    // Rotate the employee session after a sensitive operation
    try {
      await rotateSession(session.user);
    } catch (e) {
      console.error('Session rotation failed after verify:', e);
    }

    // Record audit log for verification.
    // We write a concise entry describing the employee, the action and whether the optional SWIFT check matched.
    // The audit intentionally contains minimal metadata (no secrets).
    try {
      await dbConnect();
      const created = await Audit.create({
        employeeId: session.user.userId,
        employeeIdentifier: session.user.userName || null,
        action: 'verify',
        paymentId: payment.paymentId,
        details: { swiftMatch }
      });
      // Non-blocking export to append-only audit sink (signed JSONL).
      // The sink is best-effort; failures are logged for alerting.
      sinkAudit(created).catch(() => {});
    } catch (auditErr) {
      // Log failures.
      // Monitoring should alert on repeated failures.
      console.error('Audit log error (verify):', auditErr);
    }

    return NextResponse.json({ message: 'Payment verified' }, { status: 200 });
  } catch (err) {
    console.error('Error verifying payment:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}
