# PATCH A4: CORS Whitelist & Rate Limiting Implementation

## 1. Issue Overview
- **Finding ID**: Audit High Finding #4 (Track A — A4)
- **File**: [`src/app.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/app.ts) & [`src/middleware/rateLimit.middleware.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/middleware/rateLimit.middleware.ts)
- **Problem**:
  1. CORS previously returned `callback(null, true)` unconditionally with `credentials: true`, allowing any external website to make credentialed cross-origin requests.
  2. No rate limiting existed across the API, leaving auth endpoints vulnerable to brute force / credential stuffing attacks and general endpoints vulnerable to automated scraping / DoS.

---

## 2. Changes Applied

### A. Strict CORS Origin Whitelisting (`src/app.ts`)
Derived the allowed origins from `envConfig.FRONTEND_URL`, mobile app deep link scheme (`smuct-unicompanion://`), and `envConfig.TRUSTED_ORIGINS`:

```typescript
// src/app.ts
const parsedTrustedOrigins = envConfig.TRUSTED_ORIGINS
  ? envConfig.TRUSTED_ORIGINS.split(",").map((url) => url.trim())
  : [];

const allowedOrigins = [
  envConfig.FRONTEND_URL,
  "smuct-unicompanion://",
  ...parsedTrustedOrigins,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin header (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);
```

---

### B. Two-Tier Rate Limiting (`src/middleware/rateLimit.middleware.ts`)

Created a standardized rate-limiting middleware returning HTTP 429 along with standard headers (`Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`):

1. **Global Rate Limiter**:
   - **Target**: All API endpoints (`app.use(globalLimiter)`)
   - **Threshold**: **100 requests per 15 minutes** per IP
   - **Purpose**: Prevents server exhaustion and scraping without impacting normal mobile/web navigation.

2. **Auth Endpoint Rate Limiter**:
   - **Target**: Dedicated to `/api/auth/**` (`app.use("/api/auth", authLimiter)`)
   - **Threshold**: **10 requests per 15 minutes** per IP
   - **Purpose**: Prevents brute-forcing logins, password reset spam, and credential stuffing.

---

## 3. Rate Limiter Thresholds Summary

| Limiter | Route Match | Window (ms) | Request Limit | Action on Exceed |
|---|---|---|---|---|
| **Global Limiter** | `/*` | 15 mins (900,000 ms) | 100 reqs / IP | HTTP 429 (`"Too many requests from this IP..."`) |
| **Auth Limiter** | `/api/auth/*` | 15 mins (900,000 ms) | 10 reqs / IP | HTTP 429 (`"Too many authentication attempts..."`) |

---

## 4. Verification Results

```json
[
  {
    "test": "1. No Origin (Mobile/Curl)",
    "passed": true,
    "result": { "allowed": true, "error": null }
  },
  {
    "test": "2. Trusted Frontend Origin (http://localhost:3000)",
    "passed": true,
    "result": { "allowed": true, "error": null }
  },
  {
    "test": "3. Trusted Mobile Scheme (smuct-unicompanion://)",
    "passed": true,
    "result": { "allowed": true, "error": null }
  },
  {
    "test": "4. Untrusted Origin (https://evil-hacker-site.com)",
    "passed": true,
    "result": { "allowed": false, "error": "Not allowed by CORS" }
  },
  {
    "test": "5. Auth Rate Limiter triggers 429 on 11th attempt",
    "passed": true,
    "statusAt10th": 200,
    "statusAt11th": 429
  }
]
```
