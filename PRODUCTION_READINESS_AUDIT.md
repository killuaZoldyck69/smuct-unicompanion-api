# Production-Readiness Audit Report: SMUCT UniCompanion API

---

## Executive Summary

The SMUCT UniCompanion backend demonstrates solid architectural intent, featuring a clean modular domain layout, TypeScript typing, and declarative schema models. However, the application is **not currently production-ready** for 700–1,000 concurrent users on free-tier infrastructure. The audit identified critical authorization bypasses (IDOR) and memory exhaustion vectors alongside architectural assumptions that conflict directly with Render and Supabase free-tier limits. The three most urgent issues requiring immediate intervention are:
1. **Arbitrary Cloudinary Asset Deletion (IDOR):** Any authenticated student can delete any other user's images and attachments via `POST /api/upload/delete` due to missing ownership validation.
2. **Instant Container Crash via Multer Memory Buffering:** File uploads buffer up to 375 MB in Node.js RAM against Render's 512 MB container ceiling, enabling single or concurrent uploads to trigger instant Out-Of-Memory (OOM) crashes.
3. **Database & Notification Storms:** User creation of forum posts or marketplace listings triggers synchronous broadcast notifications to every user in the database, writing thousands of records into Supabase's 500 MB quota and rapidly exhausting Brevo's 300 email/day limit.

---

## Project Structure

```
sumct-unicompanion-api/
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── prisma.config.ts
├── tsconfig.json
├── .env (untracked)
├── .gitignore
├── prisma/
│   ├── add_updatedAt.sql
│   ├── migrations/                     # 19 migration revisions (PostgreSQL)
│   └── schema/
│       ├── academic.prisma             # Academic calendars & calendar events
│       ├── auth.prisma                 # Better-Auth, User, Session, Student/Teacher profiles
│       ├── community.prisma            # Forum (HelpPost/HelpResponse), Blood donation
│       ├── hub.prisma                  # CourseHub, HubMember, Assessments, Submissions, Resources
│       ├── lost_found.prisma           # Lost & found items and claims
│       ├── main.prisma                 # Generator & Datasource configuration
│       ├── marketplace.prisma          # Marketplace posts and comments
│       ├── meme.prisma                 # Memes and reactions
│       ├── notice.prisma               # Campus notices and events
│       └── services.prisma             # Complaints, Field bookings, Notifications, Push tokens, Bus, Alumni
├── scripts/
│   ├── add_notice_category.mjs
│   └── check_marketplace.ts
└── src/
    ├── app.ts                          # Express application assembly, CORS, Rate limiters, Route mounting
    ├── server.ts                       # Server bootstrap, DB connection, Scheduler startup, Graceful shutdown
    ├── config/
    │   └── env.ts                      # Zod-validated environment configuration
    ├── constants/
    │   └── enums.ts                    # Application-wide domain enums
    ├── lib/
    │   ├── auth.ts                     # Better-Auth initialization & plugin configuration
    │   ├── auth-hooks.ts               # Better-Auth pre-execution security hooks
    │   ├── cache.ts                    # In-memory TTL caching engine
    │   ├── cloudinary.ts               # Cloudinary upload, delete, URL builder
    │   ├── email.ts                    # Brevo API email dispatcher
    │   └── prisma.ts                   # PrismaClient & @prisma/adapter-pg instance
    ├── middleware/
    │   ├── admin.middleware.ts         # Admin role guard alias
    │   ├── auth.middleware.ts          # Better-Auth session verification middleware
    │   ├── globalErrorHandler.ts       # Centralized error handler & response formatter
    │   ├── rateLimit.middleware.ts     # In-memory IP rate limiters (Global, Auth, OTP)
    │   ├── role.middleware.ts          # Role-based access control guards (Admin, Teacher, Student)
    │   ├── teacher.middleware.ts       # Teacher role guard alias
    │   ├── upload.middleware.ts        # Multer in-memory upload configurations
    │   └── validateRequest.ts          # Zod schema validation middleware for body/query/params
    ├── modules/
    │   ├── admin/                      # Dashboard stats, System diagnostics, Course hub admin
    │   ├── alumni/                     # Alumni directory, Search, Bulk imports
    │   ├── blood/                      # Blood request feed, Donor matching, Response management
    │   ├── bus/                        # Bus schedules and route listings
    │   ├── calendar/                   # Academic calendars, CSV import/export, Target audience filter
    │   ├── complaint/                  # Anonymous/identified complaints, Lifecycle transitions
    │   ├── directory/                  # Teacher and department directories
    │   ├── event/                      # Campus events, RSVP/Interested tracking
    │   ├── field/                      # University field bookings and time slot management
    │   ├── forum/                      # Student discussion feed, HTML sanitization, Thread resolution
    │   ├── hub/                        # Course Hub ecosystem
    │   │   ├── assessments/            # Coursework, Online/hand submissions, Grading
    │   │   ├── content/                # Announcements, Class comments, Hub discussions
    │   │   ├── members/                # Membership management, CR assignment
    │   │   ├── resources/              # Lecture materials, Google Drive vault links
    │   │   ├── reviews/                # Anonymous course evaluations & rating aggregates
    │   │   └── hub-attachments.ts      # Cloudinary attachment assertion helpers
    │   ├── lost-found/                 # Lost/Found posts, Claims verification, Handover flow
    │   ├── marketplace/                # Student buy/sell listings and comment discussions
    │   ├── meme/                       # Campus meme feed, Upvote/downvote reaction tracking
    │   ├── notice/                     # Administrative noticeboard
    │   ├── notification/               # In-app notification creation and inbox retrieval
    │   ├── student/                    # Student onboarding, Profile updates
    │   ├── teacher/                    # Teacher registrations, Designation, Consultation slots
    │   ├── upload/                     # Media upload endpoints & Cloudinary deletion
    │   └── user/                       # User management, Account restrictions, Drive status
    ├── services/
    │   ├── academic-reminder.service.ts # 60s cron: Upcoming class & event notification passes
    │   ├── auth-email.service.ts       # Verification OTP and Teacher welcome email templates
    │   ├── cleanup.service.ts          # 1h / 24h cron: Stale account & Cloudinary orphan purges
    │   ├── orphan-cleanup.service.ts   # Orphaned asset scanner for Marketplace & Lost-Found
    │   └── push-notification.service.ts# Expo server SDK push notification batch dispatcher
    └── utils/
        ├── AppError.ts                 # Operational error subclass with HTTP status codes
        ├── catchAsync.ts               # Async controller wrapper for centralized error bubbling
        ├── password-validator.ts       # Institutional password complexity rules
        └── qualification-order.ts      # Faculty degree hierarchy sorting logic
```

