import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/admin.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createNoticeSchema,
  updateNoticeSchema,
  getNoticesQuerySchema,
  noticeIdParamSchema,
} from "./notice.schema";
import {
  createNotice,
  updateNotice,
  getNotices,
  getNoticeById,
  deleteNotice,
} from "./notice.controller";

const router = Router();

// POST /api/notices - Create Notice (Admin Only)
router.post(
  "/",
  requireAuth,
  requireAdmin,
  validateRequest(createNoticeSchema),
  createNotice,
);

// GET /api/notices - Get All Notices with Pagination & Search (All Authenticated Users: Students, Teachers, Admins)
router.get("/", requireAuth, validateRequest(getNoticesQuerySchema), getNotices);

// GET /api/notices/:id - Get Notice Details (All Authenticated Users)
router.get(
  "/:id",
  requireAuth,
  validateRequest(noticeIdParamSchema),
  getNoticeById,
);

// PATCH /api/notices/:id - Update Notice (Admin Only)
router.patch(
  "/:id",
  requireAuth,
  requireAdmin,
  validateRequest(updateNoticeSchema),
  updateNotice,
);

// PUT /api/notices/:id - Update Notice (Admin Only)
router.put(
  "/:id",
  requireAuth,
  requireAdmin,
  validateRequest(updateNoticeSchema),
  updateNotice,
);

// DELETE /api/notices/:id - Delete Notice (Admin Only)
router.delete(
  "/:id",
  requireAuth,
  requireAdmin,
  validateRequest(noticeIdParamSchema),
  deleteNotice,
);

export const noticeRoutes = router;

