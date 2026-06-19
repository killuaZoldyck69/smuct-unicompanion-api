import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/admin.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import { updateRoleSchema } from "./user.schema";
import { getAllUsers, deleteUser, updateStudentRole } from "./user.controller";

const router = Router();

// GET /api/users - Get All Users (Admin Only)
router.get("/", requireAuth, requireAdmin, getAllUsers);

// DELETE /api/users/:id - Permanently Delete User (Admin Only)
router.delete("/:id", requireAuth, requireAdmin, deleteUser);

// PATCH /api/users/:id/role - Update Student Special Role (Admin Only)
router.patch(
  "/:id/role",
  requireAuth,
  requireAdmin,
  validateRequest(updateRoleSchema),
  updateStudentRole,
);

export const userRoutes = router;
