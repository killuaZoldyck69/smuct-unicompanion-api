import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { getAllTeachers } from "./directory.controller";

const router = Router();

// GET /api/directory/teachers - Get All Teachers
router.get("/teachers", requireAuth, getAllTeachers);

export const directoryRoutes = router;
