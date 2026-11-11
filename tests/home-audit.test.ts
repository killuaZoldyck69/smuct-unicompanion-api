import test from "node:test";
import assert from "node:assert/strict";

// Populate safe defaults before importing modules that parse envConfig at module load
process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/testdb";
process.env.DIRECT_URL ??= "postgresql://user:pass@localhost:5432/testdb";
process.env.BETTER_AUTH_SECRET ??= "test-secret-minimum-32-characters-long";
process.env.BETTER_AUTH_URL ??= "http://localhost:5000";
process.env.FRONTEND_URL ??= "http://localhost:8081";
process.env.BREVO_API_KEY ??= "test-brevo-key";
process.env.SMTP_USER ??= "test@example.com";
process.env.SMTP_PASS ??= "test-smtp-password-16";
process.env.EMAIL_FROM ??= "no-reply@example.com";
process.env.NODE_ENV ??= "test";

const { createReadinessHandler } = await import("../src/app");
const {
  rateLimit,
  globalLimiter,
  authenticatedUserLimiter,
  resolveClientIp,
} = await import("../src/middleware/rateLimit.middleware");
const { formatErrorResponse } = await import(
  "../src/middleware/globalErrorHandler"
);
const { AppError } = await import("../src/utils/AppError");
const { buildMyHubSelect } = await import("../src/modules/hub/hub.repository");
const { aggregateAdminDashboardStats } = await import(
  "../src/modules/admin/admin.service"
);

