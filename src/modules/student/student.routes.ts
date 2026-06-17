import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import {
  getStudentProfile,
  onboardStudent,
  updateProfile,
  updateProfileImage,
} from "./student.controller";

const router = Router();

router.post("/onboard", requireAuth, onboardStudent);
router.patch("/profile/image", requireAuth, updateProfileImage);
router.get("/profile", requireAuth, getStudentProfile);
router.patch("/profile", requireAuth, updateProfile);

export const studentRoutes = router;
