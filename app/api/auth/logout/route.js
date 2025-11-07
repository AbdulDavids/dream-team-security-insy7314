import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSession, validateCsrfToken, clearSessionCookie } from '../../../../lib/auth/session.js';
import dbConnect from '../../../../lib/db/connection.js';
import Employee from '../../../../lib/db/models/employee.js';

export async function POST(request) {
    try {
        // Get session
        const session = getSession(request);

        if (!session || !session.isValid) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // Validate CSRF token
        let csrfHeader = request.headers.get('x-csrf-token');
        try{
             const body = await request.json().catch(() => null);
            if (!csrfHeader && body?.csrfToken) {
                csrfHeader = body.csrfToken;
            }
        } catch (err) {
            csrfHeader = null;
        }
        

        if (!csrfHeader || session.csrfToken !== csrfHeader) {
            return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
        }

        // Clear session cookie
        const cookieStore = await cookies();
        cookieStore.delete('session-token');
        cookieStore.delete('csrf-token');

        // Also clear server-side reauth state for this employee so a
        // subsequent immediate login does not inherit the previous
        // reauth window. This is a best-effort operation and should not
        // block the logout response on failure.
        try {
            await dbConnect();
            if (session?.user?.userId) {
                await Employee.findByIdAndUpdate(session.user.userId, { $set: { lastReauthAt: null, reauthFailures: 0 } }).exec();
            }
        } catch (e) {
            console.error('Failed to clear employee reauth state on logout:', e);
        }

        return NextResponse.json(
            { message: 'Logged out successfully' },
            {
                status: 200,
                headers: {
                    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            }
        );
    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// Only allow POSTn
export async function GET() {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}
