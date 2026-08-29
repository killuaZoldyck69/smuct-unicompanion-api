# SMUCT UniCompanion API — Production Readiness Audit

> **Scope**: Full read-only audit of every file in the repository.  
> **Date**: 2026-08-24  
> **Auditor**: Antigravity AI  
> **Status**: Pre-production — do NOT deploy until findings below are resolved.

---

## 1. Current Structure

```
sumct-unicompanion-api/
├── .env                          ← Runtime secrets (committed? see §4)
├── .gitignore                    ← Lists .env — but .env IS present in workspace
├── package.json                  ← ESM project, Express 5, pnpm
├── tsconfig.json                 ← strict: true, module: ESNext, bundler resolution
├── prisma.config.ts              ← Prisma CLI config; uses DIRECT_URL for migrations
├── pnpm-lock.yaml
│
├── prisma/
│   └── schema.prisma             ← PostgreSQL schema; 20 models, 5 enums
│
├── generated/
│   └── prisma/                   ← Generated Prisma client (gitignored)
│
└── src/
    ├── server.ts                 ← Entry point; connects Prisma then starts Express
    ├── app.ts                    ← Express app: CORS → json → auth handler → routes → error handler
    │
    ├── config/
    │   └── env.ts                ← Zod-validated env schema; calls process.exit(1) on bad config ✅
    │
    ├── lib/
    │   ├── auth.ts               ← Better Auth config (email+password, bearer plugin, email verification)
    │   ├── email.ts              ← Brevo HTTP email sender (hardcoded sender address — see §4)
    │   └── prisma.ts             ← PrismaClient singleton with PrismaPg adapter
    │
    ├── middleware/
    │   ├── auth.middleware.ts    ← requireAuth: validates Bearer/cookie session via Better Auth
    │   ├── admin.middleware.ts   ← requireAdmin: checks req.user.role === "ADMIN"
    │   ├── teacher.middleware.ts ← requireTeacher: checks req.user.role === "TEACHER"
    │   ├── validateRequest.ts   ← Runs schema.parseAsync({body,query,params}) — discards result (see §3)
    │   └── globalErrorHandler.ts← Handles Zod, Prisma P2002, AppError; leaks stack in development
    │
    ├── utils/
    │   ├── AppError.ts           ← Operational error class with statusCode
    │   └── catchAsync.ts         ← Wraps async handlers; forwards errors to next()
    │
    ├── scripts/
    │   └── admin-seed.ts         ← One-time script to create the first ADMIN user (hardcoded password)
    │
    └── modules/                  ← Feature modules, each with routes / controller / service / schema
        ├── student/              ← Onboarding, profile CRUD (self-service)
        ├── teacher/              ← Admin-only registration; teacher self-service profile
        ├── user/                 ← Admin: list/delete users, assign CR/TA roles
        ├── calendar/             ← Admin creates; users get filtered calendars
        ├── bus/                  ← Admin CRUD; public read
        ├── notice/               ← Admin CRUD; public read
        ├── event/                ← Admin CRUD; public read
        ├── directory/            ← Read-only teacher directory
        ├── forum/                ← Help-post community board (CRUD + resolve)
        ├── blood/                ← Blood-donor request board (CRUD + respond)
        ├── complaint/            ← User submits; admin manages
        ├── alumni/               ← Admin-managed alumni directory
        ├── field/                ← Field booking with conflict detection
        └── hub/                  ← Course hub (main feature)
            ├── hub.routes.ts     ← Core hub CRUD + member management
            ├── hub.controller.ts
            ├── hub.service.ts    ← Contains verifyHubRole() helper used by sub-modules
            ├── hub.schema.ts
            ├── resources/        ← Hub resource (file link) upload/list
            ├── content/          ← Announcements, discussions, comments, replies
            ├── assessments/      ← Assessments, submissions, grading, bulk-grade
            └── reviews/          ← Course reviews with anonymous mode
```

---

## 2. Middleware Order

