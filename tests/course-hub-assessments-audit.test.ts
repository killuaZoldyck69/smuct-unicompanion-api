import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  ASSESSMENT_STATUS_VALUES,
  MAX_ASSESSMENT_ATTACHMENTS,
  MAX_ASSESSMENT_LINKS,
  MAX_ASSESSMENT_SUBMISSIONS_LIST,
  MAX_ASSESSMENT_TOTAL_MARKS,
  MAX_BULK_GRADE_ENTRIES,
  MAX_HUB_ASSESSMENTS_LIST,
  MAX_SUBMISSION_ATTACHMENTS,
  MAX_SUBMISSION_LINKS,
  canRoleManageAssessment,
  isSafeAssessmentHttpUrl,
  isSubmissionGraded,
  resolveStudentSubmissionOutcome,
  validateAssessmentDateWindow,
} from "../src/modules/hub/assessments/assessments.domain";
import {
  assessmentParamSchema,
  bulkGradeSchema,
  createAssessmentSchema,
  gradeSubmissionSchema,
  hubAssessmentListSchema,
  submitAssessmentSchema,
  updateAssessmentSchema,
} from "../src/modules/hub/assessments/assessments.schema";

const HUB_ID = "11111111-1111-4111-8111-111111111111";
const ASSESSMENT_ID = "22222222-2222-4222-8222-222222222222";
const SUBMISSION_ID = "33333333-3333-4333-8333-333333333333";
const STUDENT_ID = "44444444-4444-4444-8444-444444444444";

test("isSafeAssessmentHttpUrl accepts valid http(s) URLs and rejects unsafe schemes", () => {
  assert.equal(isSafeAssessmentHttpUrl("https://drive.google.com/file/d/abc/view"), true);
  assert.equal(isSafeAssessmentHttpUrl("http://example.com/resource.pdf"), true);

  assert.equal(isSafeAssessmentHttpUrl("javascript:alert(1)"), false);
  assert.equal(isSafeAssessmentHttpUrl("data:text/html,<script>"), false);
  assert.equal(isSafeAssessmentHttpUrl("file:///etc/passwd"), false);
  assert.equal(isSafeAssessmentHttpUrl("https://example.com/has space"), false);
  assert.equal(isSafeAssessmentHttpUrl(""), false);
});

test("canRoleManageAssessment enforces Option A ownership", () => {
  assert.equal(
    canRoleManageAssessment({
      role: "TEACHER",
      userId: "teacher-1",
      creatorId: "cr-1",
    }),
    true,
  );
  assert.equal(
    canRoleManageAssessment({
      role: "CR",
      userId: "cr-1",
      creatorId: "cr-1",
    }),
    true,
  );
  assert.equal(
    canRoleManageAssessment({
      role: "CR",
      userId: "cr-1",
      creatorId: "teacher-1",
    }),
    false,
  );
  assert.equal(
    canRoleManageAssessment({
      role: "CR",
      userId: "cr-1",
      creatorId: null,
    }),
    false,
  );
  assert.equal(
    canRoleManageAssessment({
      role: "STUDENT",
      userId: "student-1",
      creatorId: "student-1",
    }),
    false,
  );
  assert.equal(
    canRoleManageAssessment({
      role: "ADMIN",
      userId: "admin-1",
      creatorId: "admin-1",
    }),
    false,
  );
});

test("isSubmissionGraded detects marks or GRADED status", () => {
  assert.equal(isSubmissionGraded(null), false);
  assert.equal(isSubmissionGraded({ marks: null, status: "SUBMITTED" }), false);
  assert.equal(isSubmissionGraded({ marks: 0, status: "GRADED" }), true);
  assert.equal(isSubmissionGraded({ marks: 15, status: "SUBMITTED" }), true);
  assert.equal(isSubmissionGraded({ marks: null, status: "GRADED" }), true);
});

test("validateAssessmentDateWindow requires startDate <= deadline", () => {
  const start = new Date("2026-06-01T10:00:00.000Z");
  const end = new Date("2026-06-05T10:00:00.000Z");
  assert.equal(validateAssessmentDateWindow(start, end), true);
  assert.equal(validateAssessmentDateWindow(end, end), true);
  assert.equal(validateAssessmentDateWindow(end, start), false);
  assert.equal(validateAssessmentDateWindow(null, end), true);
});

