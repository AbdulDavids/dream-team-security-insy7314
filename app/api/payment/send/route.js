// API: Send payment to SWIFT (simulated)
// This endpoint is intentionally simple for demo purposes. In a production
// integration you would replace the simulated behavior with an actual
// payment gateway or SWIFT integration, including idempotency, retries,
// secure key management, and robust error handling/audit trails.
import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/db/connection.js';
import Payment from '../../../../lib/db/models/payment.js';
import Audit from '../../../../lib/db/models/audit.js';
import { sinkAudit } from '../../../../lib/security/auditSink.js';
import { getSession, validateCsrfToken } from '../../../../lib/auth/session.js';
import rateLimiter from '../../../../lib/security/rateLimiter.js';
import Employee from '../../../../lib/db/models/employee.js';
import { verifyPassword } from '../../../../lib/auth/password.js';
import { rotateSession } from '../../../../lib/auth/session.js';
import { requireReauthIfNeeded } from '../../../../lib/security/reauth.js';

export async function POST(request) {
  try {
    // Rate limit check to reduce risk of automated sends or abuse
    const rl = rateLimiter.checkRateLimit(request);
    if (!rl.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter || 60) } });
    }

    const session = getSession(request);
    if (!session || !session.isValid) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Only employees may send payments to SWIFT
    if (session.user.role !== 'employee') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (!validateCsrfToken(request)) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

  const body = await request.json().catch(() => null);
  const { paymentId, reauthPassword } = body || {};

    if (!paymentId || typeof paymentId !== 'string') {
      return NextResponse.json({ error: 'paymentId is required' }, { status: 400 });
    }

  // Connect and fetch the target payment
  await dbConnect();
  const payment = await Payment.findOne({ paymentId }).exec();
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Payment must be verified before sending
    if (payment.status !== 'verified') {
      return NextResponse.json({ error: 'Only verified payments may be sent to SWIFT' }, { status: 409 });
    }

    if (payment.sentToSwift) {
      return NextResponse.json({ error: 'Payment already sent to SWIFT' }, { status: 409 });
    }

    // Step-up authentication for high-value sends; centralize logic
    try {
      // Require re-auth for high-value sends using the shared helper. This
      // enforces password verification and (if enrolled) TOTP verification.
  const { reauthPassword, totpCode } = body || {};
  await requireReauthIfNeeded({ sessionUser: session.user, amount: payment.amount, reauthPassword, totpCode });

      // Record a re-auth success audit record for operational traceability.
      try {
        // Create a concise reauth success audit record. Avoid capturing
        // sensitive values (passwords, raw TOTP codes). Include only
        // metadata that helps ops/security teams investigate.
        const reauthAudit = await Audit.create({
          employeeId: session.user.userId,
          employeeIdentifier: session.user.userName || null,
          action: 'reauth_success',
          paymentId: payment.paymentId,
          details: { method: reauthPassword ? 'password' : 'recent-window', totpProvided: Boolean(totpCode) }
        });
        // Best-effort export to the audit sink; do not block the send
        // operation on sink availability.
        sinkAudit(reauthAudit).catch(() => {});
      } catch (auditErr) {
        console.error('Failed to write reauth success audit (send):', auditErr);
      }
    } catch (reauthErr) {
      // Failure audit: record details for investigation.
      try {
        // Failure audit: record minimal details about the failure. Do
        // NOT include raw credentials or codes. Store the error message
        // (sanitized) to help triage (e.g., 'TOTP validation failed').
        const failAudit = await Audit.create({
          employeeId: session.user.userId,
          employeeIdentifier: session.user.userName || null,
          action: 'reauth_failure',
          paymentId: payment.paymentId,
          details: { error: reauthErr.message || 'reauth_failed' }
        });
        sinkAudit(failAudit).catch(() => {});
      } catch (auditErr) {
        // Log but do not block client response
        console.error('Failed to write reauth failure audit (send):', auditErr);
      }

      return NextResponse.json({ error: reauthErr.message || 'Re-authentication required' }, { status: reauthErr.status || 401 });
    }

  // Simulate sending to SWIFT. In a real integration you would call the
  // payment provider's API here and only mark the payment as sent after a
  // successful response. We persist the sent flag and timestamp so the
  // application and audits reflect the change of state.
  payment.sentToSwift = true;
  payment.swiftSentAt = new Date();
  payment.updatedAt = new Date();
  await payment.save();

    // Rotate session after the sensitive send operation
    try {
      await rotateSession(session.user);
    } catch (e) {
      console.error('Session rotation failed after send:', e);
    }

    // Create an audit record for the send action. This lets administrators
    // see which employee transmitted the payment and when. We store the
    // SWIFT code in the audit details to help with later investigation.
    try {
      const created = await Audit.create({
        employeeId: session.user.userId,
        employeeIdentifier: session.user.userName || null,
        action: 'send',
        paymentId: payment.paymentId,
        details: { swiftCode: payment.swiftCode }
      });
      sinkAudit(created).catch(() => {});
    } catch (auditErr) {
      // Do not block the response if auditing fails, but log the error.
      console.error('Audit log error (send):', auditErr);
    }

    return NextResponse.json({ message: 'Payment sent to SWIFT (simulated)' }, { status: 200 });
  } catch (err) {
    console.error('Error sending to SWIFT:', err);
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
