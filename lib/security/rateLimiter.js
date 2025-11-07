class NextJSRateLimiter {
  constructor() {
    this.requests = new Map();
  }

  // Rate limit configurations
  static configs = {
    general: { windowMs: 15 * 60 * 1000, maxRequests: 100 },
    auth: { windowMs: 5 * 60 * 1000, maxRequests: 10 },  // 5 minutes, 10 attempts
    payments: { windowMs: 60 * 60 * 1000, maxRequests: 20 }
  };

  getClientIP(request) {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    // Prefer X-Forwarded-For when present (supporting proxies/load balancers)
    return forwarded?.split(',')[0] || realIP || 'unknown';
  }

  getRateLimitType(pathname) {
    // Exclude logout and csrf token generation from rate limiting
    if (pathname.startsWith('/api/auth/logout')) return null;
    if (pathname.startsWith('/api/auth/csrf-token')) return null;
    if (pathname.startsWith('/api/payment/send')) return null;
    if (pathname.startsWith('/api/payment/verify')) return null;

    if (pathname.startsWith('/api/payment/create')) return 'payments'; // Creating payments
    if (pathname.startsWith('/api/payment')) return 'general'; // Fetching payments 
    if (pathname.startsWith('/api/auth')) return 'auth';
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
      // Compute an adaptive retryAfter: next window boundary plus exponential
      // penalty if the client continues to hammer the endpoint. This helps
      // slow down attackers and gives honest clients a clearer wait time.
      const first = validRequests[0] || now;
      const baseRetry = Math.ceil((config.windowMs - (now - first)) / 1000);
      // Penalty scales with how far above the limit the client is, capped
      // to avoid extremely long backoffs in edge cases.
      const penaltyMultiplier = Math.min(8, Math.ceil(validRequests.length / Math.max(1, config.maxRequests)));
      const retryAfter = Math.max(1, baseRetry * penaltyMultiplier);
      return {
        success: false,
        type,
        limit: config.maxRequests,
        windowMs: config.windowMs,
        retryAfter
      };
    }

  // Add current request to the sliding window
    validRequests.push(now);
    this.requests.set(key, validRequests);

    // Small dynamic response: when nearing the limit, include a small
    // hint to the caller so they may slow down. This is informational and
    // can be used by monitoring or by UI to throttle behavior client-side.
    const remaining = Math.max(0, config.maxRequests - validRequests.length);
    return {
      success: true,
      type,
      limit: config.maxRequests,
      remaining,
      warning: remaining < Math.ceil(config.maxRequests * 0.2) ? 'approaching_limit' : undefined
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