The exact registration order in [`app.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/app.ts):

| # | Line | Middleware / Handler |
|---|------|----------------------|
| 1 | 26–35 | `cors({ origin: () => true, credentials: true })` |
| 2 | 37 | **`express.json()`** ← body parser |
| 3 | 38 | `express.urlencoded({ extended: true })` |
| 4 | 40–60 | `GET /api/auth/redirect-to-app` (deep-link redirector) |
| 5 | **62** | **`app.all("/api/auth/{*any}", toNodeHandler(auth))`** ← Better Auth handler |
| 6 | 64–70 | `GET /health` |
| 7 | 72–90 | All feature route groups |
| 8 | 93 | `globalErrorHandler` |

### ⚠️ FAIL — Better Auth `toNodeHandler` is mounted AFTER body-parsing middleware

**Line 37** registers `express.json()`.  
**Line 62** registers `toNodeHandler(auth)`.

The Better Auth documentation for `toNodeHandler` explicitly warns that it **must be mounted before any body-parsing middleware** because it needs to read the raw request body itself. When `express.json()` runs first, it consumes the body stream. Better Auth then receives an already-consumed stream and cannot parse JSON payloads sent to `/api/auth/**` endpoints (sign-in, sign-up, password reset, etc.). This is a **critical bug** that will silently break all auth flows that send a JSON body.

**Fix**: Move `toNodeHandler` registration to **before** `express.json()`:

```typescript
// CORRECT order:
app.all("/api/auth/{*any}", toNodeHandler(auth)); // ← must be first
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
```

---

## 3. Validation Issues

### Architecture of `validateRequest`

[`validateRequest.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/middleware/validateRequest.ts) (lines 10–14):

```typescript
await schema.parseAsync({
  body: req.body,
  query: req.query,
  params: req.params,
});
next(); // ← parse result is thrown away
```

The middleware calls `parseAsync()` **purely for side-effects** (throwing a ZodError on invalid input). It **never writes the parsed/coerced output back** onto `req.body`, `req.query`, or `req.params`. This means:

- **Zod coercions are lost.** Any `z.preprocess`, `z.coerce`, or `z.default` transforms applied in a schema run inside `parseAsync`, but the transformed values are discarded. Controllers then receive the original raw strings/values from Express.
- **The validation protects the shape but not the type.** Fields that Zod transforms (e.g., date strings → `Date` objects) revert to their raw form when the controller reads `req.body`.

### Specific Occurrences

| File | Line(s) | Schema field with transform | What controller receives |
|------|---------|-----------------------------|--------------------------|
| [`assessments.schema.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/hub/assessments/assessments.schema.ts) | 3–10 | `deadline: datePreprocess` (string → `Date`) | Raw string from `req.body.deadline` |
| [`assessments.controller.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/hub/assessments/assessments.controller.ts) | 10 | passes `req.body` directly to service | service receives `{ ..., deadline: "2026-09-01" }` (string), not a `Date` |
| [`field.schema.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/field/field.schema.ts) | 3–10 | `bookingDate`, `startTime`, `endTime` all use `datePreprocess` | Raw strings flow into `fieldService.bookFieldService(req.body)` |
| [`field.service.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/field/field.service.ts) | 39–47 | Overlap check uses `data.bookingDate`, `data.startTime`, `data.endTime` as if they are `Date` objects | They are strings; Prisma will stringify-compare them, which is unreliable |
| [`calendar.schema.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/calendar/calendar.schema.ts) | 8–25 | `startDate`, `endDate` use `z.preprocess` → `Date` | `createCalendarService` receives raw strings |
| [`event.schema.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/event/event.schema.ts) | 8–17 | `eventDate: z.preprocess` → `Date` | Raw string passed to `createEventService` |
| [`alumni.schema.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/alumni/alumni.schema.ts) | 12 | `skills: z.array(z.string()).default([])` | If client omits `skills`, `req.body.skills` is `undefined`, not `[]` |
| [`notice.schema.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/notice/notice.schema.ts) | 10 | `copyTo: z.array(z.string()).optional().default([])` | Same: Zod default is discarded; service guards with `data.copyTo \|\| []` *(accidental workaround)* |
| [`resources.schema.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/hub/resources/resources.schema.ts) | 7 | `isStudentNote: z.boolean().default(false)` | If omitted by client, controller receives `undefined`, not `false` |
| [`reviews.schema.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/hub/reviews/reviews.schema.ts) | 14 | `isAnonymous: z.boolean().default(true)` | If omitted, `undefined` flows into Prisma — review stored with `isAnonymous: undefined` |

> **Severity**: **High** for date fields (silent data corruption / comparison failures). **Medium** for boolean defaults (unexpected `undefined` stored in DB). **Low** for array defaults (guarded by explicit `|| []` in some services).

**Fix**: `validateRequest` must assign the parsed result back to `req`:

```typescript
const parsed = await schema.parseAsync({ body: req.body, query: req.query, params: req.params });
req.body   = (parsed as any).body   ?? req.body;
req.query  = (parsed as any).query  ?? req.query;
req.params = (parsed as any).params ?? req.params;
next();
```

---

## 4. Security Issues

### 4.1 CORS — ❌ FAIL (Wildcard Allow-All)

[`app.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/app.ts) lines 26–35:

```typescript
cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // allow no-origin (curl, mobile)
    return callback(null, true);              // ← allows EVERY origin unconditionally
  },
  credentials: true,
})
```

The `origin` function returns `true` for **every request**, effectively `Access-Control-Allow-Origin: *` while simultaneously enabling `credentials: true`. This is the worst-case CORS configuration — **any website on the internet can make credentialed cross-origin requests to this API**. The `TRUSTED_ORIGINS` env var is only used by Better Auth's internal checks, not by Express CORS.

**Fix**: Use the parsed `TRUSTED_ORIGINS` list to whitelist only known origins.

### 4.2 Rate Limiting — ❌ ABSENT

There is **no rate-limiting middleware** anywhere in the application. There is no reference to `express-rate-limit`, `@fastify/rate-limit`, Nginx config, or any upstream proxy rate-limiting. This exposes the API to:
- Brute-force attacks on `/api/auth/sign-in`
- Enumeration of join codes (6-character alphanumeric — 36^6 ≈ 2.1 billion possibilities, but easily narrowed with timing)
- DoS via unbounded list endpoints (all users, all bookings, entire blood feed, entire forum)

**Fix**: Add `express-rate-limit` — at minimum a global limiter and a strict limiter on all `/api/auth/**` routes.

### 4.3 Secrets Committed to `.env` — ❌ CRITICAL

The `.env` file **is present in the repository** with real production credentials:

| Secret | Value in .env |
|--------|---------------|
| `DATABASE_URL` | Full Supabase PostgreSQL connection string with plaintext password |
| `DIRECT_URL` | Same, direct connection |
| `BETTER_AUTH_SECRET` | `h6aUaDKKnJwBR2QQq0m0ZEEZSOJAEqZv` (32 chars) |
| `SMTP_PASS` | Gmail App Password (`gladmnxwrrluseuy`) |
| `BREVO_API_KEY` | Full Brevo API key (`xkeysib-...`) |

Although `.gitignore` lists `.env`, the file **exists on disk** in the workspace root and was readable in this audit. If this repo was ever pushed to a remote (even private), these secrets must be **rotated immediately**. The `.env` pattern for local development is acceptable, but the real secret values must never enter version control.

### 4.4 Hardcoded Sender Email in `email.ts`

[`email.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/lib/email.ts) line 21:

```typescript
email: "nh694225@gmail.com",  // ← hardcoded, not from envConfig.EMAIL_FROM
```

`EMAIL_FROM` is validated in `env.ts` but never actually used in the Brevo API call. The sender is always the personal Gmail address. This is a data-quality issue (emails appear to come from a personal address rather than a service address) and a portability issue.

### 4.5 Hardcoded Credentials in Seed Script

[`admin-seed.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/scripts/admin-seed.ts) lines 7–9:

```typescript
const adminEmail    = "admin@smuct.edu.bd";
const adminPassword = "12345678";
```

A weak, hardcoded password (`12345678`) is baked into the seed script. If this script is run in production, the admin account will have a trivially brute-forceable password. These values should come from environment variables and the script should require the admin to change the password on first login.

### 4.6 IDOR Analysis — Authorization Coverage

Most endpoints are scoped to the authenticated user's own data via `req.user.id`. Here is an explicit audit of every mutable endpoint that accepts a resource ID in `req.params`:

| Route | Auth check | Verdict |
|-------|-----------|---------|
| `PATCH /api/students/profile` | Scoped to `req.user.id` | ✅ No IDOR |
| `PATCH /api/teachers/profile` | Scoped to `req.user.id` | ✅ No IDOR |
| `DELETE /api/users/:id` | `requireAdmin` | ✅ Admin-only |
| `PATCH /api/users/:id/role` | `requireAdmin` | ✅ Admin-only |
| `PATCH /api/hubs/:id` | `verifyHubRole(userId, hubId, ["TEACHER","CR"])` | ✅ Hub-scoped |
| `DELETE /api/hubs/:id` | `verifyHubRole(userId, hubId, ["TEACHER","CR"])` | ✅ |
| `PATCH /api/hubs/:id/members/:memberId/role` | `verifyHubRole` + role escalation guards | ✅ |
| `DELETE /api/hubs/:id/members/:memberId` | checks `targetMember.userId === userId` OR `verifyHubRole` | ✅ |
| `PATCH /api/hubs/:id/archive` | `verifyHubRole` | ✅ |
| `POST /api/hubs/:id/resources` | `verifyHubRole(…, ["TEACHER","CR","TA","STUDENT"])` | ✅ |
| `POST /api/hubs/:id/assessments` | `verifyHubRole(…, ["TEACHER","CR","TA"])` | ✅ |
| `POST /api/hubs/:id/assessments/:assessmentId/submit` | `verifyHubRole` | ✅ |
| `PATCH /api/hubs/:id/submissions/:submissionId/grade` | `verifyHubRole(…, ["TEACHER","TA"])` | ✅ |
| `POST /api/hubs/:id/assessments/:assessmentId/bulk-grade` | `verifyHubRole` | ✅ |
| `POST /api/hubs/:id/announcements` | `verifyHubRole(…, ["TEACHER","CR","TA"])` | ✅ |
| `POST /api/hubs/:id/discussions` | `verifyHubRole(…all roles)` | ✅ |
| `PATCH /api/hubs/:id/review-settings` | `verifyHubRole(…, ["TEACHER","CR","TA"])` | ✅ |
| `POST /api/hubs/:id/reviews` | `verifyHubRole(…, ["STUDENT","CR","TA"])` | ✅ |
| `PATCH /api/blood/:id/resolve` | `post.authorId !== userId && role !== "ADMIN"` | ✅ Ownership check |
| `DELETE /api/blood/:id` | Same | ✅ |
| `PATCH /api/forum/:id` | `post.authorId !== userId` | ✅ Ownership-only (no admin override intentionally) |
| `DELETE /api/forum/:id` | `post.authorId !== userId && role !== "ADMIN"` | ✅ |
| `PATCH /api/forum/:id/resolve` | Same | ✅ |
| `PATCH /api/complaints/:id/status` | `requireAdmin` | ✅ |
| `DELETE /api/complaints/:id` | `requireAdmin` | ✅ |
| `PATCH /api/alumni/:id` | `requireAdmin` | ✅ |
| `DELETE /api/alumni/:id` | `requireAdmin` | ✅ |
| `DELETE /api/buses/:id` | `requireAdmin` | ✅ |
| `DELETE /api/notices/:id` | `requireAdmin` | ✅ |
| `DELETE /api/events/:id` | `requireAdmin` | ✅ |
| `PATCH /api/field/bookings/:id/status` | `requireAdmin` | ✅ |
| `PATCH /api/field/settings` | `requireAdmin` | ✅ |

**Overall IDOR verdict**: ✅ No IDOR vulnerabilities found. All mutable routes are properly gated.

#### ⚠️ Partial IDOR risk: `GET /api/hubs/:id` (line 35 in hub.routes.ts)

`getHubDetails` has **no hub membership check** — it fetches any hub by ID regardless of whether the caller is a member. The response includes **all members' emails and profile IDs**. Any authenticated user who guesses a valid hub UUID can read the full member list.

```typescript
// hub.controller.ts line 34
export const getHubDetails = catchAsync(async (req: Request, res: Response) => {
  const hub = await hubService.getHubDetailsService(req.params.id as string);
  // No membership verification here
  res.status(200).json({ success: true, data: hub });
});
```

**Fix**: Add `await verifyHubRole(req.user.id, req.params.id, ["TEACHER","CR","TA","STUDENT"])` before returning hub details.

### 4.7 SQL Injection Surface

No raw SQL queries (`$queryRaw`, `$executeRaw`) were found anywhere in the codebase. All database interactions use the Prisma Client ORM, which parameterizes all values. **SQL injection surface: negligible.** ✅

### 4.8 Error Response — Stack Trace Leakage

[`globalErrorHandler.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/middleware/globalErrorHandler.ts) line 46:

```typescript
stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
```

Stack traces are suppressed in production. ✅  

However, the check reads `process.env.NODE_ENV` directly rather than the Zod-validated `envConfig.NODE_ENV`. This is minor since both should agree, but it is worth normalizing.

### 4.9 Password Sent in Plain-Text Email

[`teacher.service.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/teacher/teacher.service.ts) lines 84–86:

```typescript
<p><strong>Temporary Password:</strong> ${data.password}</p>
```

The admin-supplied plaintext password is emailed to the teacher. This is a common but high-risk pattern. If Brevo stores email content logs, or if the teacher's inbox is compromised, the password is exposed. The better pattern is to send a password-reset link instead of a cleartext password.

### 4.10 Logical Bug in `submitReview` Check

[`reviews.service.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/hub/reviews/reviews.service.ts) line 31:

```typescript
if (!hub || (!hub.isReviewOpen && !hub.isReviewOpen)) {
```

The condition `(!hub.isReviewOpen && !hub.isReviewOpen)` is identical on both sides — it checks the same flag twice. This appears to be a copy-paste error; the second operand was likely intended to check a different field. As written, the condition is logically equivalent to `!hub.isReviewOpen`, so the guard functions correctly by coincidence, but the intent is unclear and the code is wrong.

---

## 5. Coupling Issues

### 5.1 `validateRequest` Discards Parsed Output — Structural Design Flaw

Described fully in §3. The middleware is structurally coupled to `req.body` being passed raw, defeating the purpose of having a typed schema layer. Every controller that calls a service with `req.body` is implicitly coupled to unvalidated data.

### 5.2 Services Accept `data: any` — Loss of Type Safety

Multiple service functions accept `data: any` instead of the typed Zod payload:

| File | Function | Parameter type |
|------|----------|----------------|
| [`content.service.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/hub/content/content.service.ts) | `createAnnouncement` | `data: any` |
| [`content.service.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/hub/content/content.service.ts) | `createDiscussion` | `data: any` |
| [`reviews.service.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/hub/reviews/reviews.service.ts) | `updateReviewSettings`, `submitReview` | `data: any` |
| [`assessments.service.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/hub/assessments/assessments.service.ts) | `createAssessment` | `data: any` |
| [`hub.service.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/hub/hub.service.ts) | `updateMemberRoleService` | `newRole: any` |

Using `any` bypasses TypeScript's protection and allows unvalidated data to reach Prisma. Since `validateRequest` discards parsed output (§3), these `any` types currently reflect the real runtime behavior — which is the core problem.

### 5.3 Spread of `req.body` Directly into Prisma Queries

Several services use object spread directly into Prisma's `data` property:

| File | Line | Pattern |
|------|------|---------|
| [`content.service.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/hub/content/content.service.ts) | 12 | `data: { hubId, creatorId: userId, ...data }` |
| [`content.service.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/hub/content/content.service.ts) | 51 | `data: { hubId, authorId: userId, ...data }` |
| [`assessments.service.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/hub/assessments/assessments.service.ts) | 12 | `data: { hubId, creatorId: userId, ...data }` |
| [`reviews.service.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/hub/reviews/reviews.service.ts) | 50 | `data: { hubId, studentId: userId, ...data }` |

If a client sends extra fields not in the Zod schema, those fields will be spread into the Prisma call. Prisma will silently ignore unknown columns, but it is still bad practice. After fixing `validateRequest` to assign parsed output back to `req.body`, these spreads will be safe.

### 5.4 Duplicate Route Registration for Content/Assessments

In [`app.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/app.ts) lines 88–90:

```typescript
app.use("/api", contentRoutes);
app.use("/api", assessmentRoutes);
app.use("/api", reviewRoutes);
```

And in [`hub.routes.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/hub/hub.routes.ts) lines 57–59:

```typescript
router.use("/", resourceRoutes);
router.use("/", contentRoutes);
router.use("/", assessmentRoutes);
```

`contentRoutes` and `assessmentRoutes` are **mounted twice** — once at `/api` (app.ts) and once inside `/api/hubs` (hub.routes.ts). This registers all their endpoints at two separate URL prefixes simultaneously. For example, `POST /:id/announcements` is accessible at both `/api/:id/announcements` and `/api/hubs/:id/announcements`. The `/api/:id/...` paths will match before many other routes due to Express route ordering, creating potential for accidental route collisions with other modules. The `reviews.routes.ts` explicitly includes `/hubs/` in its path strings, which is inconsistent with the other sub-routes.

**Fix**: Remove the duplicate mounts from `app.ts` (lines 88–90); sub-routes should only be mounted inside `hub.routes.ts`.

### 5.5 No Repository/Data-Access Layer

All Prisma queries are written directly inside service files. There is no repository abstraction. This is acceptable for a small project but means:
- Queries are scattered across 14+ service files.
- There is no single place to add query logging, caching, or data transformation.
- If the ORM ever changes, every service file must be updated.

This is a **structural note** for future phases, not an immediate bug.

### 5.6 No Circular Dependencies Detected

The dependency graph flows cleanly: `routes → controller → service → prisma`. The one shared utility, `verifyHubRole`, is exported from `hub.service.ts` and imported by `content.service.ts`, `assessments.service.ts`, and `reviews.service.ts`. This is a mild cross-service dependency but not circular.

---

## 6. Database / Prisma Issues

### 6.1 Datasource Missing `url` Field in `schema.prisma`

[`schema.prisma`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/prisma/schema.prisma) lines 11–13:

```prisma
datasource db {
  provider = "postgresql"
  // ← no url or directUrl field!
}
```

The `url` and `directUrl` fields are missing from the schema datasource block. Prisma normally requires `url` here. The `prisma.config.ts` overrides the datasource URL for migrations, and `lib/prisma.ts` passes the connection string directly to the PrismaPg adapter — bypassing the schema-level datasource URL entirely. This works at runtime but is non-standard. Running `prisma generate` or `prisma migrate` without the `prisma.config.ts` file in scope would fail. CI pipelines that invoke Prisma CLI directly may break.

**Fix**: Add `url = env("DATABASE_URL")` and `directUrl = env("DIRECT_URL")` to the datasource block.

### 6.2 Missing Indexes on Frequently-Queried Foreign Keys

The following foreign key columns are used in `WHERE` clauses but have **no `@@index` defined**:

| Model | Column | Used in |
|-------|--------|---------|
| `StudentProfile` | `userId` | `findUnique({ where: { userId } })` in student service |
| `TeacherProfile` | `userId` | `findUnique({ where: { userId } })` in teacher service |
| `HubMember` | `userId` | `getMyHubs` — `findMany({ where: { userId } })` |
| `HubMember` | `hubId` | `getHubDetails` — loads all members for a hub |
| `HubAnnouncement` | `hubId` | `getAnnouncements` — `findMany({ where: { hubId } })` |
| `HubDiscussion` | `hubId` | `getDiscussions` — `findMany({ where: { hubId } })` |
| `Assessment` | `hubId` | `getAssessments` — `findMany({ where: { hubId } })` |
| `Submission` | `assessmentId` | `getAssessments` includes submissions |
| `Resource` | `hubId` | `getResources` — `findMany({ where: { hubId } })` |
| `HelpPost` | `authorId` | future queries |
| `BloodPost` | `authorId` | `resolveBloodPost` checks `post.authorId` |
| `BloodResponse` | `postId`, `responderId` | `findFirst` in respondToBloodPost |
| `Complaint` | `userId` | `getMyComplaints` — `findMany({ where: { userId } })` |
| `FieldBooking` | `userId` | `getMyBookings` — `findMany({ where: { userId } })` |
| `FieldBooking` | `status`, `bookingDate` | conflict check query |
| `CourseReview` | `hubId` | `getReviews` — `findMany({ where: { hubId } })` |
| `AnnouncementComment` | `announcementId` | loaded via include |
| `HubDiscussionReply` | `discussionId` | loaded via include |

**Note**: Prisma does automatically create an index on the foreign key column for unique relations (`@unique` implies an index), so `StudentProfile.userId`, `TeacherProfile.userId` which have `@unique` are indexed. But the many-to-one FK columns above (e.g., `HubMember.userId`, `HubMember.hubId`) have **no explicit index** beyond the `@@unique([userId, hubId])` composite unique. The composite unique does index the combination but **not `hubId` alone** — a query filtering only on `hubId` will do a full table scan on large datasets.

**Fix**: Add explicit `@@index` entries:

```prisma
model HubMember {
  // ...
  @@unique([userId, hubId])
  @@index([hubId])         // ← add
  @@index([userId])        // ← add
}

model Assessment {
  // ...
  @@index([hubId])         // ← add
}
// etc.
```

### 6.3 Cascade Rules — Mostly Present, One Gap

Most parent-child relationships have `onDelete: Cascade` correctly defined. However:

- `Assessment → creator` relation: `creator User @relation("CreatedAssessments", fields: [creatorId], references: [id])` — **no `onDelete` specified**, which defaults to `Restrict`. If an admin deletes a teacher user who has created assessments, the delete will **fail with a foreign key constraint error** rather than cascading or nullifying. This is probably not the desired behavior.

**Fix**: Add `onDelete: Cascade` (or `SetNull` if you want to preserve assessments) to the `Assessment.creator` relation.

### 6.4 N+1 Query Patterns

#### `getMyHubs` — Acceptable

[`hub.service.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/hub/hub.service.ts) lines 110–131: Uses nested `include` — Prisma fetches all related data in a small number of JOIN queries. ✅

#### `getAllUsersService` — Potential Issue

[`user.service.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/user/user.service.ts) lines 5–14:

```typescript
prisma.user.findMany({
  include: {
    studentProfile: true,
    teacherProfile: true,
  },
})
```

No pagination (`take`, `skip`). Returns **all users with full profiles** in a single response. As user count grows, this endpoint will become very slow and return a very large payload. Since this is admin-only it's lower priority, but pagination should be added.

#### `forum.getAllPostsService` — N+1 via nested `include`

[`forum.service.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/forum/forum.service.ts) lines 22–43 includes `studentProfile: true` and `teacherProfile: true` inside the author select. Prisma will execute additional queries per row to fetch these profiles. With a large forum, this becomes an N+1 pattern.

Similarly in `blood.service.ts` lines 40–67: `getBloodPostByIdService` includes full `studentProfile: true` and `teacherProfile: true` for author and all responders — this is acceptable for a single-record fetch.

#### `getAssessments` — Loads All Submissions

[`assessments.service.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/hub/assessments/assessments.service.ts) line 20:

```typescript
include: { submissions: true },
```

Every call to `getAssessments` loads all submissions for every assessment. In a class with 50 students and 10 assessments, this loads 500 submission records. Use `_count` for the list view and load full submissions only on a dedicated `GET /:id/submissions` endpoint.

### 6.5 `FieldBooking` Conflict Check Uses DateTime Comparison on String-Stored `startTime`/`endTime`

The `FieldBooking` model stores `startTime` and `endTime` as `DateTime` in Prisma, but the booking schema uses `datePreprocess` which (due to §3) delivers raw strings to the service. The overlap query in `field.service.ts` lines 39–47:

```typescript
startTime: { lt: data.endTime },
endTime: { gt: data.startTime },
```

If `data.endTime` and `data.startTime` are strings (because `validateRequest` discards the parsed Date), Prisma will attempt to coerce them. This may work incidentally for ISO 8601 strings, but the behavior is undefined for non-standard formats and the code relies on implicit coercion.

---

## 7. File Structure Recommendation

The current structure is already module-based and better than many projects. The recommended target structure below adds explicit layers for DTOs and repositories, and reorganizes the hub sub-modules to make the nesting clearer.

```
src/
├── server.ts
├── app.ts
│
├── config/
│   └── env.ts
│
├── lib/
│   ├── auth.ts
│   ├── email.ts
│   └── prisma.ts
│
├── middleware/
│   ├── auth.middleware.ts
│   ├── admin.middleware.ts
│   ├── teacher.middleware.ts
│   ├── validateRequest.ts          ← FIX: assign parsed output back to req
│   └── globalErrorHandler.ts
│
├── utils/
│   ├── AppError.ts
│   └── catchAsync.ts
│
├── types/
│   └── express.d.ts                ← Move the req.user declaration here
│
└── modules/
    └── <module>/
        ├── <module>.routes.ts      ← Only routing: middleware stack + handler ref
        ├── <module>.controller.ts  ← HTTP layer: extract from req, call service, send res
        ├── <module>.service.ts     ← Business logic: orchestrates repository calls
        ├── <module>.repository.ts  ← NEW: all Prisma queries live here, not in service
        └── <module>.schema.ts      ← Zod schemas + inferred TS types (DTOs)
```

### Key migration principles for later phases

1. **`validateRequest.ts`** — fix first (§3). Everything else depends on this.
2. **Repository layer** — extract all `prisma.*` calls from service files into `*.repository.ts` files. Services import repositories, not Prisma directly.
3. **Hub sub-modules** — remove duplicate mounts from `app.ts`; mount only inside `hub.routes.ts`. Rename `contentRoutes`, `assessmentRoutes`, `reviewRoutes` to reflect they are sub-routes.
4. **Shared schemas** — the `BloodGroup` enum is duplicated between the Prisma schema and multiple Zod schemas. Create a `src/constants/enums.ts` that exports shared enum arrays derived from the Prisma generated types.
5. **Pagination** — add `take`/`skip` (or cursor pagination) to all list endpoints before launch.
6. **Rate limiting** — add `express-rate-limit` as a global middleware in `app.ts` and a stricter limiter on `/api/auth/**`.
7. **CORS** — replace the allow-all origin function with a whitelist derived from `TRUSTED_ORIGINS`.

---

## Summary of Critical Findings

| # | Severity | Finding | File |
|---|----------|---------|------|
| 1 | 🔴 CRITICAL | `express.json()` runs before `toNodeHandler(auth)`, breaking all auth JSON payloads | `app.ts:37,62` |
| 2 | 🔴 CRITICAL | Production secrets committed in `.env` — rotate immediately | `.env` |
| 3 | 🔴 HIGH | `validateRequest` discards Zod parse result — coercions/defaults lost, raw data used by all controllers | `validateRequest.ts:10–15` |
| 4 | 🔴 HIGH | CORS allows all origins with `credentials: true` | `app.ts:26–35` |
| 5 | 🟠 HIGH | No rate limiting on any endpoint | Global |
| 6 | 🟠 HIGH | `GET /api/hubs/:id` has no membership check — any authenticated user reads any hub's member list | `hub.controller.ts:34` |
| 7 | 🟠 HIGH | Content, assessment sub-routes double-mounted at both `/api` and `/api/hubs` | `app.ts:88–90`, `hub.routes.ts:57–59` |
| 8 | 🟡 MEDIUM | Date/datetime coercions silently broken (field booking conflict check, assessment deadlines) | `field.service.ts`, `assessments.service.ts` |
| 9 | 🟡 MEDIUM | Teacher's plaintext password sent in welcome email | `teacher.service.ts:85` |
| 10 | 🟡 MEDIUM | `Assessment.creator` relation lacks `onDelete` — teacher deletion will fail FK constraint | `schema.prisma:307` |
| 11 | 🟡 MEDIUM | Missing DB indexes on hub FK columns — full table scans at scale | `schema.prisma` |
| 12 | 🟡 MEDIUM | `getAssessments` loads all submissions inline — O(n) payload growth | `assessments.service.ts:20` |
| 13 | 🟡 MEDIUM | Hardcoded admin password `12345678` in seed script | `admin-seed.ts:8` |
| 14 | 🟡 MEDIUM | `submitReview` has a tautological condition (`!hub.isReviewOpen && !hub.isReviewOpen`) | `reviews.service.ts:31` |
| 15 | 🟢 LOW | Hardcoded sender email — `EMAIL_FROM` env var unused | `email.ts:21` |
| 16 | 🟢 LOW | `datasource db` missing `url`/`directUrl` in schema — non-standard Prisma setup | `schema.prisma:11–13` |
| 17 | 🟢 LOW | `getAllUsersService` has no pagination — unbounded response | `user.service.ts:5` |
| 18 | 🟢 LOW | Multiple services accept `data: any` — bypasses TypeScript protection | Various service files |
