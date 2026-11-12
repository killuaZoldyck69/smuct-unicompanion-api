import test from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";

// Safe synthetic test defaults before importing config-dependent modules
process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/testdb";
process.env.DIRECT_URL ??= "postgresql://user:pass@localhost:5432/testdb";
process.env.BETTER_AUTH_SECRET ??= "test-secret-minimum-32-characters-long";
process.env.BETTER_AUTH_URL ??= "http://localhost:5000";
process.env.FRONTEND_URL ??= "http://localhost:8081";
process.env.BREVO_API_KEY ??= "test-brevo-key";
process.env.EMAIL_FROM ??= "no-reply@example.com";
process.env.NODE_ENV ??= "test";

const { evaluateSignUpAccountCollision } = await import("../src/lib/auth-hooks");
const { maskEmail } = await import("../src/lib/email");
const {
  recordVerificationOtpDelivered,
  clearVerificationOtpDelivered,
  hasActiveVerificationOtpCooldown,
  renderVerificationOtpEmail,
  renderPasswordResetOtpEmail,
  renderTeacherWelcomeEmail,
  UNICOMPANION_SPLASH_LOGO_URL,
  DEVELOPER_CREDIT,
} = await import("../src/services/auth-email.service");
const {
  consumeIdentifierRateLimit,
  resetIdentifierRateLimitStore,
  onboardLimiter,
} = await import("../src/middleware/rateLimit.middleware");
const { onboardStudentSchema } = await import(
  "../src/modules/student/student.schema"
);
const { validatePassword } = await import("../src/utils/password-validator");

function createMockRes() {
  const headers: Record<string, unknown> = {};
  let statusCode = 200;
  let body: unknown = null;
  const res = {
    setHeader(name: string, value: unknown) {
      headers[name] = value;
      return this;
    },
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      return this;
    },
  } as unknown as Response;

  return { res, getStatus: () => statusCode, getBody: () => body, headers };
}

test("API-2: evaluateSignUpAccountCollision never deletes verified users (even when studentProfile is null)", () => {
  // 1. Verified student currently on Onboarding screen (studentProfile === null)
  const verifiedUnonboarded = evaluateSignUpAccountCollision(
    {
      id: "user-verified-1",
      role: "STUDENT",
      emailVerified: true,
      isRestricted: false,
      studentProfile: null,
      teacherProfile: null,
    },
    false,
  );
  assert.equal(verifiedUnonboarded.action, "reject_existing");

  // 2. Restricted user -> forbidden
  const restricted = evaluateSignUpAccountCollision(
    {
      id: "user-restricted-1",
      role: "STUDENT",
      emailVerified: false,
      isRestricted: true,
      studentProfile: null,
      teacherProfile: null,
    },
    false,
  );
  assert.equal(restricted.action, "forbidden");

  // 3. Unverified user with active OTP cooldown -> reject_active_otp (protects pending verification)
  const unverifiedActiveOtp = evaluateSignUpAccountCollision(
    {
      id: "user-unverified-1",
      role: "STUDENT",
      emailVerified: false,
      isRestricted: false,
      studentProfile: null,
      teacherProfile: null,
    },
    true,
  );
  assert.equal(unverifiedActiveOtp.action, "reject_active_otp");

  // 4. Stale unverified user with no profile and no active OTP cooldown -> purge_stale_unverified
  const staleUnverified = evaluateSignUpAccountCollision(
    {
      id: "user-stale-1",
      role: "STUDENT",
      emailVerified: false,
      isRestricted: false,
      studentProfile: null,
      teacherProfile: null,
    },
    false,
  );
  assert.deepEqual(staleUnverified, {
    action: "purge_stale_unverified",
    userId: "user-stale-1",
  });
});

test("API-10 & API-2: verification OTP delivery cooldown tracks delivered emails and clears on failure", () => {
  const email = "Student223@smuct.ac.bd";
  const t0 = 1_700_000_000_000;

  clearVerificationOtpDelivered(email);
  assert.equal(hasActiveVerificationOtpCooldown(email, t0), false);

  recordVerificationOtpDelivered(email, t0);
  assert.equal(hasActiveVerificationOtpCooldown(email, t0 + 30_000), true);
  assert.equal(hasActiveVerificationOtpCooldown(email, t0 + 121_000), false);

  // If delivery fails, clearing removes the cooldown immediately so user can retry
  recordVerificationOtpDelivered(email, t0);
  clearVerificationOtpDelivered(email);
  assert.equal(hasActiveVerificationOtpCooldown(email, t0 + 1_000), false);
});

test("API-21: maskEmail redacts PII before console logging", () => {
  assert.equal(maskEmail("student223071066@smuct.ac.bd"), "st***@smuct.ac.bd");
  assert.equal(maskEmail("a@smuct.ac.bd"), "a***@smuct.ac.bd");
  assert.equal(maskEmail("invalid-email"), "***");
});

