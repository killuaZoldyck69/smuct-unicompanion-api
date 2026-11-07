import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import {
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  registerPushToken,
  unregisterPushToken,
} from "./notification.controller";

const router = Router();

router.use(requireAuth);
router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);
router.patch("/read-all", markAllNotificationsRead);
router.patch("/:id/read", markNotificationRead);
router.post("/push-token", registerPushToken);
router.delete("/push-token", unregisterPushToken);

export const notificationRoutes = router;
