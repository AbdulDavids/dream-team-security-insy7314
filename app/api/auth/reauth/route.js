// API: Re-authenticate for a payment (validate credentials only)
// This endpoint validates the employee password and optional TOTP for a
// given paymentId without performing the verify/send operation. It lets
// the UI perform a dedicated re-auth step and then proceed to the
// confirmation step if successful.
import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/db/connection.js';
import Payment from '../../../../lib/db/models/payment.js';
import Audit from '../../../../lib/db/models/audit.js';
import { sinkAudit } from '../../../../lib/security/auditSink.js';
import { getSession, validateCsrfToken } from '../../../../lib/auth/session.js';
import rateLimiter from '../../../../lib/security/rateLimiter.js';
import { requireReauthIfNeeded } from '../../../../lib/security/reauth.js';

export async function POST(request) {
  try {
    const rl = rateLimiter.checkRateLimit(request);
    if (!rl.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter || 60) } });
    }

    const session = getSession(request);
    if (!session || !session.isValid) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (!validateCsrfToken(request)) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const { paymentId, reauthPassword, totpCode } = body || {};

    // paymentId is optional here; if supplied we will look up the payment
    // to obtain its amount for the reauth helper. If not supplied we call
    // the helper without a payment context.
    await dbConnect();
    let payment = null;
    if (paymentId) {
      payment = await Payment.findOne({ paymentId }).exec();
      if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    try {
      // Validate credentials; pass the payment amount when available.
      const employee = await requireReauthIfNeeded({ sessionUser: session.user, amount: payment ? payment.amount : undefined, reauthPassword, totpCode });

      // Record a reauth success audit entry (minimal metadata)
      try {
        const reauthAudit = await Audit.create({
          employeeId: session.user.userId,
          employeeIdentifier: session.user.userName || null,
          action: 'reauth_success',
          paymentId: payment ? payment.paymentId : null,
          details: { method: reauthPassword ? 'password' : 'recent-window', totpProvided: Boolean(totpCode) }
        });
        sinkAudit(reauthAudit).catch(() => {});
      } catch (auditErr) {
        console.error('Failed to write reauth success audit (reauth endpoint):', auditErr);
      }

  // Return the updated lastReauthAt and the configured reauth window
  // so the client can show a countdown. Use the environment value
  // or default to the same value used server-side.
      const reauthWindowSeconds = Number(process.env.REAUTH_WINDOW_SECONDS || 300);
      return NextResponse.json({ message: 'Re-authentication succeeded', lastReauthAt: employee.lastReauthAt, reauthWindowSeconds }, { status: 200 });
    } catch (reauthErr) {
      // Record failure audit
      try {
        const failAudit = await Audit.create({
          employeeId: session.user.userId,
          employeeIdentifier: session.user.userName || null,
          action: 'reauth_failure',
          paymentId: payment ? payment.paymentId : null,
          details: { error: reauthErr.message || 'reauth_failed' }
        });
        sinkAudit(failAudit).catch(() => {});
      } catch (auditErr) {
        console.error('Failed to write reauth failure audit (reauth endpoint):', auditErr);
      }

      return NextResponse.json({ error: reauthErr.message || 'Re-authentication failed' }, { status: reauthErr.status || 401 });
    }
  } catch (err) {
    console.error('Error in reauth endpoint:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}
