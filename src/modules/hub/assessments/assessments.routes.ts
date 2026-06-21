import { Router } from "express";
import { requireAuth } from "../../../middleware/auth.middleware";
import { validateRequest } from "../../../middleware/validateRequest";
import {
  createAssessmentSchema,
  submitAssessmentSchema,
  gradeSubmissionSchema,
  bulkGradeSchema,
} from "./assessments.schema";
import {
  createAssessment,
  getAssessments,
  submitAssessment,
  gradeSubmission,
  bulkGrade,
} from "./assessments.controller";

const router = Router({ mergeParams: true });

router.post(
  "/hubs/:id/assessments",
  requireAuth,
  validateRequest(createAssessmentSchema),
  createAssessment,
);
router.get("/hubs/:id/assessments", requireAuth, getAssessments);

// Submissions & Grading
router.post(
  "/assessments/:assessmentId/submit",
  requireAuth,
  validateRequest(submitAssessmentSchema),
  submitAssessment,
);
router.patch(
  "/submissions/:submissionId/grade",
  requireAuth,
  validateRequest(gradeSubmissionSchema),
  gradeSubmission,
);
router.post(
  "/assessments/:assessmentId/bulk-grade",
  requireAuth,
  validateRequest(bulkGradeSchema),
  bulkGrade,
);

export const assessmentRoutes = router;
