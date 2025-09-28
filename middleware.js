import { NextResponse } from 'next/server';
import rateLimiter from './lib/security/rateLimiter.js';

export function middleware(request) {
  // Rate limiting check
  const rateLimitResult = rateLimiter.checkRateLimit(request);
  
  if (!rateLimitResult.success) {
    return new NextResponse(
      JSON.stringify({
        error: `Too many ${rateLimitResult.type} requests.`,
        retryAfter: rateLimitResult.retryAfter
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rateLimitResult.retryAfter),
          'X-RateLimit-Limit': String(rateLimitResult.limit),
          'X-RateLimit-Remaining': '0'
        }
      }
    );
  }

  // Continue with request (security headers set in next.config.js)
  const response = NextResponse.next();
  
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
    '/api/(.*)'
  ]
};