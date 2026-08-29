# PATCH A6: Batch Security & Logic Bug Fixes

## 1. Issue Overview
- **Finding ID**: Audit Medium Finding #6 (Track A — A6)
- **Target Project**: `sumct-unicompanion-api`
- **Scope**: Hardcoded email sender, hardcoded admin seed credentials, plaintext temporary passwords sent in emails, duplicate review condition check, and unnormalized environment variable access in the global error handler.

---

## 2. Detailed Fixes Applied

### 1. Dynamic Sender Address in Email Utility
- **File**: [`src/lib/email.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/lib/email.ts)
- Replaced hardcoded personal email with the validated `envConfig.EMAIL_FROM`:
  ```typescript
  sender: {
    name: "SMUCT UniCompanion",
    email: envConfig.EMAIL_FROM,
  }
  ```

---

### 2. Secure Admin Seed Script
- **File**: [`src/scripts/admin-seed.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/scripts/admin-seed.ts)
- Removed hardcoded default credentials (`admin@smuct.edu.bd` / `12345678`).
- Reads `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` from environment variables, throwing an explicit error if they are missing or if the password is shorter than 8 characters.
- *Note on `mustChangePassword`*: The current Prisma `User` schema does not define a `mustChangePassword` column. Adding this flag would require a database schema migration; this has been flagged for future schema maintenance.

---

### 3. Password Reset Flow for New Faculty Accounts
- **File**: [`src/modules/teacher/teacher.service.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/teacher/teacher.service.ts)
- Eliminated plaintext password transmission in the teacher welcome email.
- Triggers Better Auth's password reset flow (`auth.api.forgetPassword(...)`), delivering a secure password setup link directly to the teacher's verified email address.

---

### 4. Simplified Hub Review Availability Check
- **File**: [`src/modules/hub/reviews/reviews.service.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/hub/reviews/reviews.service.ts)
- Simplified the copy-paste redundant condition `(!hub.isReviewOpen && !hub.isReviewOpen)` to `(!hub || !hub.isReviewOpen)`.
- *Context*: Surrounding schema and comments confirm this was a duplicate check from a previous schema field refactor.

---

### 5. Normalized Environment Access in Global Error Handler
- **File**: [`src/middleware/globalErrorHandler.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/middleware/globalErrorHandler.ts)
- Replaced direct `process.env.NODE_ENV` with the typed and Zod-validated `envConfig.NODE_ENV` to determine whether to include the error stack trace in the API response.

---

## 3. Verification Results
```json
[
  { "test": "1. Email sender uses envConfig.EMAIL_FROM", "passed": true },
  { "test": "2. Admin seed env validation", "passed": true },
  { "test": "3. Simplified hub review check", "passed": true },
  { "test": "4. Global error handler respects envConfig.NODE_ENV", "passed": true }
]
```
