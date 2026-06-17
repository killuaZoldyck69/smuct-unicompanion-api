import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import {
  onboardStudentSchema,
  updateProfileImageSchema,
  updateProfileSchema,
} from "./student.schema";
import {
  getStudentProfile,
  onboardStudent,
  updateProfile,
  updateProfileImage,
} from "./student.controller";

const router = Router();

router.post(
  "/onboard",
  requireAuth,
  validateRequest(onboardStudentSchema),
  onboardStudent,
);

router.patch(
  "/profile/image",
  requireAuth,
  validateRequest(updateProfileImageSchema),
  updateProfileImage,
);

router.get("/profile", requireAuth, getStudentProfile);

router.patch(
  "/profile",
  requireAuth,
  validateRequest(updateProfileSchema),
  updateProfile,
);

export const studentRoutes = router;
