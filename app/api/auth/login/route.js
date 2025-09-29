import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/db/connection.js';
import User from '../../../../lib/db/models/user.js';
import { verifyPassword } from '../../../../lib/auth/password.js';
import { sanitizeAndValidate, validateInput } from '../../../../lib/security/validation.js';
import { createSessionCookie, rotateSession, validateCsrfTokenForAuth } from '../../../../lib/auth/session.js';

export async function POST(request) {
    try {

        // Validate CSRF token
        if (!validateCsrfTokenForAuth(request)) {
            return NextResponse.json({ 
                error: 'Invalid CSRF token. Please refresh the page and try again.' 
            }, { status: 403 });
        }

        const body = await request.json();
        const { userName, accountNumber, password } = body;

        if (!userName || !accountNumber || !password) {
            return NextResponse.json({ 
                error: 'All fields are required.' 
            }, { status: 400 });
        }

        // Connect to database
        await dbConnect();

        // Validate and sanitize inputs
        const validationResults = {
            userName: sanitizeAndValidate(userName, 'username'),
            accountNumber: sanitizeAndValidate(accountNumber, 'accountNumber'),
            password: { sanitized: password, isValid: validateInput(password, 'password') },
        };

        // Collect validation errors
        const validationErrors = {};

        if (!validationResults.userName.isValid) {
            validationErrors.userName = 'Invalid username format!';
        }

        if (!validationResults.accountNumber.isValid) {
            validationErrors.accountNumber = 'Invalid account number format!';
        }

        if (!validationResults.password.isValid) {
            validationErrors.password = 'Invalid password format!';
        }

        // Return validation errors if any exist
        if (Object.keys(validationErrors).length > 0) {
            return NextResponse.json({ errors: validationErrors }, { status: 400 });
        }

        // Find user by username and account number
        const user = await User.findOne({
            userName: validationResults.userName.sanitized,
            accountNumber: validationResults.accountNumber.sanitized
        });

        if (!user) {
            return NextResponse.json({ error: 'Invalid username, account number, or password! USER' }, { status: 401 });
        }

        // Verify password
        const validPassword = await verifyPassword(validationResults.password.sanitized, user.password);
        if (!validPassword) {
            return NextResponse.json({ error: 'Invalid username, account number, or password! PASS' }, { status: 401 });
        }

        // Create/rotate session cookie
        const response = NextResponse.json({
            message: 'Login successful!',
            user: {
                userName: user.userName,
                fullName: user.fullName,
                role: user.role
            },
            csrfToken: null // Placeholder, will be set below
        }, { status: 200 });

        const { csrfToken } = rotateSession(response, user);
       // rotateSession(response, user);

        const responseBody = {
         message: 'Login successful',
          user: {
              userName: user.userName,
              fullName: user.fullName,
                role: user.role
    },
    csrfToken: csrfToken
};

// Return the response with cookies from rotateSession
return new NextResponse(JSON.stringify(responseBody), {
    status: 200,
    headers: response.headers
    });

    } 
    catch (err) {
        console.error('Login error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// Only allow POST method
export async function GET() {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}

export async function PUT() {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}

export async function DELETE() {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}