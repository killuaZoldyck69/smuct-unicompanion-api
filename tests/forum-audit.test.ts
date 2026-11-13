import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Safe synthetic test defaults before importing config-dependent modules
process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/testdb";
process.env.DIRECT_URL ??= "postgresql://user:pass@localhost:5432/testdb";
process.env.BETTER_AUTH_SECRET ??= "test-secret-minimum-32-characters-long";
process.env.BETTER_AUTH_URL ??= "http://localhost:5000";
process.env.FRONTEND_URL ??= "http://localhost:8081";
process.env.BREVO_API_KEY ??= "test-brevo-key";
process.env.NODE_ENV ??= "test";

const {
  extractPlainText,
  sanitizeForumHtml,
  validateAndSanitizePost,
  validateAndSanitizeResponse,
} = await import("../src/modules/forum/forum.sanitizer");
const {
  publicUserSelect,
  feedAuthorSelect,
  resolveNextReactionState,
  shouldAutoHideByReportCount,
  filterForumNotificationRecipients,
  isForumItemVisibleToViewer,
  attachReactionSummariesToResponses,
  UGC_AUTO_HIDE_REPORT_THRESHOLD,
} = await import("../src/modules/forum/forum.domain");
const {
  createPostSchema,
  reactResponseSchema,
  createForumReportSchema,
  getFeedQuerySchema,
} = await import("../src/modules/forum/forum.schema");
const {
  adminForumReportsQuerySchema,
  adminResolveReportSchema,
} = await import("../src/modules/admin/admin.schema");
const { createUserKeyGenerator } = await import(
  "../src/middleware/rateLimit.middleware"
);
const { postRateLimiter, replyRateLimiter } = await import(
  "../src/modules/forum/forum.routes"
);
const { AppError } = await import("../src/utils/AppError");
const { formatErrorResponse } = await import(
  "../src/middleware/globalErrorHandler"
);

function invokeLimiter(
  limiter: any,
  userId: string | undefined,
  ip: string,
): { status: number } {
  let status = 200;
  let nextCalled = false;
  const req: any = {
    ip,
    socket: { remoteAddress: ip },
    headers: {},
    ...(userId ? { user: { id: userId } } : {}),
  };
  const res: any = {
    status(code: number) {
      status = code;
      return this;
    },
    json() {
      return this;
    },
    setHeader() {
      return this;
    },
  };
  limiter(req, res, () => {
    nextCalled = true;
  });
  return { status: nextCalled ? 200 : status };
}

test("API-15: sanitizeForumHtml defeats nested script reconstruction & SVG/URI attacks while keeping safe align styles", () => {
  const payload =
    '<p style="text-align: justify; color: red;">Intro <scr<script></script>ipt>malicious()</script> <script>stealSecret()</script><b>bold</b><svg onload="alert(2)">bad</svg><a href="javascript:alert(3)">link</a></p>';
  const cleaned = sanitizeForumHtml(payload);

  assert.equal(/<script/i.test(cleaned), false);
  assert.equal(/stealSecret/i.test(cleaned), false);
  assert.equal(/<svg/i.test(cleaned), false);
  assert.equal(/onload/i.test(cleaned), false);
  assert.equal(/javascript:/i.test(cleaned), false);
  assert.equal(/color:\s*red/i.test(cleaned), false);
  assert.equal(cleaned.includes("<b>bold</b>"), true);
  assert.equal(cleaned.includes('style="text-align: justify"'), true);

  assert.equal(
    extractPlainText('<p>Hello</p><script>stealCookie()</script><p>World</p>'),
    "Hello World",
  );
});

test("API-15: post validation checks plain-text 3000-char limit independently of HTML markup overhead", () => {
  const richUnderPlainLimit = `<p>${"<b>a</b>".repeat(450)}</p>`; // 450 plain chars, >3150 HTML chars
  assert.equal(richUnderPlainLimit.length > 3000, true);

  const schemaParsed = createPostSchema.safeParse({
    body: {
      title: "Valid Formatted Question",
      description: richUnderPlainLimit,
    },
  });
  assert.equal(schemaParsed.success, true);

  const sanitized = validateAndSanitizePost({
    title: "Valid Formatted Question",
    description: richUnderPlainLimit,
  });
  assert.equal(sanitized.error, undefined);
  assert.equal(sanitized.plainText?.length, 450);

  const overPlainLimit = `<p>${"x".repeat(3001)}</p>`;
  const rejected = validateAndSanitizePost({
    title: "Valid Formatted Question",
    description: overPlainLimit,
  });
  assert.match(rejected.error ?? "", /3,000 characters/);

  assert.ok(validateAndSanitizeResponse("<script>xss()</script>").error);
});

