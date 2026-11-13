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
  canCommentOnMarketplacePost,
  isMarketplaceItemVisibleToViewer,
  MARKETPLACE_CLOUDINARY_PREFIX,
  normalizeMarketplaceConditionAndPrice,
  resolveTopLevelParentCommentId,
  validateAndSanitizeMarketplaceComment,
  validateAndSanitizeMarketplaceInput,
} = await import("../src/modules/marketplace/marketplace.domain");
const {
  createMarketplaceCommentSchema,
  createMarketplaceReportSchema,
  createMarketplaceSchema,
  getMarketplaceFeedQuerySchema,
  marketplaceCommentParamSchema,
  marketplaceIdParamSchema,
  updateMarketplaceSchema,
  updateMarketplaceStatusSchema,
} = await import("../src/modules/marketplace/marketplace.schema");
const { validateRequest } = await import("../src/middleware/validateRequest");
const {
  marketplaceCommentRateLimiter,
  marketplacePostRateLimiter,
  marketplaceReportRateLimiter,
} = await import("../src/modules/marketplace/marketplace.routes");
const { adminForumReportsQuerySchema } =
  await import("../src/modules/admin/admin.schema");
const { publicUserSelect } =
  await import("../src/modules/forum/forum.domain");
const { isAllowedAppCloudinaryImageUrl } =
  await import("../src/lib/cloudinary");
const { ListingStatus, ListingType } =
  await import("../src/constants/enums");

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

test("API-1: Marketplace Cloudinary validator accepts verified folder URLs and blocks arbitrary hosts or traversal", () => {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME || "demo";
  const valid = `https://res.cloudinary.com/${cloud}/image/upload/q_auto,f_auto/${MARKETPLACE_CLOUDINARY_PREFIX}/item_1.webp`;
  assert.equal(
    isAllowedAppCloudinaryImageUrl(valid, [MARKETPLACE_CLOUDINARY_PREFIX]),
    true,
  );
  assert.equal(
    isAllowedAppCloudinaryImageUrl("https://evil.example.com/item.webp", [
      MARKETPLACE_CLOUDINARY_PREFIX,
    ]),
    false,
  );
  assert.equal(
    isAllowedAppCloudinaryImageUrl(
      `https://res.cloudinary.com/${cloud}/image/upload/smuct-unicompanion/campus-hub/lost-found/item.webp`,
      [MARKETPLACE_CLOUDINARY_PREFIX],
    ),
    false,
  );
  assert.equal(
    isAllowedAppCloudinaryImageUrl(
      `https://res.cloudinary.com/${cloud}/image/upload/${MARKETPLACE_CLOUDINARY_PREFIX}/../notices/item.webp`,
      [MARKETPLACE_CLOUDINARY_PREFIX],
    ),
    false,
  );
});

test("API-8: Marketplace rate limiters isolate users behind a shared campus NAT IP", () => {
  const natIp = "103.55.12.9";
  for (let i = 0; i < 10; i++) {
    assert.equal(invokeLimiter(marketplacePostRateLimiter, "mp-a", natIp).statusCode, 200);
  }
  assert.equal(invokeLimiter(marketplacePostRateLimiter, "mp-a", natIp).statusCode, 429);
  assert.equal(invokeLimiter(marketplacePostRateLimiter, "mp-b", natIp).statusCode, 200);

  for (let i = 0; i < 25; i++) {
    assert.equal(invokeLimiter(marketplaceCommentRateLimiter, "mp-c", natIp).statusCode, 200);
  }
  assert.equal(invokeLimiter(marketplaceCommentRateLimiter, "mp-c", natIp).statusCode, 429);
  assert.equal(invokeLimiter(marketplaceCommentRateLimiter, "mp-d", natIp).statusCode, 200);

  for (let i = 0; i < 10; i++) {
    assert.equal(invokeLimiter(marketplaceReportRateLimiter, "mp-e", natIp).statusCode, 200);
  }
  assert.equal(invokeLimiter(marketplaceReportRateLimiter, "mp-e", natIp).statusCode, 429);
  assert.equal(invokeLimiter(marketplaceReportRateLimiter, "mp-f", natIp).statusCode, 200);
});

