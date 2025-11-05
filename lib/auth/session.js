import { cookies } from "next/headers";
import { signToken, verifyToken } from "./jwt.js";
import {v4 as uuidv4} from 'uuid';

// Session timeout configurations
const SESSION_CONFIG = {
  ABSOLUTE_TIMEOUT: 30 * 60,  // 30 mins
  IDLE_TIMEOUT: 10 * 60,   // 10 mins
  RENEWAL_THRESHOLD: 2 * 60,     // 2 mins before idle expiry
  MAX_CONCURRENT_SESSIONS: 1     
};

// Create a session cookie
export function createSessionCookie(res, user) {
    // Generate a unique session ID
    const sessionId = uuidv4(); 
    const now = Math.floor(Date.now() / 1000);

    const absoluteTimeout = SESSION_CONFIG.ABSOLUTE_TIMEOUT;

    const sessionPayload = {
    userId: user._id.toString(),
    userName: user.userName,
    fullName: user.fullName,
    role: user.role,
    sessionId: sessionId,
    issuedAt: now,
    lastActivity: now, // Track last activity for idle timeout
    absoluteExpiry: now + absoluteTimeout,
    idleExpiry: now + SESSION_CONFIG.IDLE_TIMEOUT
    };

    const token = signToken(sessionPayload);


    const cookieOptions = [
        `session-token=${token}`,
        `HttpOnly`,
        `Secure`, 
        `Path=/`,
        `SameSite=Strict`
    ].join('; ');

    res.headers.append('Set-Cookie', cookieOptions);

    const csrfToken = uuidv4();
    const csrfCookieOptions = [
        `csrf-token=${csrfToken}`,
        'Path=/',
        'SameSite=Strict',
        'Secure'
        // no HTTPOnly for forms 
    ].join('; ');

    res.headers.append('Set-Cookie', csrfCookieOptions);

    return { csrfToken, sessionId, absoluteExpiry: sessionPayload.absoluteExpiry };
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
        `SameSite=Strict`,
        `Secure`
    ].join('; ');

    res.headers.append('Set-Cookie', cookieOptions);
    res.headers.append('Set-Cookie', csrfCookieOptions);

    console.log(`Session cleared at ${new Date().toISOString()}`);
}

// Get and verify session from cookies
export function getSession(req) {
    const cookieHeader = req.headers.get('cookie');
    if (!cookieHeader) return null;

    const cookiesMap = cookieHeader.split('; ').reduce((acc, cookie) => {
        const [name, value] = cookie.split('=');
        if (name && value) { 
            acc[name] = decodeURIComponent(value);
        }
        return acc;
    }, {});

    const token = cookiesMap['session-token'];
    if (!token) return null;

    const verify = verifyToken(token);
    if (!verify || !verify.isValid) return null;

    const now = Math.floor(Date.now() / 1000);
    const session = verify.user;

    // Check absolute timeout
     if (session.absoluteExpiry && now > session.absoluteExpiry) {
    console.log(`Session expired (absolute timeout): ${session.userName}`);
    return { isValid: false, reason: 'absolute_timeout' };
    }

     // Check idle timeout
    if (session.idleExpiry && now > session.idleExpiry) {
    console.log(`Session expired (idle timeout): ${session.userName}`);
    return { isValid: false, reason: 'idle_timeout' };
    }

    const needsRenewal = (session.idleExpiry - now) < SESSION_CONFIG.RENEWAL_THRESHOLD;

    return {
        isValid: true,
        user: session,
        exp: verify.exp,
        csrfToken: cookiesMap['csrf-token'],
        needsRenewal,
        timeUntilExpiry: session.absoluteExpiry - now,
        timeUntilIdle: session.idleExpiry - now,
        lastActivity: session.lastActivity
    };
}

// Update session activity (reset idle timeout)
export function updateSessionActivity(res, currentSession) {
  const now = Math.floor(Date.now() / 1000);
  
  // Create updated session with new idle timeout
  const updatedPayload = {
    ...currentSession.user,
    lastActivity: now,
    idleExpiry: now + SESSION_CONFIG.IDLE_TIMEOUT
  };

  const newToken = signToken(updatedPayload);
  const absoluteTimeout = updatedPayload.absoluteExpiry - now;

  // Update session cookie
  const cookieOptions = [
    `session-token=${newToken}`,
    `HttpOnly`,
    `Secure`,
    `Path=/`,
    `Max-Age=${Math.max(absoluteTimeout, 0)}`,
    `SameSite=Strict`
  ].join('; ');

  res.headers.append('Set-Cookie', cookieOptions);
  
  return { updated: true, newIdleExpiry: updatedPayload.idleExpiry };
}

