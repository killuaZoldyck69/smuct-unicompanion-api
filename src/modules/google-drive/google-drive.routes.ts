import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createUserKeyGenerator,
  rateLimit,
  resolveClientIp,
} from "../../middleware/rateLimit.middleware";
import { createDriveAuthUrlSchema } from "./google-drive.schema";
import {
  createDriveAuthUrl,
  disconnectDrive,
  getDriveStatus,
  handleDriveCallback,
  mintDriveAccessToken,
} from "./google-drive.controller";

const router = Router();

const driveAuthUrlLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: createUserKeyGenerator("google-drive-auth-url"),
  message: {
    success: false,
    message: "Too many Google Drive connection attempts. Please wait a moment.",
  },
});

const driveCallbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => `google-drive-callback:ip:${resolveClientIp(req)}`,
  message: {
    success: false,
    message: "Too many OAuth callback requests. Please try again shortly.",
  },
});

const driveTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  keyGenerator: createUserKeyGenerator("google-drive-access-token"),
  message: {
    success: false,
    message: "Too many Google Drive token requests. Please slow down.",
  },
});

const driveDisconnectLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: createUserKeyGenerator("google-drive-disconnect"),
  message: {
    success: false,
    message: "Too many disconnect requests. Please wait a moment.",
  },
});

router.get("/status", requireAuth, getDriveStatus);
router.post(
  "/auth-url",
  requireAuth,
  driveAuthUrlLimiter,
  validateRequest(createDriveAuthUrlSchema),
  createDriveAuthUrl,
);
router.get("/callback", driveCallbackLimiter, handleDriveCallback);
router.post("/access-token", requireAuth, driveTokenLimiter, mintDriveAccessToken);
router.delete(
  "/connection",
  requireAuth,
  driveDisconnectLimiter,
  disconnectDrive,
);

export const googleDriveRoutes = router;
