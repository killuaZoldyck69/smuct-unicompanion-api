import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import {
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notification.controller";

const router = Router();

router.use(requireAuth);
router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);
router.patch("/read-all", markAllNotificationsRead);
router.patch("/:id/read", markNotificationRead);

export const notificationRoutes = router;
