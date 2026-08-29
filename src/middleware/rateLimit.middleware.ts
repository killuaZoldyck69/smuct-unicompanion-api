import { Request, Response, NextFunction } from "express";

interface RateLimitOptions {
  windowMs: number;
  limit: number;
  message?: string | object;
}

interface ClientRecord {
  count: number;
  resetTime: number;
}

const MAX_ENTRIES = 50000;

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
    const forwardedFor = req.headers["x-forwarded-for"];
    const ip =
      (typeof forwardedFor === "string"
        ? forwardedFor.split(",")[0].trim()
        : req.ip) ||
      req.socket.remoteAddress ||
      "unknown";

    const now = Date.now();
    const record = hits.get(ip);

    if (!record || now > record.resetTime) {
      // Memory protection: if map exceeds max entries, evict oldest or expired
      if (hits.size >= MAX_ENTRIES) {
        for (const [key, val] of hits.entries()) {
          if (now > val.resetTime || hits.size >= MAX_ENTRIES) {
            hits.delete(key);
          }
          if (hits.size < MAX_ENTRIES * 0.9) break;
        }
      }

      hits.set(ip, {
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
 * 100 requests per 15 minutes per IP address.
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100,
  message: {
    success: false,
    message:
      "Too many requests from this IP, please try again after 15 minutes.",
  },
});

/**
 * Strict Auth Rate Limiter:
 * 10 requests per 15 minutes per IP address on /api/auth endpoints.
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
