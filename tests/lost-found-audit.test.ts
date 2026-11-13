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
  buildLostFoundUpdateData,
  isLostFoundPostVisibleToViewer,
  sanitizeLostFoundPostDetail,
} = await import("../src/modules/lost-found/lost-found.domain");
const {
  createLostFoundSchema,
  createClaimSchema,
  createLostFoundReportSchema,
  getFeedQuerySchema,
  lostFoundIdParamSchema,
  lostFoundClaimParamSchema,
  updateLostFoundStatusSchema,
} = await import("../src/modules/lost-found/lost-found.schema");
const { validateRequest } = await import("../src/middleware/validateRequest");
const { claimRateLimiter, postRateLimiter } =
  await import("../src/modules/lost-found/lost-found.routes");
const { adminForumReportsQuerySchema } =
  await import("../src/modules/admin/admin.schema");
const { isAllowedAppCloudinaryImageUrl } =
  await import("../src/lib/cloudinary");
const { escapeHtml } = await import("../src/utils/html");
const { LostFoundStatus, LostFoundType } =
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

test("API-1: Lost & Found Cloudinary validator blocks arbitrary hosts, http://, traversal, and foreign folders", () => {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME || "demo";
  const valid = `https://res.cloudinary.com/${cloud}/image/upload/q_auto,f_auto/smuct-unicompanion/campus-hub/lost-found/claims/proof_1.jpg`;
  assert.equal(
    isAllowedAppCloudinaryImageUrl(valid, [
      "smuct-unicompanion/campus-hub/lost-found",
    ]),
    true,
  );
  assert.equal(
    isAllowedAppCloudinaryImageUrl("https://evil.example.com/a.jpg", [
      "smuct-unicompanion/campus-hub/lost-found",
    ]),
    false,
  );
  assert.equal(
    isAllowedAppCloudinaryImageUrl(
      `https://res.cloudinary.com/${cloud}/image/upload/smuct-unicompanion/notices/secret.jpg`,
      ["smuct-unicompanion/campus-hub/lost-found"],
    ),
    false,
  );
  assert.equal(
    isAllowedAppCloudinaryImageUrl(
      `https://res.cloudinary.com/${cloud}/image/upload/smuct-unicompanion/campus-hub/lost-found/../notices/secret.jpg`,
      ["smuct-unicompanion/campus-hub/lost-found"],
    ),
    false,
  );
});

test("API-8: Lost & Found post and claim rate limiters isolate users behind shared campus NAT IP", () => {
  const sharedIp = "103.50.10.2";
  for (let i = 0; i < 5; i++) {
    assert.equal(
      invokeLimiter(claimRateLimiter, "lf-nat-user-a", sharedIp).statusCode,
      200,
    );
  }
  assert.equal(
    invokeLimiter(claimRateLimiter, "lf-nat-user-a", sharedIp).statusCode,
    429,
  );
  assert.equal(
    invokeLimiter(claimRateLimiter, "lf-nat-user-b", sharedIp).statusCode,
    200,
  );
  assert.equal(
    invokeLimiter(postRateLimiter, "lf-nat-user-c", sharedIp).statusCode,
    200,
  );
});

test("API-16 & Schema hardening: trims whitespace, validates UUID params, and supports LOST_FOUND_POST moderation", () => {
  assert.equal(
    createLostFoundSchema.safeParse({
      body: { type: "LOST", title: "   ", category: "KEYS" },
    }).success,
    false,
  );
  assert.equal(
    lostFoundIdParamSchema.safeParse({ params: { id: "bad-id" } }).success,
    false,
  );
  assert.equal(
    lostFoundClaimParamSchema.safeParse({
      params: {
        id: "11111111-1111-4111-8111-111111111111",
        claimId: "bad-claim-id",
      },
    }).success,
    false,
  );
  assert.equal(
    createClaimSchema.safeParse({
      params: { id: "11111111-1111-4111-8111-111111111111" },
      body: { message: "   ", proofImage: null },
    }).success,
    false,
  );
  assert.equal(
    updateLostFoundStatusSchema.safeParse({
      params: { id: "11111111-1111-4111-8111-111111111111" },
      body: { status: "CLOSED" },
    }).success,
    true,
  );
  assert.equal(
    createLostFoundReportSchema.safeParse({
      params: { id: "11111111-1111-4111-8111-111111111111" },
      body: { reason: "SPAM", details: "Fake post" },
    }).success,
    true,
  );
  assert.equal(
    adminForumReportsQuerySchema.safeParse({
      query: { targetType: "LOST_FOUND_POST" },
    }).success,
    true,
  );
});

