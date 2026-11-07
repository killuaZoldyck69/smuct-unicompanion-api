import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import * as notificationService from "./notification.service";

export const getNotifications = catchAsync(
  async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit), 10) || 30),
    );
    const result = await notificationService.getNotifications(
      req.user.id,
      page,
      limit,
    );
    res.status(200).json({ success: true, data: result.items, ...result });
  },
);

export const getUnreadCount = catchAsync(
  async (req: Request, res: Response) => {
    const unreadCount = await notificationService.getUnreadNotificationCount(
      req.user.id,
    );
    res.status(200).json({ success: true, data: { unreadCount } });
  },
);

export const markNotificationRead = catchAsync(
  async (req: Request, res: Response) => {
    const notification = await notificationService.markNotificationRead(
      req.user.id,
      req.params.id as string,
    );
    if (!notification) {
      res.status(404).json({ success: false, message: "Notification not found." });
      return;
    }
    res.status(200).json({ success: true, data: notification });
  },
);

export const markAllNotificationsRead = catchAsync(
  async (req: Request, res: Response) => {
    const updatedCount = await notificationService.markAllNotificationsRead(
      req.user.id,
    );
    res.status(200).json({ success: true, data: { updatedCount } });
  },
);

export const registerPushToken = catchAsync(
  async (req: Request, res: Response) => {
    const { token, platform = "android" } = req.body;
    if (!token || typeof token !== "string" || !token.trim()) {
      res.status(400).json({
        success: false,
        message: "Valid push token is required.",
      });
      return;
    }

    const record = await notificationService.registerPushToken(
      req.user.id,
      token.trim(),
      typeof platform === "string" ? platform : "android",
    );

    res.status(200).json({
      success: true,
      message: "Push token registered successfully.",
      data: record,
    });
  },
);

export const unregisterPushToken = catchAsync(
  async (req: Request, res: Response) => {
    const { token } = req.body;
    await notificationService.unregisterPushToken(
      req.user.id,
      typeof token === "string" ? token.trim() : undefined,
    );
    res.status(200).json({
      success: true,
      message: "Push token unregistered successfully.",
    });
  },
);
