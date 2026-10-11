import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import {
  getAllTeachers,
  getTeacherDepartments,
} from "./directory.controller";
import { getTeachersDirectoryQuerySchema } from "./directory.schema";

const router = Router();

// GET /api/directory/teachers/departments - Get distinct departments
router.get("/teachers/departments", requireAuth, getTeacherDepartments);

// GET /api/directory/teachers - Get all teachers with search, department filter, and pagination
router.get(
  "/teachers",
  requireAuth,
  validateRequest(getTeachersDirectoryQuerySchema),
  getAllTeachers,
);

export const directoryRoutes = router;
