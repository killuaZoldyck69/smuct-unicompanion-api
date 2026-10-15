import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireStudent, requireRole } from "../../middleware/role.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import { onboardLimiter } from "../../middleware/rateLimit.middleware";
import {
  singleUpload,
  normalizeSingleFile,
} from "../../middleware/upload.middleware";
import {
  onboardStudentSchema,
  updateProfileSchema,
} from "./student.schema";
import {
  getStudentProfile,
  onboardStudent,
  updateProfile,
  updateProfileImage,
} from "./student.controller";

const router = Router();

// POST /api/students/onboard - Student onboarding (STUDENT role only)
router.post(
  "/onboard",
  requireAuth,
  requireStudent,
  onboardLimiter,
  validateRequest(onboardStudentSchema),
  onboardStudent,
);

// PATCH /api/students/profile/image - Upload student avatar
router.patch(
  "/profile/image",
  requireAuth,
  requireStudent,
  singleUpload,
  normalizeSingleFile,
  updateProfileImage,
);

// GET /api/students/profile - View student profile (STUDENT or ADMIN)
router.get("/profile", requireAuth, requireRole("STUDENT", "ADMIN"), getStudentProfile);

// PATCH /api/students/profile - Update student profile (STUDENT only)
router.patch(
  "/profile",
  requireAuth,
  requireStudent,
  validateRequest(updateProfileSchema),
  updateProfile,
);

export const studentRoutes = router;
