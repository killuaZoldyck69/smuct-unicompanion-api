import { Router } from "express";
import { requireAuth } from "../../../middleware/auth.middleware";
import {
  createUserKeyGenerator,
  rateLimit,
} from "../../../middleware/rateLimit.middleware";
import { validateRequest } from "../../../middleware/validateRequest";
import {
  assessmentParamSchema,
  bulkGradeSchema,
  createAssessmentSchema,
  gradeSubmissionSchema,
  hubAssessmentListSchema,
  submitAssessmentSchema,
  unsubmitAssessmentSchema,
  updateAssessmentSchema,
} from "./assessments.schema";
import {
  bulkGrade,
  createAssessment,
  deleteAssessment,
  getAssessmentById,
  getAssessments,
  getAssessmentSubmissions,
  gradeSubmission,
  submitAssessment,
  unsubmitAssessment,
  updateAssessment,
} from "./assessments.controller";

const router = Router({ mergeParams: true });

// Dedicated per-user limiters protect notification fan-out, submission bursts, and grading transactions.
export const assessmentWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  keyGenerator: createUserKeyGenerator("hub-assessment-write"),
  message: {
    success: false,
    message:
      "Too many coursework changes. Please wait a few minutes before trying again.",
  },
});

export const submissionWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  keyGenerator: createUserKeyGenerator("hub-submission-write"),
  message: {
    success: false,
    message:
      "Too many submission attempts. Please wait a few minutes before trying again.",
  },
});

export const gradingWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  keyGenerator: createUserKeyGenerator("hub-grading-write"),
  message: {
    success: false,
    message:
      "Too many grading requests. Please wait a few minutes before trying again.",
  },
});

// Assessments (Canonical Hub-Scoped Routes)
router.get(
  "/:id/assessments",
  requireAuth,
  validateRequest(hubAssessmentListSchema),
  getAssessments,
);
router.post(
  "/:id/assessments",
  requireAuth,
  assessmentWriteLimiter,
  validateRequest(createAssessmentSchema),
  createAssessment,
);
router.get(
  "/:id/assessments/:assessmentId",
  requireAuth,
  validateRequest(assessmentParamSchema),
  getAssessmentById,
);
router.patch(
  "/:id/assessments/:assessmentId",
  requireAuth,
  assessmentWriteLimiter,
  validateRequest(updateAssessmentSchema),
  updateAssessment,
);
router.delete(
  "/:id/assessments/:assessmentId",
  requireAuth,
  assessmentWriteLimiter,
  validateRequest(assessmentParamSchema),
  deleteAssessment,
);

// Submissions & Grading (Canonical Hub-Scoped Routes)
router.get(
  "/:id/assessments/:assessmentId/submissions",
  requireAuth,
  validateRequest(assessmentParamSchema),
  getAssessmentSubmissions,
);
router.post(
  "/:id/assessments/:assessmentId/submit",
  requireAuth,
  submissionWriteLimiter,
  validateRequest(submitAssessmentSchema),
  submitAssessment,
);
router.patch(
  "/:id/assessments/:assessmentId/unsubmit",
  requireAuth,
  submissionWriteLimiter,
  validateRequest(unsubmitAssessmentSchema),
  unsubmitAssessment,
);
router.patch(
  "/:id/assessments/submissions/:submissionId/grade",
  requireAuth,
  gradingWriteLimiter,
  validateRequest(gradeSubmissionSchema),
  gradeSubmission,
);
router.post(
  "/:id/assessments/:assessmentId/bulk-grade",
  requireAuth,
  gradingWriteLimiter,
  validateRequest(bulkGradeSchema),
  bulkGrade,
);

export const assessmentRoutes = router;
