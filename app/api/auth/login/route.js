import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/db/connection.js';
import User from '../../../../lib/db/models/user.js';
import { verifyPassword } from '../../../../lib/auth/password.js';
import { sanitizeAndValidate } from '../../../../lib/security/validation.js';
import { createSessionCookie } from '../../../../lib/auth/session.js';

export async function POST(request) {
    try {
        const body = await request.json();
        const { userName, accountNumber, password } = body;

        // Connect to database
        await dbConnect();

        // Validate and sanitize inputs
        const validationResults = {
            userName: sanitizeAndValidate(userName, 'username'),
            accountNumber: sanitizeAndValidate(accountNumber, 'accountNumber'),
            password: sanitizeAndValidate(password, 'password'),
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
            return NextResponse.json({ error: 'Invalid username, account number, or password!' }, { status: 401 });
        }

        // Verify password
        const validPassword = await verifyPassword(validationResults.password.sanitized, user.password);
        if (!validPassword) {
            return NextResponse.json({ error: 'Invalid username, account number, or password!' }, { status: 401 });
        }

        // Create session cookie
        const response = NextResponse.json({
            message: 'Login successful!',
            user: {
                userName: user.userName,
                fullName: user.fullName,
                role: user.role
            }
        }, { status: 200 });

        createSessionCookie(response, user);

        return response;
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