// Validate CSRF token
export function validateCsrfToken(req) {
    const session = getSession(req);
    if (!session || !session.csrfToken || !session.isValid) return false;

    const csrfHeader = req.headers.get('x-csrf-token');

    if(!csrfHeader) return false;

    return session.csrfToken === csrfHeader;
}

// Middleware helper to protect routes
export function requireAuth(req) {
    const session = getSession(req);

    if (!session || !session.isValid) {
        return { isAuthenticated: false, user: null, redirectTo: '/login',  error: 'Authentication required' };
    }

    return { isAuthenticated: true, user: session.user, csrfToken: session.csrfToken };
}

// Middleware helper to enforce role-based access
export function requireRole(session, requiredRole) {
    if (!session || !session.isValid) {
        return { hasAccess: false, reason: 'Not authenticated', redirectTo: '/login'};
    }

    if (session.user.role !== requiredRole) {
        return { hasAccess: false, reason: 'Insufficient permissions', redirectTo: '/login'};
    }

    return { hasAccess: true };
}

// Session rotation for high-security operations
export async function rotateSession(user) {
  const cookieStore = await cookies();

  // Accept either an Employee document (with _id) or a session.user object
  const userId = user?._id ? user._id.toString() : user?.userId || user?.userId;
  const userName = user?.employeeId || user?.userName || user?.userId || 'unknown';
  const fullName = user?.fullName || '';

  // Clear old cookies
  cookieStore.delete('session-token');
  cookieStore.delete('csrf-token');

  // Generate new session
  const sessionId = uuidv4();
  const csrfToken = uuidv4();
  const now = Math.floor(Date.now() / 1000);

  const sessionPayload = {
    userId: userId,
    userName: userName,
    fullName: fullName,
    role: user?.role || 'employee',
    sessionId: sessionId,
    issuedAt: now,
    lastActivity: now,
    absoluteExpiry: now + SESSION_CONFIG.ABSOLUTE_TIMEOUT,
    idleExpiry: now + SESSION_CONFIG.IDLE_TIMEOUT
  };

  const token = signToken(sessionPayload);

  // Set new session cookie
  cookieStore.set('session-token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_CONFIG.ABSOLUTE_TIMEOUT
  });

  // Set new CSRF cookie
  cookieStore.set('csrf-token', csrfToken, {
    httpOnly: false,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_CONFIG.ABSOLUTE_TIMEOUT
  });

  return { csrfToken, sessionId, absoluteExpiry: sessionPayload.absoluteExpiry };
}

// Middleware to check and update session activity
export function validateAndUpdateSession(req, res) {
  const session = getSession(req);
  
  if (!session || !session.isValid) {
    return { 
      isAuthenticated: false, 
      reason: session?.reason || 'no_session',
      user: null 
    };
  }

  // Update activity if session needs renewal
  if (session.needsRenewal && res) {
    updateSessionActivity(res, session);
  }

  return {
    isAuthenticated: true,
    user: session.user,
    csrfToken: session.csrfToken,
    sessionInfo: {
      timeUntilExpiry: session.timeUntilExpiry,
      timeUntilIdle: session.timeUntilIdle,
      lastActivity: new Date(session.lastActivity * 1000).toISOString()
    }
  };
}

export function validateCsrfTokenForAuth(req) {
    // For login/register, check CSRF token from cookie directly
    const cookieHeader = req.headers.get('cookie');
    if (!cookieHeader) return false;

    // Parse cookies
    const cookiesMap = cookieHeader.split('; ').reduce((acc, cookie) => {
        const [name, value] = cookie.split('=');
        if (name && value) {
            acc[name] = decodeURIComponent(value);
        }
        return acc;
    }, {});

    const csrfFromCookie = cookiesMap['csrf-token'];
    if (!csrfFromCookie) return false;

    // Get CSRF token from header
    const csrfFromHeader = req.headers.get('x-csrf-token');
    
    return csrfFromCookie === csrfFromHeader;
}

// Client-side timeout helper (returns data for frontend)
export function getClientTimeoutInfo(session) {
  if (!session?.isValid) return null;
  
  const now = Math.floor(Date.now() / 1000);
  
  return {
    absoluteTimeoutWarning: Math.max(0, session.user.absoluteExpiry - now - (5 * 60)), // Warn 5 min before
    idleTimeoutWarning: Math.max(0, session.user.idleExpiry - now - (1 * 60)), // Warn 1 min before
    timeUntilAbsoluteExpiry: Math.max(0, session.user.absoluteExpiry - now),
    timeUntilIdleExpiry: Math.max(0, session.user.idleExpiry - now)
  };
}