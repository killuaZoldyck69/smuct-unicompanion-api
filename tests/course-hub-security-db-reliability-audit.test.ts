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

import { envConfig } from "../src/config/env";
import {
  PROJECT_ROOT_FOLDER,
  extractPublicIdFromUrl,
} from "../src/lib/cloudinary";
import { MemoryCache } from "../src/lib/cache";
import { isCloudinaryUrl } from "../src/modules/hub/hub-attachments";

function readApiFile(relPath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), "utf8");
}

test("P0-1: extractPublicIdFromUrl and isCloudinaryUrl block spoofed external URLs, wrong cloud names, and traversal", () => {
  const configuredCloud =
    (
      envConfig.CLOUDINARY_CLOUD_NAME ||
      process.env.CLOUDINARY_CLOUD_NAME ||
      ""
    ).trim() || "demo";

  // Spoofed external URL embedding cloudinary.com + /upload/<target> in path
  const spoofedUrl =
    "https://evil.example.com/cloudinary.com/image/upload/v1/smuct-unicompanion/branding/hero.png";
  assert.equal(isCloudinaryUrl(spoofedUrl), false);
  assert.equal(extractPublicIdFromUrl(spoofedUrl), null);

  // Path traversal & encoded traversal blocked
  assert.equal(
    extractPublicIdFromUrl(
      `https://res.cloudinary.com/${configuredCloud}/image/upload/smuct-unicompanion/hubs/../notices/secret.jpg`,
    ),
    null,
  );
  assert.equal(
    extractPublicIdFromUrl(
      `https://res.cloudinary.com/${configuredCloud}/image/upload/smuct-unicompanion/hubs/%2e%2e/notices/secret.jpg`,
    ),
    null,
  );
  assert.equal(extractPublicIdFromUrl("smuct-unicompanion/../secrets/a"), null);

  // Mismatched cloud_name blocked when configured in env
  if (
    (envConfig.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME || "").trim()
  ) {
    assert.equal(
      extractPublicIdFromUrl(
        "https://res.cloudinary.com/foreign-cloud-name/image/upload/v1/smuct-unicompanion/hubs/file.png",
      ),
      null,
    );
  }

  // Valid Cloudinary URL and direct publicId extract cleanly
  const validHubUrl = `https://res.cloudinary.com/${configuredCloud}/image/upload/q_auto,f_auto/v1700000000/${PROJECT_ROOT_FOLDER}/hubs/note_1.webp`;
  assert.equal(isCloudinaryUrl(validHubUrl), true);
  assert.equal(
    extractPublicIdFromUrl(validHubUrl),
    `${PROJECT_ROOT_FOLDER}/hubs/note_1`,
  );
  assert.equal(
    extractPublicIdFromUrl(`${PROJECT_ROOT_FOLDER}/hubs/legacy_1.pdf`),
    `${PROJECT_ROOT_FOLDER}/hubs/legacy_1`,
  );
});

test("P2-3: MemoryCache.getOrSet coalesces concurrent in-flight fetches and respects mid-flight invalidation", async () => {
  const cache = new MemoryCache();
  let calls = 0;

  const [a, b, c] = await Promise.all([
    cache.getOrSet("hub:test:details", async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 15));
      return { ok: true };
    }),
    cache.getOrSet("hub:test:details", async () => {
      calls += 1;
      return { ok: false };
    }),
    cache.getOrSet("hub:test:details", async () => {
      calls += 1;
      return { ok: false };
    }),
  ]);

  assert.equal(calls, 1);
  assert.deepEqual(a, { ok: true });
  assert.deepEqual(b, { ok: true });
  assert.deepEqual(c, { ok: true });

  // Mid-flight invalidation prevents stale pre-mutation data from repopulating cache
  let resolveSlow!: (v: string) => void;
  const inflight = cache.getOrSet(
    "hub:race:details",
    () =>
      new Promise<string>((resolve) => {
        resolveSlow = resolve;
      }),
  );
  cache.delPattern(/^hub:race/);
  resolveSlow("stale-value");
  const returned = await inflight;
  assert.equal(returned, "stale-value");
  assert.equal(cache.get("hub:race:details"), undefined);
});

