import { Router } from "express";
import { requireAuth } from "../../../middleware/auth.middleware";
import { validateRequest } from "../../../middleware/validateRequest";
import { createResourceSchema } from "./resources.schema";
import {
  createResource,
  getResources,
  deleteResource,
} from "./resources.controller";

const router = Router({ mergeParams: true });

// 👇 REMOVED "/hubs" from these paths to prevent the double-routing bug
router.post(
  "/:id/resources",
  requireAuth,
  validateRequest(createResourceSchema),
  createResource,
);
router.get("/:id/resources", requireAuth, getResources);
router.delete("/:id/resources/:resourceId", requireAuth, deleteResource);

export const resourceRoutes = router;