---

## Findings

### Critical Severity

#### Finding 1: Arbitrary File Deletion via Broken Access Control (IDOR)
- **Severity:** Critical
- **Category:** SECURITY
- **Location:** `src/modules/upload/upload.controller.ts:115-128` (`deleteUploadedFile`)
- **Issue:** The deletion controller only checks whether the targeted Cloudinary asset resides in the root namespace (`PROJECT_ROOT_FOLDER`) and is not inside three protected admin directories (`notices`, `calendars`, `buses`). It never verifies that the requesting user owns the uploaded file or the record linking to it.
- **Why it matters:** Any authenticated student can delete profile pictures, meme images, marketplace product photos, or lost-and-found claim proof documents belonging to any student or faculty member by supplying the target URL or public ID.
- **Suggested direction:** Map Cloudinary public IDs to database records and verify that `req.user.id` matches the asset's uploader or owner before invoking Cloudinary destruction APIs.

---

#### Finding 2: Unauthenticated Account Deletion via Public Registration Pre-Hook
- **Severity:** Critical
- **Category:** SECURITY
- **Location:** `src/lib/auth-hooks.ts:42-59` (`handleSignUpSecurity`)
- **Issue:** When handling `POST /api/auth/sign-up/email`, the hook locates any existing user with that email. If the account lacks a completed `studentProfile` or `teacherProfile` and is not restricted, it unconditionally deletes the existing database user record to purge "abandoned" registrations.
- **Why it matters:** An unauthenticated attacker can delete the account of any legitimate student who has verified their email but has not yet finalized their profile onboarding, simply by submitting a registration request with the victim's email address.
- **Suggested direction:** Check `emailVerified` and check a strict expiry timestamp on the verification record; never delete accounts with verified emails or active onboarding sessions based on an unauthenticated registration call.

