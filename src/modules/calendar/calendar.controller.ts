import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import * as calendarService from "./calendar.service";

export const createCalendar = catchAsync(
  async (req: Request, res: Response) => {
    const newCalendar = await calendarService.createCalendarService(req.body);

    res.status(201).json({
      success: true,
      message: "Academic Calendar and associated events created successfully.",
      data: newCalendar,
    });
  },
);

export const getCalendars = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;

  const relevantCalendars =
    await calendarService.getRelevantCalendarsService(userId);

  res.status(200).json({
    success: true,
    message: "Relevant academic calendars retrieved successfully.",
    data: relevantCalendars,
  });
});
