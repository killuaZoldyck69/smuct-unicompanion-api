import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import * as fieldService from "./field.service";

export const getFieldSettings = catchAsync(
  async (req: Request, res: Response) => {
    const settings = await fieldService.getFieldSettingsService();
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
  const bookings = await fieldService.getMyBookingsService(req.user.id);
  res.status(200).json({ success: true, data: bookings });
});

export const getAllBookings = catchAsync(
  async (req: Request, res: Response) => {
    const bookings = await fieldService.getAllBookingsService();
    res.status(200).json({ success: true, data: bookings });
  },
);

// NEW: Public Schedule Controller
export const getApprovedSchedule = catchAsync(
  async (req: Request, res: Response) => {
    const schedule = await fieldService.getApprovedScheduleService();
    res.status(200).json({ success: true, data: schedule });
  },
);

// UPDATED: Fixed Type Assertion
export const updateBookingStatus = catchAsync(
  async (req: Request, res: Response) => {
    const id = req.params.id as string; // Fix TS array warning
    const booking = await fieldService.updateBookingStatusService(
      id,
      req.body.status,
    );
    res
      .status(200)
      .json({
        success: true,
        message: "Booking status updated",
        data: booking,
      });
  },
);