---

#### Finding 3: Container OOM Crash via Unbounded Multer Memory Storage
- **Severity:** Critical
- **Category:** SCALABILITY FOR 700-1000 USERS ON FREE TIER
- **Location:** `src/modules/upload/upload.routes.ts:14-20` & `src/middleware/upload.middleware.ts:6-12`
- **Issue:** Multer stores uploads in `memoryStorage()`, configured with limits of 25 MB per file and up to 15 files per request on the `/files` endpoint (up to 375 MB of buffer in RAM).
- **Why it matters:** Render free-tier containers have a strict 512 MB total RAM ceiling. Just one or two simultaneous multi-file uploads will exhaust available heap space, triggering an immediate OS `SIGKILL` (OOM crash) that drops all concurrent user connections.
- **Suggested direction:** Lower upload limits to reasonable thresholds (e.g., max 5 MB per file, max 3 files) and pipe incoming multipart streams directly to Cloudinary or disk rather than buffering full files in Node.js process memory.

---

#### Finding 4: Trivial Rate Limit Bypass via Client-Controlled Header
- **Severity:** Critical
- **Category:** SECURITY
- **Location:** `src/middleware/rateLimit.middleware.ts:34-40` (`rateLimit`)
- **Issue:** The custom rate limiter extracts the client IP address by directly reading `req.headers["x-forwarded-for"]` and splitting on the first comma, without configuring Express proxy trust settings.
- **Why it matters:** Any attacker or automated script can bypass auth, OTP, and global rate limits by rotating arbitrary values in the `X-Forwarded-For` request header, rendering brute-force and email spam protections completely ineffective.
- **Suggested direction:** Configure `app.set("trust proxy", 1)` in Express and extract the sanitized IP address exclusively through Express's trusted `req.ip`.

---

#### Finding 5: Broadcast Notification Storm on Forum and Marketplace Posts
- **Severity:** Critical
- **Category:** SCALABILITY FOR 700-1000 USERS ON FREE TIER
- **Location:** `src/modules/forum/forum.service.ts:32-38` & `src/modules/marketplace/marketplace.service.ts:65-71`
- **Issue:** Creating a single forum post or marketplace listing triggers `createNotificationsForAllUsers`, which queries every user ID in the system, performs an awaited bulk insert of 700–1,000 notification records, and fires bulk push notifications inside the client request path.
- **Why it matters:** Ten posts create 10,000 database rows, rapidly filling Supabase's 500 MB free database quota while creating high latency on post creation and spamming the entire student body with unsolicited push alerts.
- **Suggested direction:** Replace universal broadcasts with opt-in topic subscriptions or campus feed aggregations, and process notifications asynchronously outside the request-response lifecycle.

---

### High Severity

#### Finding 6: Missing Course Hub Access Control (Materials, Announcements, Reviews)
- **Severity:** High
- **Category:** SECURITY
- **Location:** `src/modules/hub/resources/resources.service.ts:44-49`, `src/modules/hub/content/content.service.ts:95-100, 139-142`, `src/modules/hub/reviews/reviews.service.ts:115-184`
- **Issue:** Handlers for fetching hub resources (`/api/hubs/:id/resources`), announcements (`/api/hubs/:id/announcements`), discussions (`/api/hubs/:id/discussions`), and reviews (`/api/hubs/:id/reviews`) omit membership verification against the requesting user.
- **Why it matters:** Any authenticated user can read private course materials, external Google Drive links, class discussions, and sensitive anonymous teacher evaluations for any course hub in the university simply by knowing its UUID.
- **Suggested direction:** Execute `verifyHubRole(userId, hubId, ["TEACHER", "CR", "STUDENT", "ADMIN"])` across all hub sub-resource retrieval services before returning records.

---

