import { Router } from "express";
import { requireAuth } from "../../../middleware/auth.middleware";
import {
  createUserKeyGenerator,
  rateLimit,
} from "../../../middleware/rateLimit.middleware";
import { validateRequest } from "../../../middleware/validateRequest";
import {
  createResourceSchema,
  getResourcesQuerySchema,
  resourceParamSchema,
} from "./resources.schema";
import {
  createResource,
  getResources,
  deleteResource,
} from "./resources.controller";

const router = Router({ mergeParams: true });

// Dedicated per-user limiter protects hub notification fan-out & write abuse.
export const resourceWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  keyGenerator: createUserKeyGenerator("hub-resource-write"),
  message: {
    success: false,
    message:
      "Too many resource updates. Please wait a few minutes before trying again.",
  },
});

router.post(
  "/:id/resources",
  requireAuth,
  resourceWriteLimiter,
  validateRequest(createResourceSchema),
  createResource,
);
router.get(
  "/:id/resources",
  requireAuth,
  validateRequest(getResourcesQuerySchema),
  getResources,
);
router.delete(
  "/:id/resources/:resourceId",
  requireAuth,
  resourceWriteLimiter,
  validateRequest(resourceParamSchema),
  deleteResource,
);

export const resourceRoutes = router;
