import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/testdb";
process.env.DIRECT_URL ??= "postgresql://user:pass@localhost:5432/testdb";
process.env.BETTER_AUTH_SECRET ??= "test-secret-minimum-32-characters-long";
process.env.BETTER_AUTH_URL ??= "http://localhost:5000";
process.env.FRONTEND_URL ??= "http://localhost:8081";
process.env.BREVO_API_KEY ??= "test-brevo-key";
process.env.CLOUDINARY_CLOUD_NAME ??= "demo";
process.env.NODE_ENV ??= "test";

const {
  computeMemePopularityScore,
  isMemeVisibleToViewer,
  MEME_CLOUDINARY_PREFIX,
  sanitizeMemeCaption,
  shouldDispatchMemeMilestoneNotification,
} = await import("../src/modules/meme/meme.domain");
const {
  createMemeReportBodySchema,
  createMemeReportByIdSchema,
  createMemeSchema,
  memeIdParamSchema,
  queryMemesSchema,
  reactMemeSchema,
  updateMemeSchema,
} = await import("../src/modules/meme/meme.schema");
const {
  memeReactionRateLimiter,
  memeReportRateLimiter,
  memeWriteRateLimiter,
} = await import("../src/modules/meme/meme.routes");
const { adminForumReportsQuerySchema } = await import(
  "../src/modules/admin/admin.schema"
);
const { publicUserSelect } = await import("../src/modules/forum/forum.domain");
const { isAllowedAppCloudinaryImageUrl } = await import(
  "../src/lib/cloudinary"
);
const { validateRequest } = await import("../src/middleware/validateRequest");

function invokeLimiter(
  limiter: any,
  userId: string | undefined,
  ip: string,
): { statusCode: number } {
  const req: any = {
    ip,
    socket: { remoteAddress: ip },
    headers: {},
    user: userId ? { id: userId } : undefined,
  };
  let statusCode = 200;
  let passed = false;
  const res: any = {
    setHeader() {},
    status(code: number) {
      statusCode = code;
      return this;
    },
    json() {
      return this;
    },
  };
  limiter(req, res, () => {
    passed = true;
  });
  return { statusCode: passed ? 200 : statusCode };
}

test("API-1: Meme Cloudinary validator accepts verified folder URLs and createMemeSchema canonicalizes delivery URL", () => {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME || "demo";
  const rawUploadUrl = `https://res.cloudinary.com/${cloud}/image/upload/v1700000000/${MEME_CLOUDINARY_PREFIX}/laugh_1.webp`;

  assert.equal(
    isAllowedAppCloudinaryImageUrl(rawUploadUrl, [MEME_CLOUDINARY_PREFIX]),
    true,
  );
  assert.equal(
    isAllowedAppCloudinaryImageUrl("https://evil.example.com/pixel.png", [
      MEME_CLOUDINARY_PREFIX,
    ]),
    false,
  );
  assert.equal(
    isAllowedAppCloudinaryImageUrl(
      `https://res.cloudinary.com/${cloud}/image/upload/smuct-unicompanion/campus-hub/marketplace/item.webp`,
      [MEME_CLOUDINARY_PREFIX],
    ),
    false,
  );
  assert.equal(
    isAllowedAppCloudinaryImageUrl(
      `https://res.cloudinary.com/${cloud}/image/upload/${MEME_CLOUDINARY_PREFIX}/../notices/item.webp`,
      [MEME_CLOUDINARY_PREFIX],
    ),
    false,
  );

  const parsed = createMemeSchema.safeParse({
    body: {
      imageUrl: rawUploadUrl,
      caption: "<b>Finals week</b>\r\n\r\n\r\nenergy<script>alert(1)</script>",
      idempotencyKey: "meme-draft-12345678",
    },
  });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(
      parsed.data.body.imageUrl,
      `https://res.cloudinary.com/${cloud}/image/upload/q_auto,f_auto,w_1000,c_limit/${MEME_CLOUDINARY_PREFIX}/laugh_1`,
    );
    assert.equal(parsed.data.body.caption, "Finals week\n\nenergy");
    assert.equal(parsed.data.body.idempotencyKey, "meme-draft-12345678");
  }
});

test("API-8: Meme per-user rate limiters isolate users behind a shared campus NAT IP", () => {
  const natIp = "103.55.12.77";

  for (let i = 0; i < 10; i++) {
    assert.equal(
      invokeLimiter(memeWriteRateLimiter, "meme-user-a", natIp).statusCode,
      200,
    );
  }
  assert.equal(
    invokeLimiter(memeWriteRateLimiter, "meme-user-a", natIp).statusCode,
    429,
  );
  assert.equal(
    invokeLimiter(memeWriteRateLimiter, "meme-user-b", natIp).statusCode,
    200,
  );

  for (let i = 0; i < 60; i++) {
    assert.equal(
      invokeLimiter(memeReactionRateLimiter, "meme-user-c", natIp).statusCode,
      200,
    );
  }
  assert.equal(
    invokeLimiter(memeReactionRateLimiter, "meme-user-c", natIp).statusCode,
    429,
  );
  assert.equal(
    invokeLimiter(memeReactionRateLimiter, "meme-user-d", natIp).statusCode,
    200,
  );

  for (let i = 0; i < 10; i++) {
    assert.equal(
      invokeLimiter(memeReportRateLimiter, "meme-user-e", natIp).statusCode,
      200,
    );
  }
  assert.equal(
    invokeLimiter(memeReportRateLimiter, "meme-user-e", natIp).statusCode,
    429,
  );
  assert.equal(
    invokeLimiter(memeReportRateLimiter, "meme-user-f", natIp).statusCode,
    200,
  );
});