#### Finding 7: Privilege Escalation: Class Representatives Can Delete Hubs and Coursework
- **Severity:** High
- **Category:** SECURITY
- **Location:** `src/modules/hub/hub.service.ts:224-229` (`deleteHubService`) & `src/modules/hub/assessments/assessments.service.ts:366-375` (`deleteAssessment`)
- **Issue:** `deleteHubService` authorizes `["TEACHER", "CR", "ADMIN"]` to delete entire course hubs, and `deleteAssessment` authorizes `["TEACHER", "CR"]` to delete assessments.
- **Why it matters:** A student who is appointed as a Class Representative (CR) has the authority to permanently delete a course hub or destroy teacher-created assignments, quizzes, and student submissions.
- **Suggested direction:** Limit course hub deletion to system Administrators (or the assigned faculty instructor) and restrict coursework deletion exclusively to the teacher who created it or an Admin.

---

#### Finding 8: Campus-Wide DoS from IP-Based Rate Limiting Behind University NAT
- **Severity:** High
- **Category:** SECURITY
- **Location:** `src/middleware/rateLimit.middleware.ts:105-113` (`globalLimiter`)
- **Issue:** The global rate limiter restricts requests to 100 requests per 20 minutes strictly per IP address.
- **Why it matters:** On university Wi-Fi, hundreds of active students share a single public IP address through NAT. Since the mobile app issues 8–10 requests on launch, 2–3 active users will consume the entire 100-request quota, resulting in 429 Too Many Requests errors across the entire campus.
- **Suggested direction:** Apply rate limits to authenticated requests based on `req.user.id` instead of IP, and raise the unauthenticated per-IP threshold to accommodate institutional proxy setups.

---

#### Finding 9: Outdated Core Dependencies with Publicly Disclosed Vulnerabilities
- **Severity:** High
- **Category:** SECURITY
- **Location:** `package.json:38` (`better-auth`) & `package.json:43` (`express`)
- **Issue:** Package audit reports 34 vulnerabilities, including Critical advisories for `better-auth` (`v1.6.18` installed; patched in `>=1.7.7`) involving OAuth state manipulation, session leakage, and proxy-addr IP spoofing.
- **Why it matters:** Known, publicly documented vulnerabilities in core authentication dependencies introduce session hijacking and authentication bypass risks.
- **Suggested direction:** Upgrade `better-auth` to `>=1.7.7` and run `pnpm audit --fix` to patch vulnerable nested dependencies.

---

#### Finding 10: Silent Failure and Lockout on Brevo Free-Tier Daily Quota Exhaustion
- **Severity:** High
- **Category:** PUSH NOTIFICATIONS & EMAIL (BREVO)
- **Location:** `src/lib/email.ts:33-47` & `src/services/auth-email.service.ts:124-136`
- **Issue:** Brevo free tier caps delivery at 300 emails/day. When the API returns an error or quota exhaustion occurs, `sendEmail` returns `false`, but calling auth functions ignore this return value and do not throw.
- **Why it matters:** With 700–1,000 active students, the 300 email quota will deplete quickly during signup periods or exam deadlines. When exhausted, users requesting OTPs receive false success messages on the client while the OTP is never sent, leaving them unable to complete authentication.
- **Suggested direction:** Throw an `AppError` when email dispatch fails so the client is notified, and implement quota alerts or an alternative email delivery fallback.

---

#### Finding 11: In-Process Schedulers Terminated by Render Inactivity Spin-Down
- **Severity:** High
- **Category:** SCALABILITY FOR 700-1000 USERS ON FREE TIER
- **Location:** `src/server.ts:17-18`, `src/services/cleanup.service.ts:87-147`, `src/services/academic-reminder.service.ts:112-128`
- **Issue:** Academic reminders and orphan cleanups rely on Node.js `setInterval` timers running inside the web process. Render free-tier instances sleep after 15 minutes of inactivity.
- **Why it matters:** When the instance sleeps, all interval timers stop executing. If the container wakes up hours later on a new HTTP request, it evaluates only the upcoming 15-minute window; all intervening class, exam, and event notifications are permanently lost.
- **Suggested direction:** Decouple periodic jobs from the Node runtime by triggering them via external scheduled webhooks (e.g., cron-job.org or GitHub Actions) into an authenticated API endpoint.

