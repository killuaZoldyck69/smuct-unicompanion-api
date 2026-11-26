import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  MAX_HUB_REVIEWS_LIST,
  MAX_REVIEW_ANSWER_ENTRIES,
  MAX_REVIEW_ANSWER_LENGTH,
  MAX_REVIEW_COMMENT_LENGTH,
  MAX_REVIEW_QUESTION_LENGTH,
  MAX_REVIEW_QUESTIONS,
  computeReviewStats,
  sanitizeReviewAnswers,
  sanitizeReviewQuestions,
  shuffleArray,
  toAnonymousReviewPublicItem,
} from "../src/modules/hub/reviews/reviews.domain";
import {
  editReviewSchema,
  hubIdReviewParamSchema,
  submitReviewSchema,
  updateReviewSettingsSchema,
} from "../src/modules/hub/reviews/reviews.schema";

const HUB_ID = "11111111-1111-4111-8111-111111111111";

test("reviews domain helpers sanitize questions, answers, stats, and anonymous DTOs", () => {
  const qs = sanitizeReviewQuestions([
    "  How were the labs?  ",
    "",
    "how were the labs?",
    ...Array.from({ length: MAX_REVIEW_QUESTIONS + 5 }, (_, i) => `Q${i + 1}`),
  ]);
  assert.equal(qs.length, MAX_REVIEW_QUESTIONS);
  assert.equal(qs[0], "How were the labs?");

  const ans = sanitizeReviewAnswers({
    "0": "  Very helpful ",
    "1": "   ",
    __proto__: "bad",
  } as Record<string, string>);
  assert.deepEqual(ans, { "0": "Very helpful" });
  assert.equal(sanitizeReviewAnswers({ "0": "   " }), null);

  const stats = computeReviewStats([5, 4, 5]);
  assert.equal(stats.totalReviews, 3);
  assert.equal(stats.averageRating, 4.7);
  assert.equal(stats.ratingDistribution[5], 2);
  assert.equal(stats.ratingDistribution[4], 1);

  const anon = toAnonymousReviewPublicItem({
    id: "rev-1",
    rating: 5,
    comment: "Great course",
    answers: { "0": "Yes" },
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
  });
  assert.equal(anon.isAnonymous, true);
  assert.equal(anon.student.name, "Anonymous Student");
  assert.equal("studentId" in anon, false);

  const original = [1, 2, 3, 4, 5];
  const shuffled = shuffleArray(original);
  assert.deepEqual([...shuffled].sort(), original);
});

test("review Zod schemas validate UUIDs, integer ratings, answer limits, and question caps", () => {
  assert.equal(
    hubIdReviewParamSchema.safeParse({ params: { id: "bad-uuid" } }).success,
    false,
  );
  assert.equal(
    hubIdReviewParamSchema.safeParse({ params: { id: HUB_ID } }).success,
    true,
  );

  // Float rating rejected
  assert.equal(
    submitReviewSchema.safeParse({
      params: { id: HUB_ID },
      body: { rating: 4.5 },
    }).success,
    false,
  );
  // Out of range integer rejected
  assert.equal(
    submitReviewSchema.safeParse({
      params: { id: HUB_ID },
      body: { rating: 6 },
    }).success,
    false,
  );
  // Comment too long rejected
  assert.equal(
    editReviewSchema.safeParse({
      params: { id: HUB_ID },
      body: { comment: "a".repeat(MAX_REVIEW_COMMENT_LENGTH + 1) },
    }).success,
    false,
  );
  // Too many answer entries or overly long answer rejected
  const tooManyAnswers = Object.fromEntries(
    Array.from({ length: MAX_REVIEW_ANSWER_ENTRIES + 1 }, (_, i) => [
      String(i),
      "ok",
    ]),
  );
  assert.equal(
    editReviewSchema.safeParse({
      params: { id: HUB_ID },
      body: { answers: tooManyAnswers },
    }).success,
    false,
  );
  assert.equal(
    editReviewSchema.safeParse({
      params: { id: HUB_ID },
      body: { answers: { "0": "x".repeat(MAX_REVIEW_ANSWER_LENGTH + 1) } },
    }).success,
    false,
  );
  // Valid clear on edit (null comment & null answers)
  assert.equal(
    editReviewSchema.safeParse({
      params: { id: HUB_ID },
      body: { rating: 4, comment: null, answers: null },
    }).success,
    true,
  );

  // Questions cap & length
  assert.equal(
    updateReviewSettingsSchema.safeParse({
      params: { id: HUB_ID },
      body: {
        isReviewOpen: true,
        reviewQuestions: Array.from(
          { length: MAX_REVIEW_QUESTIONS + 1 },
          (_, i) => `Q${i}`,
        ),
      },
    }).success,
    false,
  );
  assert.equal(
    updateReviewSettingsSchema.safeParse({
      params: { id: HUB_ID },
      body: {
        isReviewOpen: true,
        reviewQuestions: ["x".repeat(MAX_REVIEW_QUESTION_LENGTH + 1)],
      },
    }).success,
    false,
  );
});

