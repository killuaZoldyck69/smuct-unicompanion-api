import test from "node:test";
import assert from "node:assert/strict";

// Safe synthetic test defaults before importing config-dependent modules
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

const {
  hashAccountIdentifier,
  computeNextDeletionGuardState,
  evaluateDeletionGuardBlock,
} = await import("../src/utils/account-deletion-guard");
const { isSafePublicHttpsUrl } = await import("../src/utils/url-validators");
const { assertSelfDeletionAllowed } = await import(
  "../src/modules/user/user.service"
);
const {
  deleteMyAccountSchema,
  profileImageBodySchema,
} = await import("../src/modules/user/user.schema");
const { updateProfileSchema: updateStudentProfileSchema } = await import(
  "../src/modules/student/student.schema"
);
const { updateTeacherProfileSchema } = await import(
  "../src/modules/teacher/teacher.schema"
);
const { formatTeacherProfile } = await import(
  "../src/modules/teacher/teacher.controller"
);
const { formatErrorResponse } = await import(
  "../src/middleware/globalErrorHandler"
);

test("AccountDeletionGuard: normalizes identifiers and isolates domain hashes", () => {
  const secret = "test-secret-minimum-32-characters-long";
  const h1 = hashAccountIdentifier("EMAIL", "  Student@SMUCT.edu.bd ", secret);
  const h2 = hashAccountIdentifier("EMAIL", "student@smuct.edu.bd", secret);
  const sid1 = hashAccountIdentifier("STUDENT_ID", "241071001", secret);
  const sid2 = hashAccountIdentifier("EMAIL", "241071001", secret);

  assert.equal(h1, h2);
  assert.notEqual(sid1, sid2);
  assert.equal(h1.length, 64);
});

test("AccountDeletionGuard: applies 30-day cooldown on 1st delete and permanently blocks on 2nd delete", () => {
  const now = new Date("2026-11-11T00:00:00.000Z");

  // 1st self-delete -> cooldown
  const first = computeNextDeletionGuardState(0, now, 30);
  assert.equal(first.deletionCount, 1);
  assert.equal(first.isPermanentlyBlocked, false);
  assert.ok(first.blockedUntil instanceof Date);

  const duringCooldown = evaluateDeletionGuardBlock(
    first,
    new Date("2026-11-20T00:00:00.000Z"),
  );
  assert.equal(duringCooldown.blocked, true);
  assert.equal(duringCooldown.permanent, false);

  const afterCooldown = evaluateDeletionGuardBlock(
    first,
    new Date("2026-12-15T00:00:00.000Z"),
  );
  assert.equal(afterCooldown.blocked, false);

  // 2nd self-delete -> permanent block
  const second = computeNextDeletionGuardState(first.deletionCount, now, 30);
  assert.equal(second.deletionCount, 2);
  assert.equal(second.isPermanentlyBlocked, true);
  assert.equal(second.blockedUntil, null);

  const blockedForever = evaluateDeletionGuardBlock(
    second,
    new Date("2030-01-01T00:00:00.000Z"),
  );
  assert.equal(blockedForever.blocked, true);
  assert.equal(blockedForever.permanent, true);
});

test("assertSelfDeletionAllowed blocks restricted users and last active admin", () => {
  assert.throws(
    () => assertSelfDeletionAllowed({ user: null, otherActiveAdminCount: 0 }),
    (err: any) => err.statusCode === 404,
  );

  assert.throws(
    () =>
      assertSelfDeletionAllowed({
        user: {
          id: "u1",
          email: "s@smuct.edu.bd",
          role: "STUDENT",
          isRestricted: true,
          image: "",
          studentProfile: null,
        },
        otherActiveAdminCount: 1,
      }),
    (err: any) => err.statusCode === 403,
  );

  assert.throws(
    () =>
      assertSelfDeletionAllowed({
        user: {
          id: "a1",
          email: "admin@smuct.edu.bd",
          role: "ADMIN",
          isRestricted: false,
          image: "",
          studentProfile: null,
        },
        otherActiveAdminCount: 0,
      }),
    (err: any) => err.statusCode === 403,
  );

  // Allowed when another active admin exists or user is non-admin
  assert.doesNotThrow(() =>
    assertSelfDeletionAllowed({
      user: {
        id: "a1",
        email: "admin@smuct.edu.bd",
        role: "ADMIN",
        isRestricted: false,
        image: "",
        studentProfile: null,
      },
      otherActiveAdminCount: 1,
    }),
  );
});

