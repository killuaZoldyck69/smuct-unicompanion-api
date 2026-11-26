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

import { isSafeHubHttpUrl } from "../src/modules/hub/hub-attachments";
import { isSafeHttpUrl } from "../src/modules/hub/content/content.domain";
import { isSafeResourceHttpUrl } from "../src/modules/hub/resources/resources.domain";
import { isSafeAssessmentHttpUrl } from "../src/modules/hub/assessments/assessments.domain";

function readApiFile(relPath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), "utf8");
}

test("Course Hub URL safety helpers unify on isSafeHubHttpUrl", () => {
  assert.equal(isSafeHttpUrl, isSafeHubHttpUrl);
  assert.equal(isSafeResourceHttpUrl, isSafeHubHttpUrl);
  assert.equal(isSafeAssessmentHttpUrl, isSafeHubHttpUrl);

  assert.equal(isSafeHubHttpUrl("https://smuct.ac.bd/syllabus.pdf"), true);
  assert.equal(isSafeHubHttpUrl("http://example.com/resource"), true);
  assert.equal(isSafeHubHttpUrl("javascript:alert(1)"), false);
  assert.equal(isSafeHubHttpUrl("data:text/html,<script>1</script>"), false);
  assert.equal(isSafeHubHttpUrl("file:///etc/passwd"), false);
  assert.equal(isSafeHubHttpUrl(""), false);
  assert.equal(isSafeHubHttpUrl(null), false);
});

test("Dead pre-atomic Course Hub repository exports are removed", () => {
  const hubRepo = readApiFile("src/modules/hub/hub.repository.ts");
  assert.equal(/\bexport const createHubMember\b/.test(hubRepo), false);

  const membersRepo = readApiFile(
    "src/modules/hub/members/members.repository.ts",
  );
  assert.equal(/\bexport const updateRole\b/.test(membersRepo), false);
  assert.equal(/\bexport const deactivateMember\b/.test(membersRepo), false);

  const assessmentsRepo = readApiFile(
    "src/modules/hub/assessments/assessments.repository.ts",
  );
  for (const deadExport of [
    "upsertSubmission",
    "upsertOfflineOrMissingSubmissionGrade",
    "markSubmissionUnsubmitted",
    "updateSubmissionGrade",
    "bulkUpsertGrades",
    "updateAssessment",
  ]) {
    assert.equal(
      new RegExp(`\\bexport const ${deadExport}\\b`).test(assessmentsRepo),
      false,
      `Expected dead export ${deadExport} to be removed`,
    );
  }
});

test("Hub services share dispatchHubNotification and touched files avoid unsafe casts or return await", () => {
  const hubService = readApiFile("src/modules/hub/hub.service.ts");
  assert.equal(/\bexport const dispatchHubNotification\b/.test(hubService), true);

  for (const servicePath of [
    "src/modules/hub/content/content.service.ts",
    "src/modules/hub/resources/resources.service.ts",
    "src/modules/hub/reviews/reviews.service.ts",
    "src/modules/hub/assessments/assessments.service.ts",
  ]) {
    const src = readApiFile(servicePath);
    assert.equal(
      src.includes("dispatchHubNotification("),
      true,
      `Expected ${servicePath} to use dispatchHubNotification`,
    );
  }

  for (const filePath of [
    "src/modules/hub/hub-attachments.ts",
    "src/modules/hub/hub.repository.ts",
    "src/modules/hub/members/members.repository.ts",
    "src/modules/hub/assessments/assessments.repository.ts",
    "src/modules/hub/hub.service.ts",
    "src/modules/hub/content/content.service.ts",
    "src/modules/hub/resources/resources.service.ts",
    "src/modules/hub/reviews/reviews.service.ts",
    "src/modules/hub/assessments/assessments.service.ts",
  ]) {
    const src = readApiFile(filePath);
    assert.equal(src.includes("as any"), false, `${filePath} must avoid as any`);
    assert.equal(
      src.includes("as unknown as"),
      false,
      `${filePath} must avoid as unknown as`,
    );
    assert.equal(
      /\breturn await\b/.test(src),
      false,
      `${filePath} must avoid return await`,
    );
  }
});
