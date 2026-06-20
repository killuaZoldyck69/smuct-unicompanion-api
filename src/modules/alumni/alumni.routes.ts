import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/admin.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createAlumniSchema,
  bulkCreateAlumniSchema,
  updateAlumniSchema,
} from "./alumni.schema";
import {
  getAllAlumni,
  createAlumni,
  bulkCreateAlumni,
  updateAlumni,
  deleteAlumni,
} from "./alumni.controller";

const router = Router();

router.get("/", requireAuth, getAllAlumni);
router.post(
  "/",
  requireAuth,
  requireAdmin,
  validateRequest(createAlumniSchema),
  createAlumni,
);
router.post(
  "/bulk",
  requireAuth,
  requireAdmin,
  validateRequest(bulkCreateAlumniSchema),
  bulkCreateAlumni,
);
router.patch(
  "/:id",
  requireAuth,
  requireAdmin,
  validateRequest(updateAlumniSchema),
  updateAlumni,
);
router.delete("/:id", requireAuth, requireAdmin, deleteAlumni);

export const alumniRoutes = router;