test("P0/P1/P2 Course Hub security, DB, archive, cache, and notification contracts hold across API files", () => {
  // P0-1 & P2-4
  const resourcesSvc = readApiFile("src/modules/hub/resources/resources.service.ts");
  assert.match(resourcesSvc, /isCloudinaryUrl\(/);
  assert.match(resourcesSvc, /extractPublicIdFromUrl\(/);
  assert.match(resourcesSvc, /\/hubs\//);
  assert.equal(resourcesSvc.includes('.includes("cloudinary.com")'), false);

  const uploadCtrl = readApiFile("src/modules/upload/upload.controller.ts");
  assert.match(uploadCtrl, /isWithinFolder/);

  // P0-2 & P2-1
  const hubPrisma = readApiFile("prisma/schema/hub.prisma");
  for (const idx of [
    "@@index([announcementId, parentId, createdAt])",
    "@@index([discussionId, createdAt])",
    "@@index([assessmentId, createdAt])",
    "@@index([hubId, createdAt])",
  ]) {
    assert.ok(hubPrisma.includes(idx), `Missing index in hub.prisma: ${idx}`);
  }

  const migrationSql = readApiFile(
    "prisma/migrations/20261127000000_add_course_hub_composite_indexes/migration.sql",
  );
  for (const idxName of [
    "HubAnnouncement_hubId_createdAt_idx",
    "HubDiscussion_hubId_createdAt_idx",
    "Resource_hubId_createdAt_idx",
    "CourseReview_hubId_createdAt_idx",
    "Submission_assessmentId_createdAt_idx",
    "AnnouncementComment_announcementId_parentId_createdAt_idx",
    "HubDiscussionReply_discussionId_createdAt_idx",
  ]) {
    assert.ok(migrationSql.includes(idxName), `Missing SQL index: ${idxName}`);
  }

  // P0-3 & P1-1
  const assessRepo = readApiFile("src/modules/hub/assessments/assessments.repository.ts");
  assert.match(assessRepo, /prisma\.submission\.groupBy\(/);
  assert.match(assessRepo, /submitAssessmentAtomic/);
  assert.match(assessRepo, /unsubmitAssessmentAtomic/);
  assert.match(assessRepo, /gradeSubmissionAtomic/);
  assert.match(assessRepo, /bulkUpsertGradesAtomic/);
  assert.match(assessRepo, /updateAssessmentAtomic/);
  assert.match(assessRepo, /FOR UPDATE OF a/);
  assert.equal(assessRepo.includes("return await"), false);

  const assessSvc = readApiFile("src/modules/hub/assessments/assessments.service.ts");
  assert.match(assessSvc, /submitAssessmentAtomic/);
  assert.match(assessSvc, /unsubmitAssessmentAtomic/);
  assert.match(assessSvc, /gradeSubmissionAtomic/);
  assert.match(assessSvc, /bulkUpsertGradesAtomic/);
  assert.match(assessSvc, /updateAssessmentAtomic/);

  const hubRepo = readApiFile("src/modules/hub/hub.repository.ts");
  assert.match(hubRepo, /joinHubMemberAtomic/);
  assert.match(hubRepo, /isArchived:\s*true,\s*isClassLive:\s*false,\s*isReviewOpen:\s*false/);
  assert.match(hubRepo, /findHubWithMembersAndDetails[\s\S]*take:\s*300/);

  const hubSvc = readApiFile("src/modules/hub/hub.service.ts");
  assert.match(hubSvc, /joinHubMemberAtomic/);
  assert.match(hubSvc, /appCache\.del\("admin:dashboard-stats"\)/);

  const membersRepo = readApiFile("src/modules/hub/members/members.repository.ts");
  assert.match(membersRepo, /updateMemberRoleAtomic/);
  assert.match(membersRepo, /deactivateMemberAtomic/);

  const membersSvc = readApiFile("src/modules/hub/members/members.service.ts");
  assert.match(membersSvc, /access\.role === "ADMIN"[\s\S]*findHubStatusById/);
  assert.match(membersSvc, /updateMemberRoleAtomic/);
  assert.match(membersSvc, /deactivateMemberAtomic/);

  // P2-2: Non-blocking notifications & bounded recipient query
  const notifSvc = readApiFile("src/modules/notification/notification.service.ts");
  assert.match(notifSvc, /MAX_HUB_NOTIFICATION_RECIPIENTS/);
  assert.match(notifSvc, /take:\s*MAX_HUB_NOTIFICATION_RECIPIENTS/);

  for (const svcFile of [
    "src/modules/hub/content/content.service.ts",
    "src/modules/hub/resources/resources.service.ts",
    "src/modules/hub/assessments/assessments.service.ts",
    "src/modules/hub/reviews/reviews.service.ts",
  ]) {
    const src = readApiFile(svcFile);
    assert.equal(
      /await\s+(?:createHubNotifications|createCourseNotificationsForRecipients)\(/.test(src),
      false,
      `Notification dispatch should be non-blocking in ${svcFile}`,
    );
  }
});
