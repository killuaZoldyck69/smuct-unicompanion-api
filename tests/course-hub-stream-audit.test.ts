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
process.env.EMAIL_FROM ??= "no-reply@example.com";
process.env.NODE_ENV ??= "test";

import {
  DEFAULT_ANNOUNCEMENTS_LIMIT,
  MAX_ANNOUNCEMENT_ATTACHMENTS,
  MAX_ANNOUNCEMENT_HTML_LENGTH,
  MAX_ANNOUNCEMENT_PLAIN_LENGTH,
  MAX_ANNOUNCEMENTS_LIMIT,
  MAX_COMMENT_LENGTH,
  isSafeHttpUrl,
  sanitizeAnnouncementHtml,
  sanitizePlainTextInput,
  validateAndSanitizeAnnouncementContent,
} from "../src/modules/hub/content/content.domain";
import {
  announcementParamSchema,
  commentAnnouncementSchema,
  commentParamSchema,
  createAnnouncementSchema,
  createDiscussionSchema,
  getAnnouncementsQuerySchema,
  hubContentParamSchema,
  replyDiscussionSchema,
  updateAnnouncementCommentSchema,
  updateAnnouncementSchema,
} from "../src/modules/hub/content/content.schema";
import {
  announcementWriteLimiter,
  contentInteractionLimiter,
} from "../src/modules/hub/content/content.routes";

const VALID_HUB_ID = "11111111-1111-4111-8111-111111111111";
const VALID_ANNOUNCEMENT_ID = "22222222-2222-4222-8222-222222222222";
const VALID_COMMENT_ID = "33333333-3333-4333-8333-333333333333";
const VALID_DISCUSSION_ID = "44444444-4444-4444-8444-444444444444";

function readApiFile(relPath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), "utf8");
}

test("API-15/16: Stream domain enforces safe HTTP(S) URLs and HTML sanitization", () => {
  assert.equal(isSafeHttpUrl("https://drive.google.com/file/d/123/view"), true);
  assert.equal(isSafeHttpUrl("http://example.com/resource"), true);
  assert.equal(isSafeHttpUrl("javascript:alert(1)"), false);
  assert.equal(isSafeHttpUrl("data:text/html,<script>alert(1)</script>"), false);
  assert.equal(isSafeHttpUrl("file:///etc/passwd"), false);
  assert.equal(isSafeHttpUrl("ftp://example.com/file"), false);

  const dirtyHtml =
    '<p><strong>Exam</strong> at 10am</p><script>alert("xss")</script><img src=x onerror=alert(1)>';
  const cleaned = sanitizeAnnouncementHtml(dirtyHtml);
  assert.equal(cleaned.includes("<script>"), false);
  assert.equal(cleaned.includes("onerror"), false);
  assert.equal(cleaned, "<p><strong>Exam</strong> at 10am</p>");

  const emptyMarkup = validateAndSanitizeAnnouncementContent("<p><br></p>");
  assert.ok(emptyMarkup.error);

  const tooLongPlain = validateAndSanitizeAnnouncementContent(
    `<p>${"a".repeat(MAX_ANNOUNCEMENT_PLAIN_LENGTH + 1)}</p>`,
  );
  assert.ok(tooLongPlain.error);

  const validContent = validateAndSanitizeAnnouncementContent(
    '<p style="text-align: center"><b>Class Update</b><br/>Room 402</p>',
  );
  assert.equal(validContent.error, undefined);
  assert.ok(validContent.cleanHtml?.includes('style="text-align: center"'));
  assert.equal(validContent.plainText, "Class Update Room 402");

  const sanitizedComment = sanitizePlainTextInput(
    "  <b>Hello</b> <script>bad()</script>world  ",
    MAX_COMMENT_LENGTH,
    "Comment",
  );
  assert.equal(sanitizedComment.cleanText, "Hello world");

  const oversizedComment = sanitizePlainTextInput(
    "x".repeat(MAX_COMMENT_LENGTH + 1),
    MAX_COMMENT_LENGTH,
    "Comment",
  );
  assert.ok(oversizedComment.error);
});

