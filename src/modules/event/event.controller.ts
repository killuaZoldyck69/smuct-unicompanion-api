import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import * as eventService from "./event.service";

export const createEvent = catchAsync(async (req: Request, res: Response) => {
  const newEvent = await eventService.createEventService(req.body);

  res.status(201).json({
    success: true,
    message: "Campus event created successfully.",
    data: newEvent,
  });
});

export const getEvents = catchAsync(async (req: Request, res: Response) => {
  // 👇 Call the renamed service
  const events = await eventService.getAllEventsService();

  res.status(200).json({
    success: true,
    message: "Campus events retrieved successfully.",
    data: events,
  });
});

export const deleteEvent = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;

  await eventService.deleteEventService(id);

  res.status(200).json({
    success: true,
    message: "Campus event deleted successfully.",
  });
});
