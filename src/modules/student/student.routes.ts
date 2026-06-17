import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { onboardStudent, updateProfileImage } from "./student.controller";

const router = Router();

router.post("/onboard", requireAuth, onboardStudent);
router.patch("/profile/image", requireAuth, updateProfileImage);

export const studentRoutes = router;