test("Domain correctness: Admin edits preserve verificationAnswer, reopening revokes handover, and HTML escapes", () => {
  const adminPayload = buildLostFoundUpdateData(
    { title: "Updated", verificationQuestion: "X", verificationAnswer: null },
    LostFoundType.FOUND,
    false,
  );
  assert.equal("verificationAnswer" in adminPayload, false);
  assert.equal("verificationQuestion" in adminPayload, false);

  const reopened = sanitizeLostFoundPostDetail({
    post: {
      id: "11111111-1111-4111-8111-111111111111",
      authorId: "author-1",
      status: LostFoundStatus.ACTIVE,
      resolvedClaimId: null,
      verificationAnswer: "secret",
      author: {
        id: "author-1",
        name: "Author",
        email: "author@smuct.edu.bd",
        phoneNumber: "+8801700000001",
        image: "",
        studentProfile: null,
        teacherProfile: null,
      },
      claims: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          claimantId: "claimant-1",
          claimant: {
            id: "claimant-1",
            name: "Claimant",
            email: "c@smuct.edu.bd",
            phoneNumber: null,
            image: "",
            studentProfile: null,
            teacherProfile: null,
          },
        },
      ],
    },
    viewerId: "claimant-1",
    viewerRole: "STUDENT",
    myClaim: null,
  });

  assert.equal(reopened.handoverData, null);
  assert.equal("email" in reopened.author, false);
  assert.equal("verificationAnswer" in reopened, false);
  assert.equal(
    isLostFoundPostVisibleToViewer(
      { id: "p1", authorId: "u1", isHiddenByModeration: false },
      { userId: "u2", reportedPostIds: new Set(["p1"]) },
    ),
    false,
  );
  assert.equal(escapeHtml(`<b>"hi"</b>`), "&lt;b&gt;&quot;hi&quot;&lt;/b&gt;");
});

