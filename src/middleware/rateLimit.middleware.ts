import { Request, Response, NextFunction } from "express";

interface RateLimitOptions {
  windowMs: number;
  limit: number;
  message?: string | object;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
}

interface ClientRecord {
  count: number;
  resetTime: number;
}

const MAX_ENTRIES = 50000;

/**
 * Derive client IP from Express (`trust proxy` configured on app) and socket address,
 * ignoring raw spoofable `x-forwarded-for` headers directly.
 */
export const resolveClientIp = (req: Request): string =>
  req.ip || req.socket?.remoteAddress || "unknown";

export const rateLimit = (options: RateLimitOptions) => {
  const hits = new Map<string, ClientRecord>();

  // Periodically clean up expired entries
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of hits.entries()) {
      if (now > record.resetTime) {
        hits.delete(ip);
      }
    }
  }, options.windowMs);

  if (timer.unref) {
    timer.unref();
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    if (options.skip?.(req)) {
      return next();
    }

    const key = options.keyGenerator
      ? options.keyGenerator(req)
      : resolveClientIp(req);

    const now = Date.now();
    const record = hits.get(key);

    if (!record || now > record.resetTime) {
      // Memory protection: if map exceeds max entries, evict oldest or expired
      if (hits.size >= MAX_ENTRIES) {
        for (const [entryKey, val] of hits.entries()) {
          if (now > val.resetTime || hits.size >= MAX_ENTRIES) {
            hits.delete(entryKey);
          }
          if (hits.size < MAX_ENTRIES * 0.9) break;
        }
      }

      hits.set(key, {
        count: 1,
        resetTime: now + options.windowMs,
      });
      res.setHeader("X-RateLimit-Limit", options.limit);
      res.setHeader("X-RateLimit-Remaining", options.limit - 1);
      res.setHeader(
        "X-RateLimit-Reset",
        Math.ceil((now + options.windowMs) / 1000),
      );
      return next();
    }

    record.count++;

    if (record.count > options.limit) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader("Retry-After", retryAfterSeconds);
      res.setHeader("X-RateLimit-Limit", options.limit);
      res.setHeader("X-RateLimit-Remaining", 0);
      res.setHeader("X-RateLimit-Reset", Math.ceil(record.resetTime / 1000));

      const message =
        options.message ||
        "Too many requests from this IP, please try again later.";

      res
        .status(429)
        .json(
          typeof message === "string" ? { success: false, message } : message,
        );
      return;
    }

    res.setHeader("X-RateLimit-Limit", options.limit);
    res.setHeader(
      "X-RateLimit-Remaining",
      Math.max(0, options.limit - record.count),
    );
    res.setHeader("X-RateLimit-Reset", Math.ceil(record.resetTime / 1000));

    next();
  };
};

/**
 * Global Rate Limiter:
 * 1000 requests per 15 minutes per IP address (NAT-safe coarse shield; /api/auth excluded to avoid double counting).
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 1000,
  skip: (req) => {
    const cleanOriginal = req.originalUrl?.split("?")[0] ?? "";
    return (
      cleanOriginal.startsWith("/api/auth") ||
      req.path === "/auth" ||
      req.path.startsWith("/auth/")
    );
  },
  message: {
    success: false,
    message:
      "Too many requests from this IP, please try again after 15 minutes.",
  },
});

/**
 * Authenticated Per-User Rate Limiter:
 * 200 requests per 15 minutes keyed by verified req.user.id so university NAT users are isolated from one another.
 */
export const authenticatedUserLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 200,
  keyGenerator: (req) =>
    req.user?.id ? `user:${req.user.id}` : `ip:${resolveClientIp(req)}`,
  message: {
    success: false,
    message:
      "Too many requests from your account, please try again after 15 minutes.",
  },
});

/**
 * Strict Auth Actions Rate Limiter (Login & Register):
 * 10 requests per 15 minutes per IP address.
 */
export const authActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20,
  message: {
    success: false,
    message:
      "Too many login or registration attempts. Please try again after 15 minutes.",
  },
});

/**
 * Onboard Rate Limiter:
 * 10 requests per 15 minutes per IP address.
 */
export const onboardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  message: {
    success: false,
    message: "Too many onboarding attempts. Please try again after 15 minutes.",
  },
});

/**
 * Strict OTP Email Dispatch Rate Limiter:
 * Max 3 email OTP send/resend attempts per 15 minutes per IP address.
 * Protects email verification and password reset code dispatch.
 */
export const otpEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 3,
  message: {
    success: false,
    message:
      "Too many email verification attempts. You can only request up to 3 codes every 15 minutes. Please try again later.",
  },
});

/**
 * Baseline Auth Rate Limiter:
 * 100 requests per 15 minutes per IP address on /api/auth endpoints for non-sensitive operations (sessions, sign-out).
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100,
  message: {
    success: false,
    message:
      "Too many authentication attempts, please try again after 15 minutes.",
  },
});
