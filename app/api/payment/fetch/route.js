import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/db/connection.js';
import Payment from '../../../../lib/db/models/payment.js';
import { getSession } from '../../../../lib/auth/session.js';

export async function GET(request) {
    try {
        // Verify session
        const session = getSession(request);
        
        if (!session || !session.isValid) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        // Verify role
        if (session.user.role !== 'user') {
            return NextResponse.json(
                { error: 'Only users can view payments' },
                { status: 403 }
            );
        }

        // Get query parametres
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit')) || 5;
        const all = searchParams.get('all') === 'true';

        await dbConnect();

        // Buil query
        const query = { userId: session.user.userId };

        // Fetch payments for user
        let paymentsQuery = Payment.find(query)
            .sort({ createdAt: -1 }) 
            .select('-__v'); // Exclude mongoose version field

        // Apply recent limit if not fetching all
        if (!all) {
            paymentsQuery = paymentsQuery.limit(limit);
        }

        const payments = await paymentsQuery.lean();

        // Get total count
        const totalCount = await Payment.countDocuments(query);

        // Return payments
        return NextResponse.json({
            payments: payments,
            count: payments.length,
            total: totalCount
        }, { status: 200 });

    } catch (error) {
        console.error('Fetch payments error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch payments' },
            { status: 500 }
        );
    }
}

// Only allow GET method
export async function POST() {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}

export async function PUT() {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}

export async function DELETE() {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}