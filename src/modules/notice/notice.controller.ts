import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import * as noticeService from "./notice.service";

export const createNotice = catchAsync(async (req: Request, res: Response) => {
  const newNotice = await noticeService.createNoticeService(req.body);

  res.status(201).json({
    success: true,
    message: "Notice created successfully.",
    data: newNotice,
  });
});

export const getNotices = catchAsync(async (req: Request, res: Response) => {
  const notices = await noticeService.getAllNoticesService();

  res.status(200).json({
    success: true,
    message: "Notices retrieved successfully.",
    data: notices,
  });
});

export const getNoticeById = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string; // Assert as string to avoid TS array errors
  const notice = await noticeService.getNoticeByIdService(id);

  res.status(200).json({
    success: true,
    message: "Notice retrieved successfully.",
    data: notice,
  });
});

export const deleteNotice = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string; // Assert as string to avoid TS array errors

  await noticeService.deleteNoticeService(id);

  res.status(200).json({
    success: true,
    message: "Notice deleted successfully.",
  });
});
