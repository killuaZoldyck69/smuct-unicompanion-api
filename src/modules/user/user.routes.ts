import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/admin.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import {
  singleUpload,
  normalizeSingleFile,
} from "../../middleware/upload.middleware";
import { updateRoleSchema } from "./user.schema";
import {
  getAllUsers,
  deleteUser,
  updateStudentRole,
  updateUserProfileImage,
} from "./user.controller";

const router = Router();

// PATCH /api/users/profile/image - Upload and update profile image for current user
router.patch(
  "/profile/image",
  requireAuth,
  singleUpload,
  normalizeSingleFile,
  updateUserProfileImage,
);

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

