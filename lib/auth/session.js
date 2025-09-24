import { cookies } from "next/headers";
import { signToken, verifyToken } from "./jwt.js";
import {v4 as uuidv4} from 'uuid';

const SESSION_DURATION = 24*60*60 // 24 hours in seconds

// Create a session cookie
export function createSessionCookie(res, user) {
    // Generate a unique session ID
    const sessionId = uuidv4(); 

    const token = signToken({
        userId: user._id.toString(),
        userName: user.userName,
        role: user.role,
        sessionId: sessionId,
        issuedAt: Math.floor(Date.now() / 1000)
    });

    const cookieOptions = [
        `session-token=${token}`,
        `HttpOnly`,
        `Secure`,
        `Path=/`,
        `Max-Age=${SESSION_DURATION}`,
        `SameSite=Strict`
    ].join('; ');

    res.headers.append('Set-Cookie', cookieOptions);

    const csrfToken = uuidv4();
    const csrfCookieOptions = [
        `csrf-token=${csrfToken}`,
        'Path=/',
        `Max-Age=${SESSION_DURATION}`, // 1 hour
        'SameSite=Strict'
        // no HTTPOnly for forms 
    ].join('; ');

    res.headers.append('Set-Cookie', csrfCookieOptions);

    return { csrfToken };
}

// Clear the session cookie
export function clearSessionCookie(res) {
    const cookieOptions = [
        `session-token=`,
        `HttpOnly`,
        `Secure`,
        `Path=/`,
        `Max-Age=0`,
        `SameSite=Strict`
    ].join('; ');

    const csrfCookieOptions = [
        `csrf-token=`,
        `Path=/`,
        `Max-Age=0`,
        `SameSite=Strict`
    ].join('; ');

    res.headers.append('Set-Cookie', cookieOptions);
    res.headers.append('Set-Cookie', csrfCookieOptions);
}

// Get and verify session from cookies
export function getSession(req) {
    const cookieHeader = req.headers.get('cookie');
    if (!cookieHeader) return null;

    const cookiesMap = cookieHeader.split('; ').reduce((acc, cookie) => {
        const [name, value] = cookie.split('=');
        acc[name] = value;
        return acc;
    }, {});

    const token = cookiesMap['session-token'];
    const verify = verifyToken(token);

    if (!verify || !verify.isValid) return null;

    return {
        isValid: true,
        user: verify.user,
        exp: verify.exp,
        csrfToken: cookiesMap['csrf-token'],
    };
}

// Validate CSRF token
export function validateCsrfToken(req) {
    const session = getSession(req);
    if (!session || !session.csrfToken) return false;

    const csrfHeader = req.headers.get('x-csrf-token');

    return session.csrfToken === csrfHeader;
}

// Middleware helper to protect routes
export function requireAuth(req) {
    const session = getSession(req);

    if (!session || !session.isValid) {
        return { isAuthenticated: false, user: null, redirectTo: '/login' };
    }

    return { isAuthenticated: true, user: session.user, csrfToken: session.csrfToken };
}

// Middleware helper to enforce role-based access
export function requireRole(session, requiredRole) {
    if (!session || !session.isValid) {
        return { hasAccess: false, reason: 'Not authenticated'};
    }

    if (session.user.role !== requiredRole) {
        return { hasAccess: false, reason: 'Insufficient permissions'};
    }

    return { hasAccess: true };
}

// Session rotation for high-security operations (prevents session hijacking)
export function rotateSession(res, user) {
    // Clear old session
    clearSessionCookie(res);
    
    // Create new session with new ID
    return createSessionCookie(res, user);
}