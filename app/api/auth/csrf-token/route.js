import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
    try {
        // Generate CSRF token for unauthenticated users
        const csrfToken = uuidv4();
        
        const response = NextResponse.json({ 
            csrfToken: csrfToken,
            message: 'CSRF token generated'
        });

        // Set CSRF token in cookie 
        const csrfCookieOptions = [
            `csrf-token=${csrfToken}`,
            'Path=/',
            'Max-Age=1800', 
            'SameSite=Strict',
            'Secure'
            // No HttpOnly - forms need access
        ].join('; ');

        response.headers.append('Set-Cookie', csrfCookieOptions);
        
        return response;
        
    } catch (error) {
        console.error('CSRF token generation error:', error);
        return NextResponse.json(
            { error: 'Failed to generate CSRF token' },
            { status: 500 }
        );
    }
}