function createMockRes() {
  const headers: Record<string, string | number> = {};
  const res = {
    statusCode: 200,
    body: undefined as any,
    setHeader(name: string, value: string | number) {
      headers[name] = value;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return { res, headers };
}

test("API-8: resolveClientIp ignores spoofed x-forwarded-for and uses req.ip", () => {
  const req: any = {
    ip: "203.0.113.10",
    headers: { "x-forwarded-for": "198.51.100.99" },
    socket: { remoteAddress: "127.0.0.1" },
  };
  assert.equal(resolveClientIp(req), "203.0.113.10");

  const limiter = rateLimit({ windowMs: 60_000, limit: 1 });
  let nextCount = 0;

  const first = createMockRes();
  limiter(req, first.res as any, () => {
    nextCount++;
  });
  assert.equal(nextCount, 1);

  // Rotating x-forwarded-for must NOT bypass the limit for the same req.ip
  const spoofedReq: any = {
    ip: "203.0.113.10",
    headers: { "x-forwarded-for": "198.51.100.200" },
    socket: { remoteAddress: "127.0.0.1" },
  };
  const second = createMockRes();
  limiter(spoofedReq, second.res as any, () => {
    nextCount++;
  });
  assert.equal(nextCount, 1);
  assert.equal(second.res.statusCode, 429);
  assert.ok(second.headers["Retry-After"]);
});

test("API-8: authenticatedUserLimiter isolates users sharing one campus NAT IP", () => {
  let nextCount = 0;
  const userAReq: any = {
    ip: "103.50.10.1",
    user: { id: "student-a" },
    headers: {},
    socket: {},
  };
  const userBReq: any = {
    ip: "103.50.10.1",
    user: { id: "student-b" },
    headers: {},
    socket: {},
  };

  const resA = createMockRes();
  authenticatedUserLimiter(userAReq, resA.res as any, () => {
    nextCount++;
  });
  const resB = createMockRes();
  authenticatedUserLimiter(userBReq, resB.res as any, () => {
    nextCount++;
  });

  assert.equal(nextCount, 2);
  // Each user starts with full remaining budget (200 - 1 = 199)
  assert.equal(resA.headers["X-RateLimit-Remaining"], 199);
  assert.equal(resB.headers["X-RateLimit-Remaining"], 199);
});

test("API-8: globalLimiter skips /api/auth routes to avoid double counting", () => {
  let nextCount = 0;
  const authReq: any = {
    ip: "103.50.10.99",
    path: "/auth/get-session",
    originalUrl: "/api/auth/get-session",
    headers: {},
    socket: {},
  };
  const { res, headers } = createMockRes();
  globalLimiter(authReq, res as any, () => {
    nextCount++;
  });
  assert.equal(nextCount, 1);
  assert.equal(headers["X-RateLimit-Limit"], undefined);
});

test("API-13: formatErrorResponse redacts unhandled 500 messages in production", () => {
  const req = { method: "GET", originalUrl: "/api/hubs/my" };
  const err = new Error("SELECT password FROM secret_table failed: ECONNREFUSED");

  const prodPayload = formatErrorResponse(err, req, "production");
  assert.equal(prodPayload.statusCode, 500);
  assert.equal(prodPayload.body.message, "Internal Server Error");
  assert.equal(prodPayload.body.stack, undefined);

  const appErrPayload = formatErrorResponse(
    new AppError("Hub not found", 404),
    req,
    "production",
  );
  assert.equal(appErrPayload.statusCode, 404);
  assert.equal(appErrPayload.body.message, "Hub not found");
});

test("API-22: readiness handler reports 200 ok vs 503 degraded without raw error leaks", async () => {
  const okHandler = createReadinessHandler(async () => [{ "?column?": 1 }]);
  const okMock = createMockRes();
  await okHandler({} as any, okMock.res as any);
  assert.equal(okMock.res.statusCode, 200);
  assert.equal(okMock.res.body.status, "ok");
  assert.equal(okMock.res.body.db, "connected");

  const failHandler = createReadinessHandler(async () => {
    throw new Error("postgres://admin:secret@db.internal:5432 failed");
  });
  const failMock = createMockRes();
  await failHandler({} as any, failMock.res as any);
  assert.equal(failMock.res.statusCode, 503);
  assert.equal(failMock.res.body.status, "degraded");
  assert.equal(failMock.res.body.db, "unavailable");
  assert.equal(JSON.stringify(failMock.res.body).includes("secret"), false);

  const timeoutHandler = createReadinessHandler(
    () => new Promise(() => {}),
    20,
  );
  const timeoutMock = createMockRes();
  await timeoutHandler({} as any, timeoutMock.res as any);
  assert.equal(timeoutMock.res.statusCode, 503);
  assert.equal(timeoutMock.res.body.db, "unavailable");
});

test("API-19: buildMyHubSelect omits sensitive/heavy fields in schedule and default views", () => {
  const now = new Date("2026-11-11T10:00:00.000Z");
  const scheduleSelect = buildMyHubSelect("schedule", now) as any;

  assert.equal(scheduleSelect.reviewQuestions, undefined);
  assert.equal(scheduleSelect.assessments, undefined);
  assert.equal(scheduleSelect.termExams, undefined);
  assert.equal(scheduleSelect.joinCode, undefined);
  assert.equal(scheduleSelect.members.where.isActive, true);
  assert.equal(scheduleSelect.members.select.user.select.email, undefined);
  assert.ok(scheduleSelect.classNotices.where.effectiveDate.gte instanceof Date);

  const defaultSelect = buildMyHubSelect("default", now) as any;
  assert.equal(defaultSelect.reviewQuestions, undefined);
  assert.equal(defaultSelect.members.select.user.select.email, undefined);
  assert.equal(defaultSelect.termExams, true);
  assert.ok(defaultSelect.assessments);
});

test("Admin stats aggregation consolidates groupBy counts and omits unused fields", () => {
  const now = new Date("2026-11-11T09:00:00.000Z");
  const result = aggregateAdminDashboardStats({
    userStats: [
      { role: "STUDENT", isRestricted: false, _count: { _all: 120 } },
      { role: "STUDENT", isRestricted: true, _count: { _all: 5 } },
      { role: "TEACHER", isRestricted: false, _count: { _all: 18 } },
      { role: "ADMIN", isRestricted: false, _count: { _all: 2 } },
    ],
    totalCourseHubs: 14,
    recentUsers: [
      { id: "t1", name: "Dr. Rahman", role: "TEACHER", createdAt: now },
      { id: "s1", name: "Nadia", role: "STUDENT", createdAt: now },
    ],
    recentRestricted: [],
    recentNotices: [],
    recentComplaints: [],
  }) as any;

  assert.equal(result.totalStudents, 125);
  assert.equal(result.totalTeachers, 18);
  assert.equal(result.totalUsers, 145);
  assert.equal(result.restrictedUsers, 5);
  assert.equal(result.totalCourseHubs, 14);
  assert.equal("pendingApprovals" in result, false);
  assert.equal("activeNotices" in result, false);
  assert.equal(result.recentActivity.length, 2);
});