test("Avatar image URL validation rejects unsafe/private URLs and accepts public HTTPS", () => {
  assert.equal(
    isSafePublicHttpsUrl("https://res.cloudinary.com/demo/image/upload/avatar.jpg"),
    true,
  );
  assert.equal(isSafePublicHttpsUrl("http://res.cloudinary.com/a.jpg"), false);
  assert.equal(isSafePublicHttpsUrl("javascript:alert(1)"), false);
  assert.equal(isSafePublicHttpsUrl("https://localhost:5000/a.png"), false);
  assert.equal(isSafePublicHttpsUrl("https://192.168.1.10/a.png"), false);

  assert.equal(
    profileImageBodySchema.safeParse({
      body: { imageUrl: "https://res.cloudinary.com/demo/avatar.png" },
    }).success,
    true,
  );
  assert.equal(
    profileImageBodySchema.safeParse({
      body: { imageUrl: "javascript:alert(1)" },
    }).success,
    false,
  );
});

test("deleteMyAccountSchema requires exact DELETE confirmation string", () => {
  assert.equal(
    deleteMyAccountSchema.safeParse({ body: { confirmation: "DELETE" } }).success,
    true,
  );
  assert.equal(
    deleteMyAccountSchema.safeParse({ body: { confirmation: "delete" } }).success,
    false,
  );
  assert.equal(deleteMyAccountSchema.safeParse({ body: {} }).success, false);
});

test("Student & Teacher schemas sanitize URLs and enforce canonical profile shapes", () => {
  const studentParsed = updateStudentProfileSchema.parse({
    body: {
      linkedInUrl: "linkedin.com/in/student-test",
      personalWebsiteUrl: "",
      currentSemester: 8,
    },
  });
  assert.equal(
    studentParsed.body.linkedInUrl,
    "https://linkedin.com/in/student-test",
  );
  assert.equal(studentParsed.body.personalWebsiteUrl, "");

  assert.equal(
    updateStudentProfileSchema.safeParse({
      body: { linkedInUrl: "javascript:alert(1)" },
    }).success,
    false,
  );

  const teacherParsed = updateTeacherProfileSchema.parse({
    body: {
      expertiseFields: ["Algorithms", "Distributed Systems"],
      academicQualifications: [
        { degree: "M.Sc. in CSE", institution: "BUET" },
      ],
      dayOff: "Friday",
      linkedInUrl: "linkedin.com/in/faculty",
    },
  });
  assert.equal(teacherParsed.body.expertiseFields?.length, 2);
  assert.equal(teacherParsed.body.academicQualifications?.[0].degree, "M.Sc. in CSE");
  assert.equal(teacherParsed.body.dayOff, "Friday");

  assert.equal(
    updateTeacherProfileSchema.safeParse({
      body: { dayOff: "Funday" },
    }).success,
    false,
  );

  // Server-side phone validation & BD normalization
  const phoneNormalized = updateStudentProfileSchema.parse({
    body: { phoneNumber: "01712-345678" },
  });
  assert.equal(phoneNormalized.body.phoneNumber, "+8801712345678");
  assert.equal(
    updateStudentProfileSchema.parse({ body: { phoneNumber: "" } }).body.phoneNumber,
    "",
  );
  assert.equal(
    updateStudentProfileSchema.safeParse({ body: { phoneNumber: "abc" } }).success,
    false,
  );

  // Teacher consultation slots require non-empty day, startTime, and endTime
  assert.equal(
    updateTeacherProfileSchema.safeParse({
      body: {
        consultationSlots: [{ day: "Sunday", startTime: "", endTime: "12:00 PM" }],
      },
    }).success,
    false,
  );
});

test("formatTeacherProfile keeps User.id even when teacherProfile has its own id", () => {
  const formatted = formatTeacherProfile({
    id: "user-123",
    name: "Dr. Rahman",
    email: "rahman@smuct.ac.bd",
    image: "",
    phoneNumber: "",
    bloodGroup: null,
    role: "TEACHER",
    teacherProfile: {
      id: "profile-999",
      teacherId: "1001",
      designation: "Professor",
      department: "CSE",
    },
  });

  assert.equal(formatted.id, "user-123");
  assert.equal(formatted.teacherId, "1001");
});

test("globalErrorHandler maps MulterError size limits to HTTP 400 instead of 500", () => {
  const multerErr = Object.assign(new Error("File too large"), {
    name: "MulterError",
    code: "LIMIT_FILE_SIZE",
  });
  const formatted = formatErrorResponse(
    multerErr,
    { method: "PATCH", originalUrl: "/api/students/profile/image" },
    "production",
  );
  assert.equal(formatted.statusCode, 400);
  assert.match(formatted.body.message, /maximum allowed size/i);
});