test("API-8: Forum rate limiters isolate authenticated users behind a shared campus NAT IP", () => {
  const sharedIp = "103.10.20.99";

  // Exhaust User A's post quota (10 requests)
  for (let i = 0; i < 10; i++) {
    assert.equal(invokeLimiter(postRateLimiter, "user-nat-a", sharedIp).status, 200);
  }
  assert.equal(invokeLimiter(postRateLimiter, "user-nat-a", sharedIp).status, 429);

  // User B on the exact same campus NAT IP must still be allowed
  assert.equal(invokeLimiter(postRateLimiter, "user-nat-b", sharedIp).status, 200);

  // Exhaust User C's reply quota (25 requests) without impacting User D on same IP
  for (let i = 0; i < 25; i++) {
    assert.equal(invokeLimiter(replyRateLimiter, "user-nat-c", sharedIp).status, 200);
  }
  assert.equal(invokeLimiter(replyRateLimiter, "user-nat-c", sharedIp).status, 429);
  assert.equal(invokeLimiter(replyRateLimiter, "user-nat-d", sharedIp).status, 200);

  const keyGen = createUserKeyGenerator("forum-test");
  assert.equal(
    keyGen({ user: { id: "u-1" }, ip: sharedIp } as any),
    "forum-test:user:u-1",
  );
  assert.equal(keyGen({ ip: sharedIp } as any), `forum-test:ip:${sharedIp}`);
});

test("API-5: Forum post creation removes all-user broadcast and reply recipient filtering deduplicates & excludes replier", () => {
  const forumServiceSource = fs.readFileSync(
    path.resolve("src/modules/forum/forum.service.ts"),
    "utf8",
  );
  assert.equal(forumServiceSource.includes("createNotificationsForAllUsers"), false);

  const recipients = filterForumNotificationRecipients(
    ["author-1", "parent-2", "parent-2", "replier-3", ""],
    "replier-3",
  );
  assert.deepEqual(recipients, ["author-1", "parent-2"]);
});

test("Privacy: publicUserSelect and feedAuthorSelect strip email, studentId, teacherId, phoneNumber, bloodGroup", () => {
  const userKeys = new Set(Object.keys(publicUserSelect));
  assert.equal(userKeys.has("email"), false);
  assert.equal(userKeys.has("phoneNumber"), false);
  assert.equal(userKeys.has("bloodGroup"), false);

  const studentKeys = new Set(Object.keys(publicUserSelect.studentProfile.select));
  assert.equal(studentKeys.has("studentId"), false);
  assert.equal(studentKeys.has("department"), true);
  assert.equal(studentKeys.has("currentSemester"), true);

  const teacherKeys = new Set(Object.keys(publicUserSelect.teacherProfile.select));
  assert.equal(teacherKeys.has("teacherId"), false);
  assert.equal(teacherKeys.has("designation"), true);
  assert.equal(teacherKeys.has("consultationSlots"), true);

  const feedUserKeys = new Set(Object.keys(feedAuthorSelect));
  assert.equal(feedUserKeys.has("email"), false);
});

test("Reactions: resolveNextReactionState toggles/switches cleanly and attaches summaries to nested replies", () => {
  const like1 = resolveNextReactionState(null, "LIKE", {
    likesCount: 0,
    dislikesCount: 0,
  });
  assert.deepEqual(like1, {
    likesCount: 1,
    dislikesCount: 0,
    userReaction: "LIKE",
  });

  const unlike = resolveNextReactionState("LIKE", "LIKE", like1);
  assert.deepEqual(unlike, {
    likesCount: 0,
    dislikesCount: 0,
    userReaction: null,
  });

  const switched = resolveNextReactionState("LIKE", "DISLIKE", {
    likesCount: 4,
    dislikesCount: 1,
  });
  assert.deepEqual(switched, {
    likesCount: 3,
    dislikesCount: 2,
    userReaction: "DISLIKE",
  });

  const decorated = attachReactionSummariesToResponses(
    [
      {
        id: "r1",
        content: "Top reply",
        replies: [{ id: "r2", content: "Nested reply" }],
      },
    ],
    new Map([["r1", { likesCount: 5, dislikesCount: 1 }]]),
    new Map([["r2", "DISLIKE"]]),
  );

  assert.equal(decorated[0].likesCount, 5);
  assert.equal(decorated[0].dislikesCount, 1);
  assert.equal(decorated[0].userReaction, null);
  assert.equal(decorated[0].replies?.[0].likesCount, 0);
  assert.equal(decorated[0].replies?.[0].userReaction, "DISLIKE");
});