---

#### Finding 12: Missing Database Indexes on Frequent Query Filters
- **Severity:** High
- **Category:** DATABASE & QUERY PERFORMANCE
- **Location:** `prisma/schema/auth.prisma:26-38`, `prisma/schema/hub.prisma:26-40`, `prisma/schema/academic.prisma:27-44`
- **Issue:** High-frequency query columns lack database indexes: `User.role`, `User.bloodGroup`, `User.isRestricted`, `User.emailVerified`, `StudentProfile.department`, `StudentProfile.isCR`, `CourseHub.isArchived`, `CourseHub.department`, and `AcademicCalendar.status`.
- **Why it matters:** Donor matching by blood group, directory filtering by department, and the 60-second academic reminder scheduler all trigger full sequential scans on PostgreSQL, spiking database CPU and latency on Supabase free tier.
- **Suggested direction:** Add explicit `@@index` annotations across all frequently filtered, searched, and joined columns in the Prisma schema files.

---

### Medium Severity

#### Finding 13: Internal Database and Server Errors Leaked in API Responses
- **Severity:** Medium
- **Category:** INPUT & TYPE VALIDATION
- **Location:** `src/middleware/globalErrorHandler.ts:13-14, 53-58`
- **Issue:** For errors other than Zod validation, Prisma duplicate constraints, or `AppError`, the global handler falls back to `message = err.message || "Internal Server Error"`. While `stack` is hidden in production, `message` is returned to the client as-is.
- **Why it matters:** Uncaught PostgreSQL exceptions, query syntax errors, and database connection strings can be exposed in client response bodies, leaking schema and infrastructure details.
- **Suggested direction:** Return a generic `"Internal Server Error"` message for unhandled 500 errors when `NODE_ENV === "production"`.

---

#### Finding 14: User Account Existence Enumeration in Auth Flows
- **Severity:** Medium
- **Category:** SECURITY
- **Location:** `src/lib/auth-hooks.ts:107-111, 151-161`
- **Issue:** Authentication pre-hooks return distinct error messages based on whether an account exists and its verification status (e.g., `"No account found with this email address"` vs. `"This email address is already verified"`).
- **Why it matters:** Attackers can brute-force or scrape university student and teacher email lists to identify valid registered users and restricted accounts.
- **Suggested direction:** Return uniform responses on password reset and OTP request endpoints regardless of whether the email address exists in the system.

---

#### Finding 15: Vulnerable Custom Regex HTML Sanitizer in Forum
- **Severity:** Medium
- **Category:** SECURITY
- **Location:** `src/modules/forum/forum.sanitizer.ts:25-92` (`sanitizeForumHtml`)
- **Issue:** The forum module uses custom regular expressions (`DANGEROUS_BLOCK_TAGS_REGEX`, `EVENT_HANDLER_REGEX`) to strip unsafe HTML tags and attributes rather than an established parser.
- **Why it matters:** Regex-based HTML sanitizers are prone to parser-differential bypasses and ReDoS (Regular Expression Denial of Service) when presented with crafted or nested payloads.
- **Suggested direction:** Replace the custom regex implementation with a proven HTML sanitization package like `sanitize-html` or `dompurify`.

---

#### Finding 16: Missing Zod Request Validation on Several Query and Param Routes
- **Severity:** Medium
- **Category:** INPUT & TYPE VALIDATION
- **Location:** `src/modules/alumni/alumni.routes.ts:23`, `src/modules/marketplace/marketplace.routes.ts:32`, `src/modules/hub/resources/resources.routes.ts:20-21`, `src/modules/hub/content/content.routes.ts:51-54, 63-67`
- **Issue:** Several route handlers accept query parameters or route parameters without a `validateRequest` middleware, letting untyped or malformed parameters reach controller and service functions.
- **Why it matters:** Missing validation allows arbitrary query parameters, negative pagination limits, or malformed IDs to bypass type checks and trigger unhandled runtime or database errors.
- **Suggested direction:** Add comprehensive Zod schemas covering `params` and `query` to all route declarations using `validateRequest`.

---