test("API-16: Stream Zod schemas enforce strict UUID params, bounded query, and safe URLs", () => {
  assert.equal(
    hubContentParamSchema.safeParse({ params: { id: "bad-id" } }).success,
    false,
  );
  assert.equal(
    announcementParamSchema.safeParse({
      params: { id: VALID_HUB_ID, announcementId: "not-uuid" },
    }).success,
    false,
  );
  assert.equal(
    commentParamSchema.safeParse({
      params: {
        id: VALID_HUB_ID,
        announcementId: VALID_ANNOUNCEMENT_ID,
        commentId: "bad",
      },
    }).success,
    false,
  );

  assert.equal(
    getAnnouncementsQuerySchema.safeParse({
      params: { id: VALID_HUB_ID },
      query: { page: "2", limit: String(MAX_ANNOUNCEMENTS_LIMIT) },
    }).success,
    true,
  );
  assert.equal(
    getAnnouncementsQuerySchema.safeParse({
      params: { id: VALID_HUB_ID },
      query: { page: "abc", limit: "200" },
    }).success,
    false,
  );

  assert.equal(
    createAnnouncementSchema.safeParse({
      params: { id: VALID_HUB_ID },
      body: {
        content: "<p>Valid announcement</p>",
        attachedLinkUrl: "javascript:alert(1)",
      },
    }).success,
    false,
  );

  const tooManyAttachments = Array.from(
    { length: MAX_ANNOUNCEMENT_ATTACHMENTS + 1 },
    (_, i) => ({ url: `https://drive.google.com/file/d/${i}/view` }),
  );
  assert.equal(
    createAnnouncementSchema.safeParse({
      params: { id: VALID_HUB_ID },
      body: {
        content: "<p>Valid announcement</p>",
        attachments: tooManyAttachments,
      },
    }).success,
    false,
  );

  assert.equal(
    createAnnouncementSchema.safeParse({
      params: { id: VALID_HUB_ID },
      body: {
        content: "x".repeat(MAX_ANNOUNCEMENT_HTML_LENGTH + 1),
      },
    }).success,
    false,
  );

  assert.equal(
    updateAnnouncementSchema.safeParse({
      params: { id: VALID_HUB_ID, announcementId: VALID_ANNOUNCEMENT_ID },
      body: { attachedLinkUrl: null, attachedLinkTitle: null },
    }).success,
    true,
  );

  assert.equal(
    commentAnnouncementSchema.safeParse({
      params: { id: VALID_HUB_ID, announcementId: VALID_ANNOUNCEMENT_ID },
      body: { content: "x".repeat(MAX_COMMENT_LENGTH + 1) },
    }).success,
    false,
  );

  assert.equal(
    updateAnnouncementCommentSchema.safeParse({
      params: {
        id: VALID_HUB_ID,
        announcementId: VALID_ANNOUNCEMENT_ID,
        commentId: VALID_COMMENT_ID,
      },
      body: { content: "Updated comment" },
    }).success,
    true,
  );

  assert.equal(
    createDiscussionSchema.safeParse({
      params: { id: VALID_HUB_ID },
      body: { title: "Question", content: "Details here" },
    }).success,
    true,
  );

  assert.equal(
    replyDiscussionSchema.safeParse({
      params: { id: VALID_HUB_ID, discussionId: VALID_DISCUSSION_ID },
      body: { content: "Helpful answer" },
    }).success,
    true,
  );
});

test("API-8: content rate limiters isolate per-user quotas behind shared campus NAT IP", async () => {
  const makeReq = (userId: string) =>
    ({
      ip: "203.0.113.30",
      user: { id: userId },
      headers: {},
      app: { get: () => false },
    }) as any;

  for (const [limiter, cap, prefix] of [
    [announcementWriteLimiter, 20, "ann"],
    [contentInteractionLimiter, 40, "comment"],
  ] as const) {
    let blockedStatus = 0;
    for (let i = 0; i < cap + 1; i += 1) {
      await new Promise<void>((resolve) => {
        const res = {
          setHeader: () => res,
          status: (code: number) => {
            blockedStatus = code;
            return res;
          },
          json: () => {
            resolve();
            return res;
          },
        } as any;
        (limiter as any)(makeReq(`${prefix}-user-1`), res, () => resolve());
      });
    }
    assert.equal(blockedStatus, 429);

    let otherAllowed = false;
    await new Promise<void>((resolve) => {
      const res = {
        setHeader: () => res,
        status: () => res,
        json: () => {
          resolve();
          return res;
        },
      } as any;
      (limiter as any)(makeReq(`${prefix}-user-2`), res, () => {
        otherAllowed = true;
        resolve();
      });
    });
    assert.equal(otherAllowed, true);
  }
});