test("UGC Moderation: auto-hide threshold, viewer visibility filtering, and UGC_TERMS_REQUIRED error code", () => {
  assert.equal(UGC_AUTO_HIDE_REPORT_THRESHOLD, 3);
  assert.equal(shouldAutoHideByReportCount(2), false);
  assert.equal(shouldAutoHideByReportCount(3), true);

  const studentViewer = {
    userId: "student-1",
    role: "STUDENT",
    reportedPostIds: new Set(["reported-post"]),
    reportedResponseIds: new Set(["reported-reply"]),
  };

  assert.equal(
    isForumItemVisibleToViewer(
      { id: "p-ok", authorId: "other-user", isHiddenByModeration: false },
      "FORUM_POST",
      studentViewer,
    ),
    true,
  );
  assert.equal(
    isForumItemVisibleToViewer(
      { id: "reported-post", authorId: "other-user", isHiddenByModeration: false },
      "FORUM_POST",
      studentViewer,
    ),
    false,
  );
  assert.equal(
    isForumItemVisibleToViewer(
      { id: "p-mod", authorId: "other-user", isHiddenByModeration: true },
      "FORUM_POST",
      studentViewer,
    ),
    false,
  );
  assert.equal(
    isForumItemVisibleToViewer(
      { id: "p-mod", authorId: "other-user", isHiddenByModeration: true },
      "FORUM_POST",
      { ...studentViewer, role: "ADMIN" },
    ),
    true,
  );

  const formatted = formatErrorResponse(
    new AppError(
      "Please accept the Community Guidelines before posting or replying.",
      403,
      "UGC_TERMS_REQUIRED",
    ),
    { method: "POST", originalUrl: "/api/forum" },
    "production",
  );
  assert.equal(formatted.statusCode, 403);
  assert.equal(formatted.body.code, "UGC_TERMS_REQUIRED");
});

test("Schemas validate reaction, report, feed limit, and admin moderation payloads", () => {
  const validUuid = "11111111-1111-4111-8111-111111111111";
  const validUuid2 = "22222222-2222-4222-8222-222222222222";

  assert.equal(
    reactResponseSchema.safeParse({
      params: { id: validUuid, responseId: validUuid2 },
      body: { type: "LIKE" },
    }).success,
    true,
  );
  assert.equal(
    reactResponseSchema.safeParse({
      params: { id: validUuid, responseId: validUuid2 },
      body: { type: "LOVE" },
    }).success,
    false,
  );

  assert.equal(
    createForumReportSchema.safeParse({
      body: {
        targetType: "FORUM_RESPONSE",
        targetId: validUuid,
        reason: "HARASSMENT",
        details: "Abusive comment",
      },
    }).success,
    true,
  );

  assert.equal(
    adminResolveReportSchema.safeParse({
      params: { reportId: validUuid },
      body: { action: "RESTRICT_USER", adminNote: "Repeated harassment" },
    }).success,
    true,
  );

  const feedDefaults = getFeedQuerySchema.parse({ query: {} });
  assert.equal(feedDefaults.query.limit, 15);
  assert.equal(
    adminForumReportsQuerySchema.parse({ query: {} }).query.status,
    "PENDING",
  );
});

