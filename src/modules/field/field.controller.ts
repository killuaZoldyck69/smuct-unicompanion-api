import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import * as fieldService from "./field.service";

export const getFieldSettings = catchAsync(
  async (req: Request, res: Response) => {
    const settings = await fieldService.getFieldSettingsService();
    // Cache headers for read performance
    res.setHeader("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
    res.status(200).json({ success: true, data: settings });
  },
);

export const updateFieldSettings = catchAsync(
  async (req: Request, res: Response) => {
    const settings = await fieldService.updateFieldSettingsService(req.body);
    res
      .status(200)
      .json({ success: true, message: "Settings updated", data: settings });
  },
);

export const bookField = catchAsync(async (req: Request, res: Response) => {
  const booking = await fieldService.bookFieldService(req.user.id, req.body);
  res
    .status(201)
    .json({ success: true, message: "Booking requested", data: booking });
});

export const getMyBookings = catchAsync(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const status = req.query.status as any;

  const result = await fieldService.getMyBookingsService(req.user.id, {
    page,
    limit,
    status,
  });

  res.status(200).json({
    success: true,
    data: result.data,
    meta: result.meta,
  });
});

export const getAllBookings = catchAsync(
  async (req: Request, res: Response) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const status = req.query.status as any;
    const search = req.query.search as string | undefined;
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : undefined;
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : undefined;

    const result = await fieldService.getAllBookingsService({
      page,
      limit,
      status,
      search,
      startDate,
      endDate,
    });

    res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  },
);

export const getApprovedSchedule = catchAsync(
  async (req: Request, res: Response) => {
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : undefined;
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : undefined;
    const limit = Math.min(1000, Number(req.query.limit) || 500);

    const schedule = await fieldService.getApprovedScheduleService({
      startDate,
      endDate,
      limit,
    });

    res.setHeader("Cache-Control", "private, max-age=15, stale-while-revalidate=30");
    res.status(200).json({ success: true, data: schedule });
  },
);

export const updateBookingStatus = catchAsync(
  async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const booking = await fieldService.updateBookingStatusService(
      id,
      req.body.status,
    );
    res.status(200).json({
      success: true,
      message: "Booking status updated",
      data: booking,
    });
  },
);

export const deleteBooking = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await fieldService.deleteBookingService(id, req.user!.id, req.user?.role);
  res.status(200).json({
    success: true,
    message: "Booking deleted successfully",
  });
});
