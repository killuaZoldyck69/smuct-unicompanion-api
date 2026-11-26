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

import { getMyHubsQuerySchema } from "../src/modules/hub/hub.schema";
import { buildMyHubSelect } from "../src/modules/hub/hub.repository";

test("API-16: getMyHubsQuerySchema accepts cgpa, exams, schedule, default, and empty query", () => {
  for (const view of ["cgpa", "exams", "schedule", "default"]) {
    assert.equal(getMyHubsQuerySchema.safeParse({ query: { view } }).success, true);
  }
  assert.equal(getMyHubsQuerySchema.safeParse({ query: {} }).success, true);
  assert.equal(
    getMyHubsQuerySchema.safeParse({ query: { view: "invalid" } }).success,
    false,
  );
});

test("API-19: buildMyHubSelect('cgpa') projects minimal course fields without heavy hub sub-resources", () => {
  const cgpaSelect = buildMyHubSelect("cgpa") as Record<string, unknown>;
  assert.deepEqual(cgpaSelect, {
    id: true,
    courseCode: true,
    courseName: true,
    credit: true,
    semesterNumber: true,
    termOffer: true,
    isArchived: true,
    createdAt: true,
  });

  for (const omittedField of [
    "weeklyClassSchedule",
    "termExams",
    "classNotices",
    "assessments",
    "members",
    "joinCode",
    "meetUrl",
    "isClassLive",
    "isReviewOpen",
    "reviewQuestions",
    "_count",
  ]) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(cgpaSelect, omittedField),
      false,
    );
  }
});

test("CGPA view source guards hold across controller, service, and repository", () => {
  const controllerSrc = fs.readFileSync(
    path.resolve(process.cwd(), "src/modules/hub/hub.controller.ts"),
    "utf8",
  );
  assert.match(controllerSrc, /MY_HUBS_VIEWS/);
  assert.match(controllerSrc, /MyHubsView/);

  const serviceSrc = fs.readFileSync(
    path.resolve(process.cwd(), "src/modules/hub/hub.service.ts"),
    "utf8",
  );
  assert.match(serviceSrc, /findUserRoleAndCrStatus\(userId\)/);
  assert.match(serviceSrc, /view === "cgpa" && user\?\.role !== "STUDENT"/);
  assert.equal(/\bas any\b/.test(serviceSrc), false);
  assert.equal(/\breturn await\b/.test(serviceSrc), false);

  const repoSrc = fs.readFileSync(
    path.resolve(process.cwd(), "src/modules/hub/hub.repository.ts"),
    "utf8",
  );
  assert.match(repoSrc, /export const MAX_CGPA_HUB_MEMBERSHIPS = 50;/);
  assert.match(repoSrc, /export const findUserRoleAndCrStatus/);
  assert.match(repoSrc, /MyHubsView/);
  assert.match(repoSrc, /view !== "default"/);
  assert.match(repoSrc, /take:\s*MAX_CGPA_HUB_MEMBERSHIPS/);
  assert.match(repoSrc, /orderBy:\s*\{\s*hub:\s*\{\s*createdAt:\s*"asc"/);
  assert.equal(/\bas any\b/.test(repoSrc), false);
  assert.equal(/\breturn await\b/.test(repoSrc), false);
});