#### Finding 17: Foreign Key Deletion Failure on Submissions Graded by Faculty
- **Severity:** Medium
- **Category:** DATABASE & QUERY PERFORMANCE
- **Location:** `prisma/schema/hub.prisma:187` (`Submission`)
- **Issue:** The `gradedBy` relation on `Submission` references `User` without specifying an `onDelete` policy, defaulting to `RESTRICT` in PostgreSQL.
- **Why it matters:** Attempting to delete a faculty user who has graded student assignments or exam submissions will fail with a database foreign key constraint violation.
- **Suggested direction:** Add `onDelete: SetNull` to the `gradedBy` relation on `Submission`.

---

#### Finding 18: Unbounded Queries on Calendars and Course Discussions
- **Severity:** Medium
- **Category:** NETWORK EFFICIENCY
- **Location:** `src/modules/calendar/calendar.repository.ts:39-52, 271-284` & `src/modules/hub/content/content.repository.ts:252-264`
- **Issue:** `findAllCalendarsAdmin`, `findActiveCalendarsFiltered`, and `findDiscussionsByHubId` load all matching records and nested children without `take` or `skip` parameters.
- **Why it matters:** As historical terms and discussions accumulate, response sizes expand significantly, driving up database transfer costs and mobile bandwidth consumption.
- **Suggested direction:** Introduce limit and offset pagination parameters to calendar queries and course hub discussion feeds.

---

#### Finding 19: Excessive Over-Fetching in User Hub Memberships Query
- **Severity:** Medium
- **Category:** NETWORK EFFICIENCY
- **Location:** `src/modules/hub/hub.repository.ts:238-273` (`findMyHubMemberships`)
- **Issue:** The query fetching a user's course hubs loads teacher profiles, active assessments, deadlines, and active class notices with full author objects in a single deeply nested graph.
- **Why it matters:** The home screen hub list downloads large quantities of relational metadata before the student has navigated into a specific course, causing slower load times on mobile connections.
- **Suggested direction:** Use a targeted Prisma `select` for the hub index view, loading notices and assessments on-demand when a course hub is selected.

---

#### Finding 20: Missing Unique Constraint on Alumni Database Table
- **Severity:** Medium
- **Category:** DATABASE & QUERY PERFORMANCE
- **Location:** `prisma/schema/services.prisma:128-152` & `src/modules/alumni/alumni.service.ts:90-116`
- **Issue:** The `Alumni` table has non-unique indexes on `studentId` and `email` rather than unique constraints, relying entirely on application-level pre-checks.
- **Why it matters:** Concurrent requests or bulk CSV imports can race past application-level checks, introducing duplicate alumni profiles into the database.
- **Suggested direction:** Add `@unique` constraints to `studentId` and `email` on the `Alumni` Prisma model.

---

#### Finding 21: PII and Credential Logging in Server Console Output
- **Severity:** Medium
- **Category:** LOGGING & OBSERVABILITY
- **Location:** `src/lib/email.ts:35-39`, `src/services/auth-email.service.ts:120`, `src/middleware/globalErrorHandler.ts:22-25`
- **Issue:** Logging statements output raw email addresses in plaintext, while the global error handler prints raw Zod validation issues containing request payloads.
- **Why it matters:** Student emails and sensitive form fields are persisted to application log drains, creating data privacy concerns and compliance risks.
- **Suggested direction:** Mask email addresses in log outputs and sanitize validation error log objects before printing them to the console.

---

#### Finding 22: Health Check Lacks Database Connectivity Verification
- **Severity:** Medium
- **Category:** LOGGING & OBSERVABILITY
- **Location:** `src/app.ts:97-103` (`/health`)
- **Issue:** The `/health` endpoint responds with a static JSON object without executing a query against PostgreSQL or checking connection pool status.
- **Why it matters:** If the Supabase database connection pool is exhausted or down, uptime monitors and load balancers will continue reporting the service as healthy.
- **Suggested direction:** Add an active database ping (such as `await prisma.$queryRaw`SELECT 1``) inside the `/health` handler.

---

### Low Severity

