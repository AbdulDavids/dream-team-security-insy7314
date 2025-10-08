import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSession, validateCsrfToken, clearSessionCookie } from '../../../../lib/auth/session.js';

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