test("Hardening source guards & PII/concurrency fixes: studentId redaction, P2002 hiding, soft-withdraw, atomic locks, upload bounds", async () => {
  const { formatErrorResponse } =
    await import("../src/middleware/globalErrorHandler");
  const { Prisma } = await import("../generated/prisma/client");
  const { validateImageFile, uploadSingleImageService } =
    await import("../src/modules/upload/upload.service");

  // Verify author studentId, _count, and resolvedClaimId are stripped for unrelated viewers
  const redactedDetail = sanitizeLostFoundPostDetail({
    post: {
      id: "11111111-1111-4111-8111-111111111111",
      authorId: "author-1",
      status: LostFoundStatus.RESOLVED,
      resolvedClaimId: "22222222-2222-4222-8222-222222222222",
      verificationAnswer: "secret",
      _count: { claims: 3 },
      author: {
        id: "author-1",
        name: "Author",
        email: "author@smuct.edu.bd",
        phoneNumber: "+8801700000001",
        image: "",
        studentProfile: {
          studentId: "223000111",
          department: "CSE",
          batch: "32",
          currentSemester: "6th",
          section: "A",
        },
        teacherProfile: null,
      },
      claims: [],
    },
    viewerId: "unrelated-student",
    viewerRole: "STUDENT",
    myClaim: null,
  });
  assert.equal(
    "studentId" in (redactedDetail.author.studentProfile ?? {}),
    false,
  );
  assert.equal(redactedDetail.author.studentProfile?.department, "CSE");
  assert.equal("_count" in redactedDetail, false);
  assert.equal("resolvedClaimId" in redactedDetail, false);

  // Verify P2002 does not leak raw database column targets
  const dupErr = new Prisma.PrismaClientKnownRequestError("Unique failed", {
    code: "P2002",
    clientVersion: "7.8.0",
    meta: { target: ["postId", "claimantId"] },
  });
  const dupPayload = formatErrorResponse(dupErr, {
    method: "POST",
    originalUrl: "/api/lost-found/1/claims",
  });
  assert.equal(dupPayload.statusCode, 409);
  assert.equal(dupPayload.body.message.includes("claimantId"), false);

  // Verify magic bytes & folder allowlist on uploads
  assert.throws(
    () =>
      validateImageFile({
        fieldname: "image",
        originalname: "fake.png",
        encoding: "7bit",
        mimetype: "image/png",
        size: 100,
        buffer: Buffer.from("not-an-image"),
      }),
    /Invalid or corrupted image/,
  );
  await assert.rejects(
    () => uploadSingleImageService(undefined, undefined, "notices", false),
    /Forbidden/,
  );

  const repoSrc = fs.readFileSync(
    path.join(process.cwd(), "src/modules/lost-found/lost-found.repository.ts"),
    "utf8",
  );
  const serviceSrc = fs.readFileSync(
    path.join(process.cwd(), "src/modules/lost-found/lost-found.service.ts"),
    "utf8",
  );
  const uploadCtrlSrc = fs.readFileSync(
    path.join(process.cwd(), "src/modules/upload/upload.controller.ts"),
    "utf8",
  );
  const uploadRoutesSrc = fs.readFileSync(
    path.join(process.cwd(), "src/modules/upload/upload.routes.ts"),
    "utf8",
  );

  assert.match(repoSrc, /FOR UPDATE/);
  assert.match(repoSrc, /FROM "user" WHERE id = \$\{claimantId\} FOR UPDATE/);
  assert.match(repoSrc, /status: LostFoundClaimStatus\.WITHDRAWN/);
  assert.match(repoSrc, /rejectClaimAtomicInDb/);
  assert.match(repoSrc, /updateLostFoundPostAtomicInDb/);
  assert.match(serviceSrc, /UGC_TERMS_REQUIRED/);
  assert.match(serviceSrc, /dispatchEmailSafe/);
  assert.match(uploadCtrlSrc, /owned_by_other/);
  assert.match(uploadCtrlSrc, /actively_referenced/);
  assert.match(uploadRoutesSrc, /fileSize:\s*5\s*\*\s*1024\s*\*\s*1024/);
});

test("Feed query validation: coerces string pagination, remains idempotent after validateRequest, and rejects invalid bounds", async () => {
  const middleware = validateRequest(getFeedQuerySchema);
  const req: any = {
    body: {},
    params: {},
    query: { page: "1", limit: "15", myPosts: "false" },
  };

  let passedErr: unknown = null;
  await middleware(req, {} as any, (err?: unknown) => {
    passedErr = err ?? null;
  });

  assert.equal(passedErr, null);
  assert.deepEqual(req.query, { page: 1, limit: 15, myPosts: "false" });
  assert.equal(
    getFeedQuerySchema.safeParse({ query: req.query }).success,
    true,
  );
  assert.equal(
    getFeedQuerySchema.safeParse({ query: { page: "0", limit: "15" } }).success,
    false,
  );
  assert.equal(
    getFeedQuerySchema.safeParse({ query: { page: "abc", limit: "15" } }).success,
    false,
  );
  assert.equal(
    getFeedQuerySchema.safeParse({ query: { page: "1", limit: "101" } }).success,
    false,
  );
});

