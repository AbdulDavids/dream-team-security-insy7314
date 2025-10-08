import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import dbConnect from '../../../../lib/db/connection.js';
import User from '../../../../lib/db/models/user.js';
import { verifyPassword } from '../../../../lib/auth/password.js';
import { sanitizeAndValidate, validateInput } from '../../../../lib/security/validation.js';
import { rotateSession, validateCsrfTokenForAuth } from '../../../../lib/auth/session.js';
import { signToken } from '../../../../lib/auth/jwt.js';
import { v4 as uuidv4 } from 'uuid';

const SESSION_CONFIG = {
  ABSOLUTE_TIMEOUT: 30 * 60,
  IDLE_TIMEOUT: 10 * 60
};

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

        // Generic error message
        if (!user) {
            return NextResponse.json({ error: 'Invalid username, account number, or password!' }, { status: 401 });
        }

        // Verify password
        const validPassword = await verifyPassword(validationResults.password.sanitized, user.password);
        if (!validPassword) {
            return NextResponse.json({ error: 'Invalid username, account number, or password!' }, { status: 401 });
        }

        // Create secure session
        const cookieStore = await cookies();
        const sessionId = uuidv4();
        const csrfToken = uuidv4();
        const now = Math.floor(Date.now() / 1000);

        const sessionPayload = {
            userId: user._id.toString(),
            userName: user.userName,
            fullName: user.fullName,
            role: user.role,
            sessionId: sessionId,
            issuedAt: now,
            lastActivity: now,
            absoluteExpiry: now + SESSION_CONFIG.ABSOLUTE_TIMEOUT,
            idleExpiry: now + SESSION_CONFIG.IDLE_TIMEOUT
        };

        const token = signToken(sessionPayload);

        // Set session cookie
        cookieStore.set('session-token', token, {
            httpOnly: true,
            secure: true, 
            sameSite: 'strict',
            path: '/',
            maxAge: SESSION_CONFIG.ABSOLUTE_TIMEOUT
        });

        // Set CSRF cookie
        cookieStore.set('csrf-token', csrfToken, {
            httpOnly: false, // Accessible forms
            secure: true,
            sameSite: 'strict',
            path: '/',
            maxAge: SESSION_CONFIG.ABSOLUTE_TIMEOUT
        });

        return NextResponse.json({
            message: 'Login successful',
            user: {
                userName: user.userName,
                fullName: user.fullName,
                role: user.role
            },
            csrfToken: csrfToken
        }, { status: 200 });

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