test("API-15: Marketplace HTML sanitization neutralizes executable payloads and validates plain-text length", () => {
  const dirty =
    '<p><b>Casio fx-991EX</b></p><scr<script>ipt>alert(1)</script><img src=x onerror="fetch(1)">';
  const res = validateAndSanitizeMarketplaceInput({
    title: "<b>Casio</b> Calculator   Edition",
    description: dirty,
  });
  assert.equal(res.error, undefined);
  assert.equal(res.cleanTitle, "Casio Calculator Edition");
  assert.equal(res.cleanDescription?.includes("<script"), false);
  assert.equal(res.cleanDescription?.includes("onerror"), false);
  assert.equal(res.plainText?.startsWith("Casio fx-991EX"), true);

  const shortHtml = validateAndSanitizeMarketplaceInput({
    title: "Valid Title",
    description: "<b>Hi</b>",
  });
  assert.match(shortHtml.error ?? "", /at least 5 characters/);

  const longPlain = validateAndSanitizeMarketplaceInput({
    description: `<p>${"a".repeat(3001)}</p>`,
  });
  assert.match(longPlain.error ?? "", /cannot exceed 3,000/);

  const commentRes = validateAndSanitizeMarketplaceComment(
    '<p>Still available? <script>evil()</script></p>',
  );
  assert.equal(commentRes.cleanContent, "Still available?");
});

test("API-16: Marketplace schemas validate UUIDs, query coercion, cross-module reports, and reject invalid updates", async () => {
  const validId = "11111111-1111-4111-8111-111111111111";
  const validCommentId = "22222222-2222-4222-8222-222222222222";

  assert.equal(
    marketplaceIdParamSchema.safeParse({ params: { id: "not-uuid" } }).success,
    false,
  );
  assert.equal(
    marketplaceCommentParamSchema.safeParse({
      params: { id: validId, commentId: validCommentId },
    }).success,
    true,
  );

  assert.equal(
    updateMarketplaceSchema.safeParse({
      params: { id: validId },
      body: {},
    }).success,
    false,
  );

  assert.equal(
    updateMarketplaceSchema.safeParse({
      params: { id: validId },
      body: { price: null },
    }).success,
    false,
  );

  assert.equal(
    updateMarketplaceStatusSchema.safeParse({
      params: { id: validId },
      body: { status: "CLOSED" },
    }).success,
    true,
  );

  assert.equal(
    createMarketplaceCommentSchema.safeParse({
      params: { id: validId },
      body: { content: "Is it negotiable?", parentId: "bad-id" },
    }).success,
    false,
  );

  assert.equal(
    createMarketplaceReportSchema.safeParse({
      body: {
        targetType: "MARKETPLACE_COMMENT",
        targetId: validCommentId,
        reason: "SPAM",
      },
    }).success,
    true,
  );

  const cloud = process.env.CLOUDINARY_CLOUD_NAME || "demo";
  assert.equal(
    createMarketplaceSchema.safeParse({
      body: {
        type: "SELLING",
        title: "Engineering Drawing Board",
        description: "<p>Used once for ME101 lab.</p>",
        category: "LAB_DRAWING_TOOLS",
        condition: "LIKE_NEW",
        contactPhone: "+8801712345678",
        images: [
          `https://res.cloudinary.com/${cloud}/image/upload/${MARKETPLACE_CLOUDINARY_PREFIX}/board.webp`,
        ],
      },
    }).success,
    true,
  );

  // Feed query coercion + idempotency after validateRequest
  const req: any = {
    query: { type: "", status: "ACTIVE", limit: "25", cursor: validId },
    body: {},
    params: {},
  };
  await new Promise<void>((resolve, reject) => {
    validateRequest(getMarketplaceFeedQuerySchema)(req, {} as any, (err?: any) =>
      err ? reject(err) : resolve(),
    );
  });
  assert.equal(req.query.type, undefined);
  assert.equal(req.query.status, "ACTIVE");
  assert.equal(req.query.limit, 25);
  assert.equal(req.query.cursor, validId);

  const adminQuery = adminForumReportsQuerySchema.safeParse({
    query: { targetType: "MARKETPLACE_POST", status: "PENDING" },
  });
  assert.equal(adminQuery.success, true);
});