test("Security & reliability audit regression guards: URL length/traversal, empty PATCH, email subject sanitization, ownership & atomic deletion", async () => {
  const { updateLostFoundSchema } =
    await import("../src/modules/lost-found/lost-found.schema");
  const { buildNewClaimEmail } =
    await import("../src/modules/lost-found/lost-found.email-templates");
  const { lostFoundFeedSelect } =
    await import("../src/modules/lost-found/lost-found.projections");

  const cloud = process.env.CLOUDINARY_CLOUD_NAME || "demo";

  // Reject %2e%2e traversal in Cloudinary URL
  assert.equal(
    isAllowedAppCloudinaryImageUrl(
      `https://res.cloudinary.com/${cloud}/image/upload/smuct-unicompanion/campus-hub/lost-found/%2e%2e/notices/secret.jpg`,
      ["smuct-unicompanion/campus-hub/lost-found"],
    ),
    false,
  );

  // Reject over-long image URLs (> 1000 chars) on post creation
  assert.equal(
    createLostFoundSchema.safeParse({
      body: {
        type: "LOST",
        title: "Backpack",
        category: "BAGS",
        images: [
          `https://res.cloudinary.com/${cloud}/image/upload/smuct-unicompanion/campus-hub/lost-found/${"a".repeat(1000)}.jpg`,
        ],
      },
    }).success,
    false,
  );

  // Accept valid optional idempotencyKey and reject empty PATCH updates
  assert.equal(
    createLostFoundSchema.safeParse({
      body: {
        type: "LOST",
        title: "Backpack",
        category: "BAGS",
        idempotencyKey: "lf-12345678-abcd",
      },
    }).success,
    true,
  );
  assert.equal(
    updateLostFoundSchema.safeParse({
      params: { id: "11111111-1111-4111-8111-111111111111" },
      body: {},
    }).success,
    false,
  );

  // Strip CR/LF control chars from email subject lines
  const email = buildNewClaimEmail({
    authorName: "Alice",
    postTitle: "Wallet\r\nBcc: evil@example.com",
    claimantName: "Bob",
    message: "Found near library",
  });
  assert.equal(/[\r\n]/.test(email.subject), false);

  // Feed select avoids full profile joins and private verification questions
  assert.equal("author" in lostFoundFeedSelect, false);
  assert.equal("verificationQuestion" in lostFoundFeedSelect, false);

  const repoSrc = fs.readFileSync(
    path.join(process.cwd(), "src/modules/lost-found/lost-found.repository.ts"),
    "utf8",
  );
  const serviceSrc = fs.readFileSync(
    path.join(process.cwd(), "src/modules/lost-found/lost-found.service.ts"),
    "utf8",
  );
  const uploadSvcSrc = fs.readFileSync(
    path.join(process.cwd(), "src/modules/upload/upload.service.ts"),
    "utf8",
  );
  const modRepoSrc = fs.readFileSync(
    path.join(
      process.cwd(),
      "src/modules/lost-found/lost-found.moderation.repository.ts",
    ),
    "utf8",
  );

  assert.match(repoSrc, /assertNoForeignLostFoundMediaReferencesInTx/);
  assert.match(repoSrc, /deleteLostFoundPostAtomicInDb/);
  assert.match(repoSrc, /Resolved or closed listings cannot be edited/);
  assert.match(repoSrc, /Please answer the finder's verification question/);
  assert.match(repoSrc, /claimantEmail/);
  assert.match(serviceSrc, /deleteUnreferencedLostFoundImages/);
  assert.match(serviceSrc, /isLostFoundPostVisibleToViewer/);
  assert.match(
    serviceSrc,
    /updatePostService[\s\S]*?assertUserAcceptedUgcTerms\(userId\)/,
  );
  assert.match(uploadSvcSrc, /Promise\.allSettled/);
  assert.match(modRepoSrc, /tx\.lostFoundPost\.findUnique/);

  // Empty-string filter normalization, page upper bound, and Cloudinary URL canonicalization
  const emptyFilters = getFeedQuerySchema.safeParse({
    query: {
      type: "",
      status: "",
      category: "",
      search: "   ",
      myPosts: "",
      page: "",
      limit: "",
    },
  });
  assert.equal(emptyFilters.success, true);
  assert.equal(
    getFeedQuerySchema.safeParse({ query: { page: "1001" } }).success,
    false,
  );

  const canonicalizedPost = createLostFoundSchema.safeParse({
    body: {
      type: "LOST",
      title: "Student ID",
      category: "ID_CARD",
      images: [
        `https://res.cloudinary.com/${cloud}/image/upload/smuct-unicompanion/campus-hub/lost-found/raw_sample.jpg`,
      ],
    },
  });
  assert.equal(canonicalizedPost.success, true);
  if (canonicalizedPost.success) {
    assert.equal(
      canonicalizedPost.data.body.images[0],
      `https://res.cloudinary.com/${cloud}/image/upload/q_auto,f_auto,w_1000,c_limit/smuct-unicompanion/campus-hub/lost-found/raw_sample`,
    );
  }
});
