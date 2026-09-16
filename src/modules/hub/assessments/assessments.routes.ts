import { Router } from "express";
import { requireAuth } from "../../../middleware/auth.middleware";
import { validateRequest } from "../../../middleware/validateRequest";
import {
  createAssessmentSchema,
  updateAssessmentSchema,
  submitAssessmentSchema,
  gradeSubmissionSchema,
  bulkGradeSchema,
} from "./assessments.schema";
import {
  createAssessment,
  getAssessments,
  updateAssessment,
  deleteAssessment,
  getAssessmentSubmissions,
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
router.patch(
  [
    "/:id/assessments/:assessmentId",
    "/assessments/:assessmentId",
  ],
  requireAuth,
  validateRequest(updateAssessmentSchema),
  updateAssessment,
);
router.delete(
  [
    "/:id/assessments/:assessmentId",
    "/assessments/:assessmentId",
  ],
  requireAuth,
  deleteAssessment,
);
router.get(
  [
    "/:id/assessments/:assessmentId/submissions",
    "/assessments/:assessmentId/submissions",
  ],
  requireAuth,
  getAssessmentSubmissions,
);

// Submissions & Grading
router.post(
  [
    "/:id/assessments/:assessmentId/submit",
    "/assessments/:assessmentId/submit",
  ],
  requireAuth,
  validateRequest(submitAssessmentSchema),
  submitAssessment,
);
router.patch(
  [
    "/:id/submissions/:submissionId/grade",
    "/submissions/:submissionId/grade",
    "/assessments/submissions/:submissionId/grade",
  ],
  requireAuth,
  validateRequest(gradeSubmissionSchema),
  gradeSubmission,
);
router.post(
  [
    "/:id/assessments/:assessmentId/bulk-grade",
    "/assessments/:assessmentId/bulk-grade",
  ],
  requireAuth,
  validateRequest(bulkGradeSchema),
  bulkGrade,
);

export const assessmentRoutes = router;