test("Hardening: title tags are stripped, author sees own moderated post, and concurrency/atomicity guards exist", () => {
  const withHtmlTitle = validateAndSanitizePost({
    title: "<b>Urgent</b> <script>alert(1)</script> Exam Schedule?",
    description: "<p>Valid academic question body text here.</p>",
  });
  assert.equal(withHtmlTitle.error, undefined);
  assert.equal(withHtmlTitle.cleanTitle, "Urgent Exam Schedule?");

  const authorViewer = {
    userId: "author-1",
    role: "STUDENT",
    reportedPostIds: new Set<string>(),
    reportedResponseIds: new Set<string>(),
  };
  assert.equal(
    isForumItemVisibleToViewer(
      { id: "p-mod", authorId: "author-1", isHiddenByModeration: true },
      "FORUM_POST",
      authorViewer,
    ),
    true,
  );
  assert.equal(
    isForumItemVisibleToViewer(
      { id: "r-mod", authorId: "author-1", isHiddenByModeration: true },
      "FORUM_RESPONSE",
      authorViewer,
    ),
    false,
  );

  const adminModerationSource = fs.readFileSync(
    path.resolve("src/modules/admin/admin-moderation.service.ts"),
    "utf8",
  );
  assert.equal(
    adminModerationSource.includes("restrictUserService("),
    false,
    "RESTRICT_USER must execute inside prisma.$transaction rather than before it",
  );
  assert.equal(
    adminModerationSource.includes("childResponseIds"),
    true,
  );

  const repoSource = fs.readFileSync(
    path.resolve("src/modules/forum/forum.repository.ts"),
    "utf8",
  );
  assert.equal(repoSource.includes("FOR UPDATE"), true);
  assert.equal(repoSource.includes('err.code === "P2002"'), true);

  const serviceSource = fs.readFileSync(
    path.resolve("src/modules/forum/forum.service.ts"),
    "utf8",
  );
  assert.equal(serviceSource.includes("rootResponse.isHiddenByModeration"), true);
  assert.equal(serviceSource.includes("reopenReportId"), true);
});

test("Security & DB Reliability audit: P2025/P2003 404 mapping, report resolution locking/DISMISS guard, UGC edit enforcement, and bounded moderation queries", async () => {
  const { Prisma } = await import("../generated/prisma/client");

  const fkErr = new Prisma.PrismaClientKnownRequestError(
    "Foreign key constraint failed on help_response_reaction_responseId_fkey",
    { code: "P2003", clientVersion: "7.8.0" },
  );
  const fkPayload = formatErrorResponse(fkErr, {
    method: "POST",
    originalUrl: "/api/forum/1/responses/2/react",
  });
  assert.equal(fkPayload.statusCode, 404);
  assert.equal(fkPayload.body.message, "Requested resource was not found.");
  assert.equal(fkPayload.body.message.includes("fkey"), false);

  const notFoundErr = new Prisma.PrismaClientKnownRequestError(
    "An operation failed because it depends on one or more records that were required but not found.",
    { code: "P2025", clientVersion: "7.8.0" },
  );
  const notFoundPayload = formatErrorResponse(notFoundErr, {
    method: "PATCH",
    originalUrl: "/api/forum/1",
  });
  assert.equal(notFoundPayload.statusCode, 404);
  assert.equal(notFoundPayload.body.message, "Requested resource was not found.");

  const adminModerationSource = fs.readFileSync(
    path.resolve("src/modules/admin/admin-moderation.service.ts"),
    "utf8",
  );
  assert.equal(adminModerationSource.includes('"content_report"'), true);
  assert.equal(adminModerationSource.includes("FOR UPDATE"), true);
  assert.equal(adminModerationSource.includes('report.status !== "PENDING"'), true);
  assert.equal(adminModerationSource.includes("remainingActioned === 0"), true);

  const repoSource = fs.readFileSync(
    path.resolve("src/modules/forum/forum.repository.ts"),
    "utf8",
  );
  assert.equal(repoSource.includes('status: "PENDING"'), true);
  assert.equal(repoSource.includes("take: 200"), true);
  assert.equal(repoSource.includes("parent: visibleResponseWhere"), true);
  assert.equal(repoSource.includes("locked.length === 0"), true);

  const serviceSource = fs.readFileSync(
    path.resolve("src/modules/forum/forum.service.ts"),
    "utf8",
  );
  assert.equal(serviceSource.includes('role !== "ADMIN"'), true);
  assert.equal(serviceSource.includes("FOR SHARE"), true);
  const ugcCalls = serviceSource.match(/assertUserAcceptedUgcTerms\(/g) ?? [];
  assert.ok(
    ugcCalls.length >= 4,
    `Expected create/reply/edit-post/edit-response to check UGC terms (found ${ugcCalls.length})`,
  );

  const userRepoSource = fs.readFileSync(
    path.resolve("src/modules/user/user.repository.ts"),
    "utf8",
  );
  assert.equal(userRepoSource.includes("ugcTermsAcceptedAt: null"), true);
});