test("API-6 & Stream contract: read guards, cross-hub IDOR checks, archived locks, and dead route cleanup", () => {
  const routesSrc = readApiFile("src/modules/hub/content/content.routes.ts");
  const controllerSrc = readApiFile("src/modules/hub/content/content.controller.ts");
  const serviceSrc = readApiFile("src/modules/hub/content/content.service.ts");
  const repoSrc = readApiFile("src/modules/hub/content/content.repository.ts");
  const schemaSrc = readApiFile("src/modules/hub/content/content.schema.ts");
  const prismaSrc = readApiFile("prisma/schema/hub.prisma");

  // No legacy /content/ route aliases or circular hub.routes imports
  assert.equal(routesSrc.includes("/content/"), false);
  assert.equal(routesSrc.includes("hub.routes"), false);
  assert.match(routesSrc, /validateRequest\(getAnnouncementsQuerySchema\)/);
  assert.match(routesSrc, /validateRequest\(announcementParamSchema\)/);
  assert.match(routesSrc, /validateRequest\(commentParamSchema\)/);
  assert.match(routesSrc, /validateRequest\(hubContentParamSchema\)/);

  // Dead createAnnouncementComment removed everywhere
  assert.equal(controllerSrc.includes("createAnnouncementComment"), false);
  assert.equal(serviceSrc.includes("export const createAnnouncementComment"), false);
  assert.equal(schemaSrc.includes("createAnnouncementCommentSchema"), false);

  // Membership, cross-hub IDOR, and archived hub locks verified
  assert.match(serviceSrc, /getAnnouncements[\s\S]*?verifyHubRole\(userId,\s*hubId,\s*\["TEACHER",\s*"CR",\s*"STUDENT",\s*"ADMIN"\]\)/);
  assert.match(serviceSrc, /getDiscussions[\s\S]*?verifyHubRole\(userId,\s*hubId,\s*\["TEACHER",\s*"CR",\s*"STUDENT",\s*"ADMIN"\]\)/);
  assert.match(serviceSrc, /editAnnouncementComment[\s\S]*?verifyHubRole\(userId,\s*hubId,\s*\["TEACHER",\s*"CR",\s*"STUDENT"\]\)/);
  assert.match(serviceSrc, /removeAnnouncementComment[\s\S]*?verifyHubRole\(userId,\s*hubId,\s*\["TEACHER",\s*"CR",\s*"STUDENT"\]\)/);
  assert.match(serviceSrc, /updateAnnouncement[\s\S]*?verifyHubRole\(userId,\s*hubId,\s*\["TEACHER",\s*"CR"\]\)/);
  assert.match(serviceSrc, /deleteAnnouncement[\s\S]*?verifyHubRole\(userId,\s*hubId,\s*\["TEACHER",\s*"CR"\]\)/);
  assert.match(serviceSrc, /discussion\.hubId !== hubId/);
  assert.match(serviceSrc, /announcement\.hubId !== hubId/);

  const assertActiveHubCount = (serviceSrc.match(/assertActiveHub\(/g) || []).length;
  assert.ok(
    assertActiveHubCount >= 8,
    `Expected assertActiveHub on all 8 content mutations, got ${assertActiveHubCount}`,
  );

  // Repository bounds and index
  assert.ok(repoSrc.includes(String(DEFAULT_ANNOUNCEMENTS_LIMIT)) || repoSrc.includes("DEFAULT_ANNOUNCEMENTS_LIMIT"));
  assert.match(repoSrc, /isActive:\s*true/);
  assert.equal(repoSrc.includes("as any"), false);
  assert.match(prismaSrc, /model HubAnnouncement[\s\S]*@@index\(\[hubId, createdAt\]\)/);
});