test("review routes, controller, service, and repository uphold IDOR, PII, rate-limit, and archived locks", () => {
  const baseDir = path.resolve(import.meta.dirname, "../src/modules/hub/reviews");
  const routesSrc = fs.readFileSync(path.join(baseDir, "reviews.routes.ts"), "utf8");
  const controllerSrc = fs.readFileSync(path.join(baseDir, "reviews.controller.ts"), "utf8");
  const serviceSrc = fs.readFileSync(path.join(baseDir, "reviews.service.ts"), "utf8");
  const repoSrc = fs.readFileSync(path.join(baseDir, "reviews.repository.ts"), "utf8");
  const schemaSrc = fs.readFileSync(path.join(baseDir, "reviews.schema.ts"), "utf8");

  // Routes enforce rate limiters & validation on all 5 endpoints
  assert.ok(routesSrc.includes("reviewSettingsLimiter"));
  assert.ok(routesSrc.includes("reviewWriteLimiter"));
  assert.ok(routesSrc.includes("validateRequest(hubIdReviewParamSchema)"));
  const validateCalls = routesSrc.match(/validateRequest\(/g) || [];
  assert.equal(validateCalls.length, 5);

  // Controller passes req.user.id non-optionally to getReviews
  assert.equal(controllerSrc.includes("req.user?.id"), false);

  // Service enforces membership on getReviews + active hub lock + cache invalidation across all 4 writes
  assert.ok(serviceSrc.includes('verifyHubRole(userId, hubId, [\n    "TEACHER",\n    "CR",\n    "STUDENT",\n    "ADMIN",\n  ])'));
  const activeHubCalls = serviceSrc.match(/await assertActiveHub\(/g) || [];
  assert.equal(activeHubCalls.length, 4);
  const cacheCalls = serviceSrc.match(/invalidateHubCaches\(hubId\)/g) || [];
  assert.equal(cacheCalls.length, 4);
  // Option A closed window lock on submit & edit (not delete)
  const closedChecks = serviceSrc.match(/if \(!hub\.isReviewOpen\)/g) || [];
  assert.equal(closedChecks.length, 2);
  assert.equal(serviceSrc.includes("error: any"), false);

  // Repository omits student PII join, caps list at MAX_HUB_REVIEWS_LIST, and removes return await
  assert.equal(repoSrc.includes("studentProfile"), false);
  assert.equal(repoSrc.includes("email:"), false);
  assert.ok(repoSrc.includes(`take: MAX_HUB_REVIEWS_LIST`));
  assert.ok(MAX_HUB_REVIEWS_LIST === 500);
  assert.equal(repoSrc.includes("return await"), false);

  // Schema removes z.any()
  assert.equal(schemaSrc.includes("z.any()"), false);
});