#### Finding 23: Dead Nodemailer Dependency and Unused Strict SMTP Config
- **Severity:** Low
- **Category:** ARCHITECTURE & CODE QUALITY
- **Location:** `package.json:46` & `src/config/env.ts:31-36`
- **Issue:** `nodemailer` is listed in `package.json` and `env.ts` requires strict SMTP configuration (`SMTP_PASS` min 16 chars), but all emails are dispatched via the Brevo REST API using `fetch`.
- **Why it matters:** Unused dependencies bloat the deployment bundle and cause deployment startup failures if dummy SMTP credentials are not supplied.
- **Suggested direction:** Remove `nodemailer` and drop the unused SMTP fields from the Zod environment schema.

---

#### Finding 24: Redundant Password Hashing Packages
- **Severity:** Low
- **Category:** ARCHITECTURE & CODE QUALITY
- **Location:** `package.json:36-37`
- **Issue:** Both native `bcrypt` (`^6.0.0`) and pure-JavaScript `bcryptjs` (`^3.0.3`) are installed in production dependencies.
- **Why it matters:** Redundant packages increase install time and introduce ambiguity regarding which hashing algorithm implementation is being used.
- **Suggested direction:** Standardize on a single hashing library and remove the redundant dependency.

---

### Nitpick Severity

#### Finding 25: Single-Line Re-Export Proxy Middlewares
- **Severity:** Nitpick
- **Category:** ARCHITECTURE & CODE QUALITY
- **Location:** `src/middleware/admin.middleware.ts:1` & `src/middleware/teacher.middleware.ts:1`
- **Issue:** These files only re-export `requireAdmin` and `requireTeacher` from `role.middleware.ts`.
- **Why it matters:** Creates unnecessary file indirection and fragmented imports across route modules.
- **Suggested direction:** Import role middlewares directly from `role.middleware.ts` and eliminate the single-line alias files.

---

#### Finding 26: Confusing Action Description in User Deletion Handler
- **Severity:** Nitpick
- **Category:** ARCHITECTURE & CODE QUALITY
- **Location:** `src/modules/user/user.controller.ts:59-70` (`deleteUser`)
- **Issue:** The `deleteUser` controller method calls `deleteUserService`, which sets `isRestricted: true` rather than deleting the user, returning `"User account has been restricted successfully."`
- **Why it matters:** The endpoint name `DELETE /api/users/:id` conflicts with its actual behavior of account suspension.
- **Suggested direction:** Align the route naming and HTTP method with the underlying restriction logic (e.g., `PATCH /api/users/:id/restrict`).

---

## Free-Tier Risk Summary

Operating a university companion app targeting **700–1,000 concurrent users** on **Render Free** and **Supabase Free** introduces specific infrastructure risks:

1. **Supabase Free Connection Pool Starvation:**
   - Supabase free-tier PostgreSQL allows ~15–20 direct connections.
   - Every authenticated request executes `auth.api.getSession`, which directly queries the `session` table before route logic begins.
   - Combined with multi-query transaction blocks (`prisma.$transaction`) and unindexed sequential table scans, concurrent request spikes will exhaust the pool, throwing connection timeouts (`P2024`) across the application.

2. **Render Free Container RAM Exhaustion (OOM):**
   - Render free tier limits containers to **512 MB RAM**.
   - Multer's current memory storage configuration allows uploads up to 375 MB in RAM. Concurrent image uploads will immediately exceed the 512 MB limit, triggering process crashes and service outages.

3. **In-Process State Loss from Render Spin-Downs:**
   - Render free instances spin down after 15 minutes of inactivity.
   - When the instance sleeps, in-process rate limits (`hits` map) and memory caches (`MemoryCache`) are wiped.
   - More critically, in-process schedulers (`setInterval`) stop running entirely while the container is asleep, causing scheduled class and exam reminders to be missed.
   - The first request after a spin-down experiences a **50–90 second cold start**, which will cause HTTP client timeouts on mobile devices.

4. **Brevo Free Daily Email Exhaustion:**
   - Brevo free tier enforces a strict limit of **300 emails per day**.
   - With 700–1,000 users, routine onboarding, password resets, and automated notification emails will deplete the 300-email budget early in the day, locking subsequent users out of authentication flows.
