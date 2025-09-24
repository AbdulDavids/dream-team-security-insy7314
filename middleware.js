import { NextResponse } from 'next/server';

export function middleware(req) {
    const response = NextResponse.next();

    // Security headers

    // Clickjacking protection
    response.headers.set('X-Frame-Options', 'DENY');

    // XSS protection
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Enforce HTTPS
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

    // Content Security Policy (CSP)
    const csp = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'", // Next.js needs unsafe-inline for dev
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self'",
        "connect-src 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'", 
        "base-uri 'self'",
        "object-src 'none'"
    ].join('; ');

    response.headers.set('Content-Security-Policy', csp);

    // Other security policies
    response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
    response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');

    // Remove server information
    response.headers.delete('X-Powered-By');
    response.headers.delete('Server');

    return response;
}

// Apply middleware to all routes except static files, images, favicon, and public assets
export const config = {
    matcher: [ '/((?!_next/static|_next/image|favicon.ico|public).*)',],
};