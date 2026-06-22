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

// 👇 FIX: Removed the "/hubs" prefix because it's already mounted inside hub.routes.ts
router.post(
  "/:id/assessments",
  requireAuth,
  validateRequest(createAssessmentSchema),
  createAssessment,
);
router.get("/:id/assessments", requireAuth, getAssessments);

// Submissions & Grading
router.post(
  "/:id/assessments/:assessmentId/submit",
  requireAuth,
  validateRequest(submitAssessmentSchema),
  submitAssessment,
);
router.patch(
  "/:id/submissions/:submissionId/grade",
  requireAuth,
  validateRequest(gradeSubmissionSchema),
  gradeSubmission,
);
router.post(
  "/:id/assessments/:assessmentId/bulk-grade",
  requireAuth,
  validateRequest(bulkGradeSchema),
  bulkGrade,
);

export const assessmentRoutes = router;
