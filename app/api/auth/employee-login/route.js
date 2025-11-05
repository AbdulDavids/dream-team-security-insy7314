import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import dbConnect from '../../../../lib/db/connection.js';
import Employee from '../../../../lib/db/models/employee.js';
import Audit from '../../../../lib/db/models/audit.js';
import { verifyPassword } from '../../../../lib/auth/password.js';
import { sanitizeAndValidate } from '../../../../lib/security/validation.js';
import { rotateSession, validateCsrfTokenForAuth } from '../../../../lib/auth/session.js';
import rateLimiter from '../../../../lib/security/rateLimiter.js';
import { signToken } from '../../../../lib/auth/jwt.js';
import { v4 as uuidv4 } from 'uuid';

const SESSION_CONFIG = {
  ABSOLUTE_TIMEOUT: 30 * 60,
  IDLE_TIMEOUT: 10 * 60
};

export async function POST(request) {
    try {

        // Rate limit login attempts to mitigate brute-force against employee
        // credentials. Uses the in-repo NextJSRateLimiter implementation.
        const rl = rateLimiter.checkRateLimit(request);
        if (!rl.success) {
            return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter || 60) } });
        }

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
        const cookieStore = await cookies();
        const sessionId = uuidv4();
        const csrfToken = uuidv4();
        const now = Math.floor(Date.now() / 1000);
        
        const sessionPayload = {
            userId: employee._id.toString(),
            userName: employee.employeeId,
            fullName: employee.fullName,
            role: employee.role,
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
            httpOnly: false, // Accessible to forms
            secure: true,
            sameSite: 'strict',
            path: '/',
            maxAge: SESSION_CONFIG.ABSOLUTE_TIMEOUT
        });

                        // Record audit of employee login (non-blocking)
                        // We create a small audit record for each successful employee login so
                        // administrators can later review who accessed the system and when.
                        // The audit write is intentionally non-blocking to avoid preventing
                        // the login flow in case the audit service temporarily fails.
                        try {
                            const created = await Audit.create({
                                employeeId: employee._id,
                                employeeIdentifier: employee.employeeId,
                                action: 'login',
                                details: { employeeId: employee.employeeId }
                            });
                            // Export audit to sink as well (non-blocking)
                            import('../../../../lib/security/auditSink.js').then(m => m.sinkAudit(created)).catch(() => {});
                        } catch (auditErr) {
                            console.error('Audit log error (employee login):', auditErr);
                        }
        
        return NextResponse.json({
            message: 'Employee Login successful',
            user: {
                employeeId: employee.employeeId,
                fullName: employee.fullName,
                role: employee.role
            },
            csrfToken: csrfToken
        }, { status: 200 });
        
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