test("resolveStudentSubmissionOutcome enforces PUBLISHED status, graded lock, deadline, and mode", () => {
  const futureDeadline = new Date("2026-06-10T10:00:00.000Z");
  const pastDeadline = new Date("2026-06-01T10:00:00.000Z");
  const now = new Date("2026-06-05T10:00:00.000Z");

  // Draft / Closed / Archived blocked
  for (const status of ["DRAFT", "SCHEDULED", "CLOSED", "ARCHIVED"]) {
    const res = resolveStudentSubmissionOutcome({
      assessmentStatus: status,
      submissionType: "ONLINE",
      deadline: futureDeadline,
      allowLateSubmission: false,
      now,
    });
    assert.equal(res.ok, false);
  }

  // Graded submission cannot be overwritten
  const gradedRes = resolveStudentSubmissionOutcome({
    assessmentStatus: "PUBLISHED",
    submissionType: "ONLINE",
    deadline: futureDeadline,
    allowLateSubmission: true,
    previousSubmission: { marks: 18, status: "GRADED" },
    now,
  });
  assert.equal(gradedRes.ok, false);

  // Past deadline with allowLateSubmission = false blocked
  const closedLate = resolveStudentSubmissionOutcome({
    assessmentStatus: "PUBLISHED",
    submissionType: "ONLINE",
    deadline: pastDeadline,
    allowLateSubmission: false,
    now,
  });
  assert.equal(closedLate.ok, false);

  // Past deadline with allowLateSubmission = true computes server LATE
  const allowedLate = resolveStudentSubmissionOutcome({
    assessmentStatus: "PUBLISHED",
    submissionType: "ONLINE",
    deadline: pastDeadline,
    allowLateSubmission: true,
    now,
  });
  assert.deepEqual(allowedLate, { ok: true, status: "LATE", isLate: true });

  // ONLINE assessment rejects HAND_SUBMISSION
  const badHand = resolveStudentSubmissionOutcome({
    assessmentStatus: "PUBLISHED",
    submissionType: "ONLINE",
    deadline: futureDeadline,
    allowLateSubmission: false,
    requestedStatus: "HAND_SUBMISSION",
    now,
  });
  assert.equal(badHand.ok, false);

  // HAND assessment rejects SUBMITTED & allows HAND_SUBMISSION
  assert.equal(
    resolveStudentSubmissionOutcome({
      assessmentStatus: "PUBLISHED",
      submissionType: "HAND",
      deadline: futureDeadline,
      allowLateSubmission: false,
      requestedStatus: "SUBMITTED",
      now,
    }).ok,
    false,
  );
  assert.deepEqual(
    resolveStudentSubmissionOutcome({
      assessmentStatus: "PUBLISHED",
      submissionType: "HAND",
      deadline: futureDeadline,
      allowLateSubmission: false,
      requestedStatus: "HAND_SUBMISSION",
      now,
    }),
    { ok: true, status: "HAND_SUBMISSION", isLate: false },
  );
});

test("assessment Zod schemas enforce UUIDs, safe URLs, and approved bounds", () => {
  assert.equal(
    hubAssessmentListSchema.safeParse({
      params: { id: "not-a-uuid" },
      query: {},
    }).success,
    false,
  );
  assert.equal(
    hubAssessmentListSchema.safeParse({
      params: { id: HUB_ID },
      query: { type: "INVALID_TYPE" },
    }).success,
    false,
  );
  assert.equal(
    hubAssessmentListSchema.safeParse({
      params: { id: HUB_ID },
      query: { type: "ASSIGNMENT", status: ASSESSMENT_STATUS_VALUES[2] },
    }).success,
    true,
  );

  // Unsafe URL rejected
  assert.equal(
    createAssessmentSchema.safeParse({
      params: { id: HUB_ID },
      body: {
        title: "Homework 1",
        type: "ASSIGNMENT",
        deadline: "2026-07-01T12:00:00.000Z",
        totalMarks: 20,
        links: [{ url: "javascript:alert(1)", title: "Bad" }],
      },
    }).success,
    false,
  );

  // Too many attachments (> 10) rejected
  const elevenAttachments = Array.from({ length: MAX_ASSESSMENT_ATTACHMENTS + 1 }, (_, i) => ({
    url: `https://drive.google.com/file/d/file-${i}`,
    name: `File ${i}`,
  }));
  assert.equal(
    createAssessmentSchema.safeParse({
      params: { id: HUB_ID },
      body: {
        title: "Homework 1",
        type: "ASSIGNMENT",
        deadline: "2026-07-01T12:00:00.000Z",
        totalMarks: 20,
        attachments: elevenAttachments,
      },
    }).success,
    false,
  );

  // startDate > deadline rejected
  assert.equal(
    createAssessmentSchema.safeParse({
      params: { id: HUB_ID },
      body: {
        title: "Homework 1",
        type: "ASSIGNMENT",
        startDate: "2026-07-05T12:00:00.000Z",
        deadline: "2026-07-01T12:00:00.000Z",
        totalMarks: 20,
      },
    }).success,
    false,
  );

  // totalMarks > MAX_ASSESSMENT_TOTAL_MARKS rejected
  assert.equal(
    updateAssessmentSchema.safeParse({
      params: { id: HUB_ID, assessmentId: ASSESSMENT_ID },
      body: { totalMarks: MAX_ASSESSMENT_TOTAL_MARKS + 1 },
    }).success,
    false,
  );

  // submitAssessmentSchema rejects > 10 links and arbitrary status
  const elevenLinks = Array.from({ length: MAX_SUBMISSION_LINKS + 1 }, (_, i) => ({
    url: `https://example.com/${i}`,
    title: `L${i}`,
  }));
  assert.equal(
    submitAssessmentSchema.safeParse({
      params: { id: HUB_ID, assessmentId: ASSESSMENT_ID },
      body: { links: elevenLinks },
    }).success,
    false,
  );
  assert.equal(
    submitAssessmentSchema.safeParse({
      params: { id: HUB_ID, assessmentId: ASSESSMENT_ID },
      body: { status: "GRADED", content: "cheating" },
    }).success,
    false,
  );
  assert.equal(
    submitAssessmentSchema.safeParse({
      params: { id: HUB_ID, assessmentId: ASSESSMENT_ID },
      body: {
        status: "SUBMITTED",
        attachments: Array.from({ length: MAX_SUBMISSION_ATTACHMENTS }, (_, i) => ({
          url: `https://drive.google.com/file/d/${i}`,
          name: `f-${i}`,
        })),
      },
    }).success,
    true,
  );

  // gradeSubmission & bulkGrade bounds
  assert.equal(
    gradeSubmissionSchema.safeParse({
      params: { id: HUB_ID, submissionId: SUBMISSION_ID },
      body: { marks: 10, studentId: "bad-id" },
    }).success,
    false,
  );
  assert.equal(
    bulkGradeSchema.safeParse({
      params: { id: HUB_ID, assessmentId: ASSESSMENT_ID },
      body: Array.from({ length: MAX_BULK_GRADE_ENTRIES + 1 }, () => ({
        studentId: STUDENT_ID,
        marks: 10,
      })),
    }).success,
    false,
  );
  assert.equal(
    assessmentParamSchema.safeParse({
      params: { id: HUB_ID, assessmentId: ASSESSMENT_ID },
    }).success,
    true,
  );
});

