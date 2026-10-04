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
  const currentUserId = req.user?.id;
  const query = req.query as any;
  const events = await eventService.getAllEventsService(query, currentUserId);

  res.status(200).json({
    success: true,
    message: "Campus events retrieved successfully.",
    data: events,
  });
});

export const getEventById = catchAsync(async (req: Request, res: Response) => {
  const currentUserId = req.user?.id;
  const event = await eventService.getEventByIdService(
    req.params.id as string,
    currentUserId,
  );

  res.status(200).json({
    success: true,
    message: "Campus event retrieved successfully.",
    data: event,
  });
});

export const toggleInterested = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const eventId = req.params.id as string;
  const result = await eventService.toggleEventInterestedService(eventId, userId);

  res.status(200).json({
    success: true,
    message: result.isInterested
      ? "Event marked as interested."
      : "Event removed from interested.",
    data: result,
  });
});

export const getInterestedStatus = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const eventId = req.params.id as string;
  const result = await eventService.getEventInterestedStatusService(
    eventId,
    userId,
  );

  res.status(200).json({
    success: true,
    message: "Interested status retrieved successfully.",
    data: result,
  });
});

export const updateEvent = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const updatedEvent = await eventService.updateEventService(id, req.body);

  res.status(200).json({
    success: true,
    message: "Campus event updated successfully.",
    data: updatedEvent,
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
