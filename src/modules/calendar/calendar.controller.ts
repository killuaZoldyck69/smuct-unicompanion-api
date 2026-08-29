import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import * as calendarService from "./calendar.service";
import { CalendarStatus } from "../../../generated/prisma/client";

// ==========================================
// STUDENT & PUBLIC ENDPOINTS
// ==========================================

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

export const getCurrentCalendar = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const calendar =
      await calendarService.getCurrentPublishedCalendarService(userId);

    res.status(200).json({
      success: true,
      message: "Current published academic calendar retrieved successfully.",
      data: calendar,
    });
  },
);

export const getUpcomingEvents = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const events = await calendarService.getUpcomingEventsService(userId);

    res.status(200).json({
      success: true,
      message: "Upcoming academic events retrieved successfully.",
      data: events,
    });
  },
);

export const getCalendarById = catchAsync(
  async (req: Request, res: Response) => {
    const calendarId = req.params.id as string;
    const user = req.user;

    const calendar = await calendarService.getCalendarByIdService(
      calendarId,
      user,
    );

    res.status(200).json({
      success: true,
      message: "Academic calendar retrieved successfully.",
      data: calendar,
    });
  },
);

// ==========================================
// ADMIN MANAGEMENT ENDPOINTS
// ==========================================

export const getAdminCalendars = catchAsync(
  async (req: Request, res: Response) => {
    const status = req.query.status as CalendarStatus | undefined;
    const calendars = await calendarService.getAdminCalendarsService(status);

    res.status(200).json({
      success: true,
      message: "All academic calendars retrieved successfully.",
      data: calendars,
    });
  },
);

export const createCalendar = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const newCalendar = await calendarService.createCalendarService(
      req.body,
      userId,
    );

    res.status(201).json({
      success: true,
      message: "Academic Calendar created successfully.",
      data: newCalendar,
    });
  },
);

export const updateCalendar = catchAsync(
  async (req: Request, res: Response) => {
    const calendarId = req.params.id as string;
    const userId = req.user.id;

    const updated = await calendarService.updateCalendarService(
      calendarId,
      req.body,
      userId,
    );

    res.status(200).json({
      success: true,
      message: "Academic Calendar metadata updated successfully.",
      data: updated,
    });
  },
);

export const updateCalendarStatus = catchAsync(
  async (req: Request, res: Response) => {
    const calendarId = req.params.id as string;
    const status = req.body.status as CalendarStatus;
    const userId = req.user.id;

    const updated = await calendarService.updateCalendarStatusService(
      calendarId,
      status,
      userId,
    );

    res.status(200).json({
      success: true,
      message: `Academic Calendar status changed to ${status}.`,
      data: updated,
    });
  },
);

export const duplicateCalendar = catchAsync(
  async (req: Request, res: Response) => {
    const calendarId = req.params.id as string;
    const userId = req.user.id;

    const duplicated = await calendarService.duplicateCalendarService(
      calendarId,
      userId,
    );

    res.status(201).json({
      success: true,
      message: "Academic Calendar duplicated successfully into Draft.",
      data: duplicated,
    });
  },
);

export const deleteCalendar = catchAsync(
  async (req: Request, res: Response) => {
    const calendarId = req.params.id as string;
    await calendarService.deleteCalendarService(calendarId);

    res.status(200).json({
      success: true,
      message: "Academic Calendar deleted successfully.",
    });
  },
);

export const addEvent = catchAsync(async (req: Request, res: Response) => {
  const calendarId = req.params.id as string;
  const event = await calendarService.addEventService(calendarId, req.body);

  res.status(201).json({
    success: true,
    message: "Event added to calendar successfully.",
    data: event,
  });
});

export const updateEvent = catchAsync(async (req: Request, res: Response) => {
  const calendarId = req.params.id as string;
  const eventId = req.params.eventId as string;

  const updated = await calendarService.updateEventService(
    calendarId,
    eventId,
    req.body,
  );

  res.status(200).json({
    success: true,
    message: "Event updated successfully.",
    data: updated,
  });
});

export const deleteEvent = catchAsync(async (req: Request, res: Response) => {
  const calendarId = req.params.id as string;
  const eventId = req.params.eventId as string;

  await calendarService.deleteEventService(calendarId, eventId);

  res.status(200).json({
    success: true,
    message: "Event deleted successfully.",
  });
});

// ==========================================
// CSV IMPORT / EXPORT / TEMPLATE
// ==========================================

export const validateCsv = catchAsync(async (req: Request, res: Response) => {
  const { csvContent, calendarId } = req.body;
  const validationResult = await calendarService.validateCsvService(
    csvContent,
    calendarId,
  );

  res.status(200).json({
    success: true,
    message: validationResult.isValid
      ? "CSV validated successfully."
      : "CSV contains validation errors.",
    data: validationResult,
  });
});

export const importCsv = catchAsync(async (req: Request, res: Response) => {
  const calendarId = req.params.id as string;
  const { csvContent } = req.body;
  const userId = req.user.id;

  const result = await calendarService.importCsvService(
    calendarId,
    csvContent,
    userId,
  );

  res.status(200).json({
    success: true,
    message: `Successfully imported ${result.importedCount} events into calendar.`,
    data: result,
  });
});

export const exportCsv = catchAsync(async (req: Request, res: Response) => {
  const calendarId = req.params.id as string;
  const csvData = await calendarService.exportCsvService(calendarId);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="academic-calendar-${calendarId}.csv"`,
  );
  res.status(200).send(csvData);
});

export const getCsvTemplate = catchAsync(
  async (_req: Request, res: Response) => {
    const templateData = calendarService.getCsvTemplateService();

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="academic-calendar-template.csv"',
    );
    res.status(200).send(templateData);
  },
);