test("API-4 & API-16: Meme schemas enforce UUID params, caption-only strict edit, bounds, query limit clamping, and reports", async () => {
  const validId = "11111111-1111-4111-8111-111111111111";
  const cloud = process.env.CLOUDINARY_CLOUD_NAME || "demo";

  assert.equal(
    memeIdParamSchema.safeParse({ params: { id: "not-a-uuid" } }).success,
    false,
  );
  assert.equal(
    memeIdParamSchema.safeParse({ params: { id: validId } }).success,
    true,
  );

  // Caption-only edit strictly rejects imageUrl mutations and empty updates
  assert.equal(
    updateMemeSchema.safeParse({
      params: { id: validId },
      body: {
        caption: "Updated <i>caption</i>",
        imageUrl: `https://res.cloudinary.com/${cloud}/image/upload/${MEME_CLOUDINARY_PREFIX}/other.webp`,
      },
    }).success,
    false,
  );
  assert.equal(
    updateMemeSchema.safeParse({
      params: { id: validId },
      body: {},
    }).success,
    false,
  );
  const validUpdate = updateMemeSchema.safeParse({
    params: { id: validId },
    body: { caption: "   " },
  });
  assert.equal(validUpdate.success, true);
  if (validUpdate.success) {
    assert.equal(validUpdate.data.body.caption, null);
  }

  assert.equal(
    updateMemeSchema.safeParse({
      params: { id: validId },
      body: { caption: "x".repeat(281) },
    }).success,
    false,
  );

  assert.equal(
    reactMemeSchema.safeParse({
      params: { id: "bad" },
      body: { type: "LIKE" },
    }).success,
    false,
  );
  assert.equal(
    reactMemeSchema.safeParse({
      params: { id: validId },
      body: { type: "LIKE" },
    }).success,
    true,
  );

  assert.equal(
    createMemeReportByIdSchema.safeParse({
      params: { id: validId },
      body: { reason: "HARASSMENT", details: "<b>Offensive meme</b>" },
    }).success,
    true,
  );
  assert.equal(
    createMemeReportBodySchema.safeParse({
      body: {
        targetType: "MEME_POST",
        targetId: validId,
        reason: "SPAM",
      },
    }).success,
    true,
  );

  // Query limit bounds (max 50)
  assert.equal(
    queryMemesSchema.safeParse({ query: { page: "1", limit: "51" } }).success,
    false,
  );

  const req: any = {
    query: { page: "2", limit: "15", filter: "popular" },
    body: {},
    params: {},
  };
  await new Promise<void>((resolve, reject) => {
    validateRequest(queryMemesSchema)(req, {} as any, (err?: unknown) =>
      err ? reject(err) : resolve(),
    );
  });
  assert.equal(req.query.page, 2);
  assert.equal(req.query.limit, 15);
  assert.equal(req.query.filter, "popular");
});

test("Meme domain helpers: caption sanitization, popularity score, visibility, and milestone notification guard", () => {
  assert.equal(
    sanitizeMemeCaption("Line 1\r\n\r\n\r\n<div>Line 2</div><script>x()</script>"),
    "Line 1\n\nLine 2",
  );
  assert.equal(sanitizeMemeCaption("   <br/>   "), null);

  assert.equal(computeMemePopularityScore(12, 3), 21);

  assert.equal(shouldDispatchMemeMilestoneNotification(4, 5), true);
  assert.equal(shouldDispatchMemeMilestoneNotification(6, 5), false);
  assert.equal(shouldDispatchMemeMilestoneNotification(5, 5), false);
  assert.equal(shouldDispatchMemeMilestoneNotification(9, 10), true);

  const viewer = {
    userId: "user-1",
    role: "STUDENT",
    reportedMemeIds: new Set(["reported-1"]),
  };
  assert.equal(
    isMemeVisibleToViewer(
      { id: "m-1", authorId: "other", isHiddenByModeration: false },
      viewer,
    ),
    true,
  );
  assert.equal(
    isMemeVisibleToViewer(
      { id: "reported-1", authorId: "other", isHiddenByModeration: false },
      viewer,
    ),
    false,
  );
  assert.equal(
    isMemeVisibleToViewer(
      { id: "m-hidden", authorId: "user-1", isHiddenByModeration: true },
      viewer,
    ),
    false,
  );
  assert.equal(
    isMemeVisibleToViewer(
      { id: "m-hidden", authorId: "other", isHiddenByModeration: true },
      { userId: "admin-1", role: "ADMIN", reportedMemeIds: new Set() },
    ),
    true,
  );
});

test("SHARED_CONTRACT §9.2 & Moderation: meme repository uses publicUserSelect without PII and admin queue supports MEME_POST", () => {
  assert.equal("email" in publicUserSelect, false);
  assert.equal("phoneNumber" in publicUserSelect, false);
  assert.equal("bloodGroup" in publicUserSelect, false);
  assert.equal("studentId" in publicUserSelect.studentProfile.select, false);

  const repoSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/modules/meme/meme.repository.ts"),
    "utf8",
  );
  assert.equal(repoSource.includes("publicUserSelect"), true);
  assert.equal(repoSource.includes("phoneNumber: true"), false);
  assert.equal(repoSource.includes("bloodGroup: true"), false);
  assert.equal(repoSource.includes("studentId: true"), false);
  assert.equal(repoSource.includes("popularityScore"), true);
  assert.equal(repoSource.includes("FOR UPDATE"), true);

  const uploadControllerSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/modules/upload/upload.controller.ts"),
    "utf8",
  );
  assert.equal(uploadControllerSource.includes('FROM "meme"'), true);

  const adminQuery = adminForumReportsQuerySchema.safeParse({
    query: { targetType: "MEME_POST", status: "PENDING" },
  });
  assert.equal(adminQuery.success, true);
});
