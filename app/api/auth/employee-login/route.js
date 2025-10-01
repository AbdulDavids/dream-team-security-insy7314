import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/db/connection.js';
import Employee from '../../../../lib/db/models/employee.js';
import { verifyPassword } from '../../../../lib/auth/password.js';
import { sanitizeAndValidate } from '../../../../lib/security/validation.js';
import { rotateSession, validateCsrfTokenForAuth } from '../../../../lib/auth/session.js';

export async function POST(request) {
    try {

        // Validate CSRF token
        if (!validateCsrfTokenForAuth(request)) {
            return NextResponse.json({ 
                error: 'Invalid CSRF token. Please refresh the page and try again.' 
            }, { status: 403 });
        }

        const body = await request.json();
        const { employeeId, password } = body;

        if (!employeeId || !password) {
            return NextResponse.json({ 
                error: 'All fields are required.' 
            }, { status: 400 });
        }

        // Connect to database
        await dbConnect();

        // Validate and sanitize employee ID
        const employeeIdValidation = sanitizeAndValidate(employeeId, 'employeeId');
        
        if (!employeeIdValidation.isValid) {
            return NextResponse.json({ 
                error: 'Invalid employee ID format. Must be EMP followed by 3 digits (e.g., EMP001).' 
            }, { status: 400 });
        }

        // Find employee by ID
        const employee = await Employee.findOne({
            employeeId: employeeIdValidation.sanitized
        });

        // Generic error message
        if (!employee) {
            return NextResponse.json({ 
                error: 'Invalid employee credentials.' 
            }, { status: 401 });
        }

        // Verify password 
        const validPassword = await verifyPassword(password, employee.password);
        if (!validPassword) {
            return NextResponse.json({ 
                error: 'Invalid employee credentials.' 
            }, { status: 401 });
        }

        // Create secure session 
        const response = NextResponse.json({
            message: 'Login successful',
            user: {
                employeeId: employee.employeeId,
                fullName: employee.fullName,
                role: employee.role
            },
            csrfToken: null
        }, { status: 200 });

        const { csrfToken } = rotateSession(response, {
            _id: employee._id,
            userName: employee.employeeId, // Use employeeId as username
            fullName: employee.fullName,
            role: employee.role
        });

        const responseBody = {
            message: 'Login successful',
            user: {
                employeeId: employee.employeeId,
                fullName: employee.fullName,
                role: employee.role
            },
            csrfToken: csrfToken
            };

        // Return new CSRF token for next request
        return new NextResponse(JSON.stringify(responseBody), {
            status: 200,
            headers: response.headers 
        });

    } catch (err) {
        console.error('Employee login error:', err);
        return NextResponse.json({ 
            error: 'An error occurred during login. Please try again.' 
        }, { status: 500 });
    }
}

// Only allow POST method
export async function GET() {
    return NextResponse.json({ 
        error: 'Method not allowed. Use POST for login.' 
    }, { status: 405 });
}

export async function PUT() {
    return NextResponse.json({ 
        error: 'Method not allowed. Use POST for login.' 
    }, { status: 405 });
}

export async function DELETE() {
    return NextResponse.json({ 
        error: 'Method not allowed. Use POST for login.' 
    }, { status: 405 });
}