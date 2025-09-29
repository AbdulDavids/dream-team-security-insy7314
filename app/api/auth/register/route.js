import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/db/connection.js';
import User from '../../../../lib/db/models/user.js';
import { hashPassword } from '../../../../lib/auth/password.js';
import { sanitizeAndValidate } from '../../../../lib/security/validation.js';
import { validateCsrfTokenForAuth } from '../../../../lib/auth/session.js';

export async function POST(request) {
    try {
        // Validate CSRF token
        if (!validateCsrfTokenForAuth(request)) {
            return NextResponse.json({ 
                error: 'Invalid CSRF token. Please refresh the page and try again.' 
            }, { status: 403 });
        }

        // Parse request body
        const body = await request.json();
        const { fullName, userName, idNumber, accountNumber, password } = body;

        // Connect to database
        await dbConnect();

        // Validate and sanitize inputs
        const validationResults = {
            fullName: sanitizeAndValidate(fullName, 'fullName'),
            userName: sanitizeAndValidate(userName, 'username'),
            idNumber: sanitizeAndValidate(idNumber, 'idNumber'),
            accountNumber: sanitizeAndValidate(accountNumber, 'accountNumber'),
            password: sanitizeAndValidate(password, 'password'),
        };

        // Collect validation errors
        const validationErrors = {};

        if (!validationResults.fullName.isValid) {
            validationErrors.fullName = 'Full name must be 2-100 characters, letters and common punctuation only!';
        }

        if (!validationResults.userName.isValid) {
            validationErrors.userName = 'Username must be 3-30 characters and can only contain letters, numbers, and underscores!';
        }

        if (!validationResults.idNumber.isValid) {
            validationErrors.idNumber = 'ID number must be exactly 13 digits!';
        }

        if (!validationResults.accountNumber.isValid) {
            validationErrors.accountNumber = 'Account number must be between 7-11 digits!';
        }

        if (!validationResults.password.isValid) {
            validationErrors.password = 'Password must be at least 8 characters, include uppercase, lowercase, number, and special character!';
        }

        // Return validation errors if any exist
        if (Object.keys(validationErrors).length > 0) {
            return NextResponse.json({ errors: validationErrors }, { status: 400 });
        }

        // Check for existing user with same username, ID number, or account number
        const existingUser = await User.findOne({
            $or: [
                { userName: validationResults.userName.sanitized },
                { idNumber: validationResults.idNumber.sanitized },
                { accountNumber: validationResults.accountNumber.sanitized }
            ]
        });

        if (existingUser) {
            return NextResponse.json({ error: 'Username, ID number, or account number already in use!' }, { status: 409 });
        }

        // Hash password
        const hashedPassword = await hashPassword(validationResults.password.sanitized);

        // Create new user
        const newUser = new User({
            fullName: validationResults.fullName.sanitized,
            userName: validationResults.userName.sanitized,
            idNumber: validationResults.idNumber.sanitized,
            accountNumber: validationResults.accountNumber.sanitized,
            password: hashedPassword,
            role: 'user'
        });

        // Save new user to database
        await newUser.save();

        return NextResponse.json({ message: 'User registered successfully!' }, { status: 201 });
    }
    catch (error) {
        console.error('Error during user registration:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
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