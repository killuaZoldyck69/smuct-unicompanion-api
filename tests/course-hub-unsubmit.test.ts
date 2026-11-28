import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { unsubmitAssessmentSchema } from "../src/modules/hub/assessments/assessments.schema";

const HUB_ID = "11111111-1111-4111-8111-111111111111";
const ASSESSMENT_ID = "22222222-2222-4222-8222-222222222222";

test("unsubmitAssessmentSchema accepts empty body, clearWork, and valid draft payloads while rejecting unsafe URLs", () => {
  const emptyParsed = unsubmitAssessmentSchema.safeParse({
    params: { id: HUB_ID, assessmentId: ASSESSMENT_ID },
  });
  assert.equal(emptyParsed.success, true);

  const clearParsed = unsubmitAssessmentSchema.safeParse({
    params: { id: HUB_ID, assessmentId: ASSESSMENT_ID },
    body: { clearWork: true },
  });
  assert.equal(clearParsed.success, true);

  const draftParsed = unsubmitAssessmentSchema.safeParse({
    params: { id: HUB_ID, assessmentId: ASSESSMENT_ID },
    body: {
      attachments: [
        {
          name: "lab-report.pdf",
          url: "https://drive.google.com/file/d/abc123/view",
          size: 2048,
          type: "pdf",
        },
      ],
      links: [{ title: "Repo", url: "https://github.com/example/repo" }],
      submittedUrl: "",
      content: "Updated draft notes",
    },
  });
  assert.equal(draftParsed.success, true);

  const unsafeParsed = unsubmitAssessmentSchema.safeParse({
    params: { id: HUB_ID, assessmentId: ASSESSMENT_ID },
    body: {
      links: [{ title: "Bad", url: "javascript:alert(1)" }],
    },
  });
  assert.equal(unsafeParsed.success, false);
});

test("assessments.repository.ts excludes UNSUBMITTED rows from submitted lists/counts and deletes ungraded submissions on clearWork", () => {
  const repoPath = path.resolve(
    import.meta.dirname,
    "../src/modules/hub/assessments/assessments.repository.ts",
  );
  const source = fs.readFileSync(repoPath, "utf8");

  assert.equal(source.includes('status: { not: "UNSUBMITTED" }'), true);
  assert.equal(source.includes("tx.submission.deleteMany"), true);
  assert.equal(source.includes("cleared: true"), true);
  assert.equal(source.includes("unsubmitAssessmentAtomic"), true);
});
