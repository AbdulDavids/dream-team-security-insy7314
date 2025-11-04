// API: Acknowledge payment
// Purpose: Allow an end-user to mark a VERIFIED payment as "acknowledged"
// in their personal dashboard. Acknowledging a payment does NOT delete it;
// it sets a durable flag so the payment is omitted from the "recent" view
// but remains visible in full history queries. This endpoint enforces:
// - authenticated session (user)
// - CSRF token validation (double-submit cookie)
// - ownership (the payment must belong to the requesting user)
// - state checks (only verified payments can be acknowledged)
// The response codes are conservative to make client handling simple.
import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/db/connection.js';
import Payment from '../../../../lib/db/models/payment.js';
import { getSession, validateCsrfToken } from '../../../../lib/auth/session.js';

export async function POST(request) {
  try {
    // Validate session: ensure the request is authenticated
    const session = getSession(request);
    if (!session || !session.isValid) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Only users may acknowledge payments (employees or other roles cannot)
    if (session.user.role !== 'user') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Validate CSRF token using the double-submit cookie header approach
    if (!validateCsrfToken(request)) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const { paymentId } = body || {};

    if (!paymentId || typeof paymentId !== 'string') {
      return NextResponse.json({ error: 'paymentId is required' }, { status: 400 });
    }

    await dbConnect();

    const payment = await Payment.findOne({ paymentId }).exec();

    if (!payment) {
      // No payment found with this paymentId
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Ensure the payment belongs to the requesting user
    if (payment.userId.toString() !== session.user.userId) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Only allow users to acknowledge payments that are already verified. This
    // prevents acknowledging pending/cancelled payments accidentally.
    if (payment.status !== 'verified') {
      return NextResponse.json({ error: 'Only verified payments can be acknowledged' }, { status: 409 });
    }

    // Persist the acknowledged flag. This makes the acknowledgement durable and
    // causes the payment to be omitted from the recent/dashboard view.
    payment.acknowledged = true;
    payment.updatedAt = new Date();
    await payment.save();

    return NextResponse.json({ message: 'Payment acknowledged' }, { status: 200 });
  } catch (err) {
    console.error('Error acknowledging payment:', err);
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
