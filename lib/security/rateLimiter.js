class NextJSRateLimiter {
  constructor() {
    this.requests = new Map();
  }

  // Rate limit configurations
  static configs = {
    general: { windowMs: 15 * 60 * 1000, maxRequests: 100 },
    auth: { windowMs: 15 * 60 * 1000, maxRequests: 10 },
    payments: { windowMs: 60 * 60 * 1000, maxRequests: 20 },
    employee: { windowMs: 15 * 60 * 1000, maxRequests: 50 }  //NOT IMPLEMETED YET
  };

  getClientIP(request) {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    return forwarded?.split(',')[0] || realIP || 'unknown';
  }

  getRateLimitType(pathname) {
    // Exclude logout and csrf token generation from rate limiting
    if (pathname.startsWith('/api/auth/logout')) return null;
    if (pathname.startsWith('/api/auth/csrf-token')) return null;

    if (pathname.startsWith('/api/payment/create')) return 'payments'; // Creating payments
    if (pathname.startsWith('/api/payment')) return 'general'; // Fetching payments 
    if (pathname.startsWith('/api/auth')) return 'auth';
    if (pathname.startsWith('/api/employee')) return 'employee';  //NOT IMPLEMENTED YET
    return 'general';
  }

  checkRateLimit(request) {
    const ip = this.getClientIP(request);
    const type = this.getRateLimitType(request.nextUrl.pathname);

    // Skip rate limiting if type is null
    if (type === null) {
      return { success: true, type: 'excluded', limit: null, remaining: null };
    }

    const config = NextJSRateLimiter.configs[type];
    
    const key = `${ip}:${type}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Initialize if not exists
    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }

    // Get existing requests and filter out old ones
    const userRequests = this.requests.get(key);
    const validRequests = userRequests.filter(timestamp => timestamp > windowStart);

    // Check if limit exceeded
    if (validRequests.length >= config.maxRequests) {
      return {
        success: false,
        type,
        limit: config.maxRequests,
        windowMs: config.windowMs,
        retryAfter: Math.ceil(config.windowMs / 1000)
      };
    }

    // Add current request
    validRequests.push(now);
    this.requests.set(key, validRequests);

    return {
      success: true,
      type,
      limit: config.maxRequests,
      remaining: config.maxRequests - validRequests.length
    };
  }

  // Cleanup old entries
  cleanup() {
    const now = Date.now();
    const maxWindow = Math.max(...Object.values(NextJSRateLimiter.configs).map(c => c.windowMs));
    
    for (const [key, requests] of this.requests.entries()) {
      const validRequests = requests.filter(timestamp => timestamp > now - maxWindow);
      if (validRequests.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validRequests);
      }
    }
  }
}

// Singleton instance
const rateLimiter = new NextJSRateLimiter();

// Cleanup every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => rateLimiter.cleanup(), 10 * 60 * 1000);
}

export default rateLimiter;