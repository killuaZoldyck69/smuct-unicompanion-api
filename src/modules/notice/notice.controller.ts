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
  const query = req.query as any;
  const result = await noticeService.getAllNoticesService(query);

  res.status(200).json({
    success: true,
    message: "Notices retrieved successfully.",
    data: result.items,
    pagination: result.pagination,
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

export const updateNotice = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const updatedNotice = await noticeService.updateNoticeService(id, req.body);

  res.status(200).json({
    success: true,
    message: "Notice updated successfully.",
    data: updatedNotice,
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