test("assessment routes, controller, service, and repository preserve Sub-cycle 5 hardening contracts", () => {
  const baseDir = path.resolve(
    import.meta.dirname,
    "../src/modules/hub/assessments",
  );
  const routesSrc = fs.readFileSync(
    path.join(baseDir, "assessments.routes.ts"),
    "utf8",
  );
  const controllerSrc = fs.readFileSync(
    path.join(baseDir, "assessments.controller.ts"),
    "utf8",
  );
  const serviceSrc = fs.readFileSync(
    path.join(baseDir, "assessments.service.ts"),
    "utf8",
  );
  const repoSrc = fs.readFileSync(
    path.join(baseDir, "assessments.repository.ts"),
    "utf8",
  );

  // Canonical hub-scoped routes only; legacy non-:id aliases removed
  assert.equal(routesSrc.includes('"/assessments/:assessmentId/submissions"'), false);
  assert.equal(routesSrc.includes('"/assessments/:assessmentId/submit"'), false);
  assert.equal(routesSrc.includes('"/assessments/submissions/:submissionId/grade"'), false);
  assert.equal(routesSrc.includes('"/assessments/:assessmentId/bulk-grade"'), false);
  assert.ok(routesSrc.includes('"/:id/assessments/submissions/:submissionId/grade"'));
  assert.ok(routesSrc.includes("assessmentWriteLimiter"));
  assert.ok(routesSrc.includes("submissionWriteLimiter"));
  assert.ok(routesSrc.includes("gradingWriteLimiter"));
  assert.ok(routesSrc.includes("validateRequest(hubAssessmentListSchema)"));
  assert.ok(routesSrc.includes("validateRequest(assessmentParamSchema)"));

  // Controller passes req.params.id to all service methods
  const hubIdArgMatches = controllerSrc.match(/req\.params\.id as string/g) || [];
  assert.equal(hubIdArgMatches.length, 10);

  // Service enforces archived hub lock across all 7 mutations, hubId ownership check, Option A, IDOR check, and cache invalidation
  const activeHubCalls = serviceSrc.match(/await assertActiveHub\(/g) || [];
  assert.equal(activeHubCalls.length, 7);
  const cacheInvalidations = serviceSrc.match(/invalidateHubCaches\(hubId\)/g) || [];
  assert.equal(cacheInvalidations.length, 8);
  const activeStudentChecks = serviceSrc.match(/findActiveHubStudentIds\(/g) || [];
  assert.equal(activeStudentChecks.length, 2);
  assert.ok(serviceSrc.includes("canRoleManageAssessment("));
  assert.ok(serviceSrc.includes("resolveStudentSubmissionOutcome("));
  assert.ok(serviceSrc.includes("findMaxGradedMarksForAssessment("));

  // Repository uses bounded take queries and MAX_ASSESSMENT_LINKS / MAX_HUB_ASSESSMENTS_LIST invariants
  assert.ok(repoSrc.includes(`take: MAX_HUB_ASSESSMENTS_LIST`));
  assert.ok(repoSrc.includes(`take: MAX_ASSESSMENT_SUBMISSIONS_LIST`));
  assert.ok(MAX_ASSESSMENT_LINKS === 10 && MAX_SUBMISSION_LINKS === 10);
  assert.ok(MAX_HUB_ASSESSMENTS_LIST === 200 && MAX_ASSESSMENT_SUBMISSIONS_LIST === 500);
});
