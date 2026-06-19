import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireAdmin } from "../../middleware/admin.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import { createBusSchema } from "./bus.schema";
import { createBusRoute, getBusRoutes, deleteBusRoute } from "./bus.controller";

const router = Router();

// POST /api/buses - Create Bus Route (Admin Only)
router.post(
  "/",
  requireAuth,
  requireAdmin,
  validateRequest(createBusSchema),
  createBusRoute,
);

// GET /api/buses - Get All Bus Routes (All Authenticated Users)
router.get("/", requireAuth, getBusRoutes);

// DELETE /api/buses/:id - Delete Bus Route (Admin Only)
router.delete("/:id", requireAuth, requireAdmin, deleteBusRoute);

export const busRoutes = router;