test("Domain rules: condition clearing on BUYING, reply flattening, status comment lock, and viewer visibility", () => {
  const buyingNormalized = normalizeMarketplaceConditionAndPrice({
    effectiveType: ListingType.BUYING,
    condition: "LIKE_NEW",
    price: null,
  });
  assert.equal(buyingNormalized.condition, null);
  assert.equal(buyingNormalized.price, 0);

  assert.equal(
    resolveTopLevelParentCommentId({ id: "reply-1", parentId: "root-1" }),
    "root-1",
  );
  assert.equal(
    resolveTopLevelParentCommentId({ id: "root-1", parentId: null }),
    "root-1",
  );

  assert.equal(canCommentOnMarketplacePost(ListingStatus.ACTIVE), true);
  assert.equal(canCommentOnMarketplacePost(ListingStatus.SOLD), false);
  assert.equal(canCommentOnMarketplacePost(ListingStatus.CLOSED), false);

  const viewer = {
    userId: "user-1",
    role: "STUDENT",
    reportedPostIds: new Set(["reported-post"]),
    reportedCommentIds: new Set(["reported-comment"]),
  };

  assert.equal(
    isMarketplaceItemVisibleToViewer(
      { id: "reported-post", authorId: "other", isHiddenByModeration: false },
      "MARKETPLACE_POST",
      viewer,
      { includeOwnHidden: true },
    ),
    false,
  );
  assert.equal(
    isMarketplaceItemVisibleToViewer(
      { id: "own-hidden", authorId: "user-1", isHiddenByModeration: true },
      "MARKETPLACE_POST",
      viewer,
      { includeOwnHidden: true },
    ),
    true,
  );
  assert.equal(
    isMarketplaceItemVisibleToViewer(
      { id: "other-hidden", authorId: "user-2", isHiddenByModeration: true },
      "MARKETPLACE_POST",
      viewer,
      { includeOwnHidden: true },
    ),
    false,
  );
  assert.equal(
    isMarketplaceItemVisibleToViewer(
      { id: "other-hidden", authorId: "user-2", isHiddenByModeration: true },
      "MARKETPLACE_POST",
      { ...viewer, role: "ADMIN" },
      { includeOwnHidden: true },
    ),
    true,
  );
});

test("API-5, PII & Media Regression Guards: no all-user broadcast, non-PII author projection, upload guard, cursor cleanup", () => {
  const apiRoot = path.resolve(import.meta.dirname, "..");

  const serviceSrc = fs.readFileSync(
    path.join(apiRoot, "src/modules/marketplace/marketplace.service.ts"),
    "utf8",
  );
  assert.equal(serviceSrc.includes("createNotificationsForAllUsers"), false);
  assert.equal(serviceSrc.includes("assertUserAcceptedUgcTerms"), true);
  assert.equal(serviceSrc.includes("deleteUnreferencedMarketplaceImages"), true);

  const repoSrc = fs.readFileSync(
    path.join(apiRoot, "src/modules/marketplace/marketplace.repository.ts"),
    "utf8",
  );
  assert.equal(repoSrc.includes("studentId"), false);
  assert.equal(repoSrc.includes("publicUserSelect"), true);
  assert.equal(
    repoSrc.includes('orderBy: [{ createdAt: "desc" }, { id: "desc" }]'),
    true,
  );

  // Canonical projection strips sensitive PII
  assert.equal("email" in publicUserSelect, false);
  assert.equal("phoneNumber" in publicUserSelect, false);
  assert.equal("studentId" in publicUserSelect.studentProfile.select, false);

  const uploadCtrlSrc = fs.readFileSync(
    path.join(apiRoot, "src/modules/upload/upload.controller.ts"),
    "utf8",
  );
  // Both owned_by_other and actively_referenced blocks check marketplace_post
  assert.equal(
    uploadCtrlSrc.split('"marketplace_post"').length - 1 >= 4,
    true,
  );

  const orphanSrc = fs.readFileSync(
    path.join(apiRoot, "src/services/orphan-cleanup.service.ts"),
    "utf8",
  );
  const mpSection = orphanSrc.slice(
    orphanSrc.indexOf("cleanupMarketplaceOrphanImages"),
    orphanSrc.indexOf("cleanupLostFoundOrphanImages"),
  );
  assert.equal(mpSection.includes("DB_BATCH_SIZE"), true);
  assert.equal(mpSection.includes("cursor:"), true);
});
