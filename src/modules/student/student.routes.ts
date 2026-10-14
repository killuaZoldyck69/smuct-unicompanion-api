import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
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

router.post(
  "/onboard",
  requireAuth,
  onboardLimiter,
  validateRequest(onboardStudentSchema),
  onboardStudent,
);

router.patch(
  "/profile/image",
  requireAuth,
  singleUpload,
  normalizeSingleFile,
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