test("API-8: consumeIdentifierRateLimit isolates per-email OTP/action quotas and onboardLimiter keys by user.id", () => {
  resetIdentifierRateLimitStore();
  const windowMs = 15 * 60 * 1000;
  const now = 1_700_000_000_000;

  // Student A hits 3 OTP limit
  assert.equal(
    consumeIdentifierRateLimit("a@smuct.ac.bd", "auth-otp-email", 3, windowMs, now).allowed,
    true,
  );
  assert.equal(
    consumeIdentifierRateLimit("a@smuct.ac.bd", "auth-otp-email", 3, windowMs, now + 100).allowed,
    true,
  );
  assert.equal(
    consumeIdentifierRateLimit("a@smuct.ac.bd", "auth-otp-email", 3, windowMs, now + 200).allowed,
    true,
  );
  assert.equal(
    consumeIdentifierRateLimit("a@smuct.ac.bd", "auth-otp-email", 3, windowMs, now + 300).allowed,
    false,
  );

  // Student B on the same campus Wi-Fi is unaffected
  assert.equal(
    consumeIdentifierRateLimit("b@smuct.ac.bd", "auth-otp-email", 3, windowMs, now + 300).allowed,
    true,
  );

  // Onboard limiter isolates users sharing one campus NAT IP
  const sharedIp = "103.112.54.10";
  for (let i = 0; i < 10; i++) {
    const { res, getStatus } = createMockRes();
    let nextCalled = false;
    onboardLimiter(
      { ip: sharedIp, user: { id: "student-onboard-1" } } as unknown as Request,
      res,
      () => {
        nextCalled = true;
      },
    );
    assert.equal(nextCalled, true);
    assert.equal(getStatus(), 200);
  }

  // 11th onboarding request by student-onboard-1 is 429
  {
    const { res, getStatus } = createMockRes();
    let nextCalled = false;
    onboardLimiter(
      { ip: sharedIp, user: { id: "student-onboard-1" } } as unknown as Request,
      res,
      () => {
        nextCalled = true;
      },
    );
    assert.equal(nextCalled, false);
    assert.equal(getStatus(), 429);
  }

  // student-onboard-2 on the exact same campus NAT IP succeeds
  {
    const { res, getStatus } = createMockRes();
    let nextCalled = false;
    onboardLimiter(
      { ip: sharedIp, user: { id: "student-onboard-2" } } as unknown as Request,
      res,
      () => {
        nextCalled = true;
      },
    );
    assert.equal(nextCalled, true);
    assert.equal(getStatus(), 200);
  }
});

test("onboardStudentSchema validates 9-digit studentId, numeric batch, uppercase section, and atomic phoneNumber/bloodGroup", () => {
  const parsed = onboardStudentSchema.parse({
    body: {
      studentId: "223071066",
      faculty: "Design & Technology",
      department: "CSE",
      program: "B.Sc. in CSE",
      batch: "31",
      currentSemester: 8,
      section: "b",
      phoneNumber: "01712345678",
      bloodGroup: "O_POSITIVE",
    },
  });

  assert.equal(parsed.body.studentId, "223071066");
  assert.equal(parsed.body.section, "B");
  assert.equal(parsed.body.phoneNumber, "+8801712345678");
  assert.equal(parsed.body.bloodGroup, "O_POSITIVE");

  // Rejects non-9-digit studentId
  assert.equal(
    onboardStudentSchema.safeParse({
      body: {
        studentId: "12345",
        faculty: "Design & Technology",
        department: "CSE",
        program: "B.Sc. in CSE",
        batch: "31",
        currentSemester: 8,
        section: "A",
      },
    }).success,
    false,
  );
});

test("validatePassword enforces institutional password complexity rules", () => {
  assert.equal(validatePassword("Short1!").isValid, false);
  assert.equal(validatePassword("alllowercase1!").isValid, false);
  assert.equal(validatePassword("ALLUPPERCASE1!").isValid, false);
  assert.equal(validatePassword("NoNumbersHere!").isValid, false);
  assert.equal(validatePassword("NoSpecialChar123").isValid, false);
  assert.equal(validatePassword("ValidPass123!").isValid, true);
});

test("Email templates include Splash Screen logo, 5-minute OTP validity, and Developer GitHub/LinkedIn attribution", () => {
  const verifyHtml = renderVerificationOtpEmail("649882");
  assert.ok(verifyHtml.includes(UNICOMPANION_SPLASH_LOGO_URL));
  assert.ok(verifyHtml.includes("649882"));
  assert.ok(verifyHtml.includes("Valid for 5 minutes"));
  assert.ok(verifyHtml.includes(DEVELOPER_CREDIT.name));
  assert.ok(verifyHtml.includes(DEVELOPER_CREDIT.githubUrl));
  assert.ok(verifyHtml.includes(DEVELOPER_CREDIT.linkedInUrl));

  const resetHtml = renderPasswordResetOtpEmail("123456");
  assert.ok(resetHtml.includes(UNICOMPANION_SPLASH_LOGO_URL));
  assert.ok(resetHtml.includes("123456"));
  assert.ok(resetHtml.includes("Valid for 5 minutes"));
  assert.ok(resetHtml.includes(DEVELOPER_CREDIT.name));
  assert.ok(resetHtml.includes(DEVELOPER_CREDIT.githubUrl));
  assert.ok(resetHtml.includes(DEVELOPER_CREDIT.linkedInUrl));

  const teacherHtml = renderTeacherWelcomeEmail({
    name: "Dr. A & B",
    email: "teacher@smuct.ac.bd",
    teacherId: "T-1001",
    temporaryPassword: "Temp<Pass>123!",
    designation: "Associate Professor",
    department: "CSE",
    faculty: "Design & Technology",
    officeRoom: "Room 402",
  });
  assert.ok(teacherHtml.includes(UNICOMPANION_SPLASH_LOGO_URL));
  assert.ok(teacherHtml.includes("Dr. A &amp; B"));
  assert.ok(teacherHtml.includes("Temp&lt;Pass&gt;123!"));
  assert.ok(teacherHtml.includes(DEVELOPER_CREDIT.name));
  assert.ok(teacherHtml.includes(DEVELOPER_CREDIT.githubUrl));
  assert.ok(teacherHtml.includes(DEVELOPER_CREDIT.linkedInUrl));
});
