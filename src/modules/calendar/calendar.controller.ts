import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import * as calendarService from "./calendar.service";
import { generateCsvTemplate } from "./calendar.csv";
import { CalendarStatus } from "../../../generated/prisma/client";

export const getCalendars = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 25);
  const result = await calendarService.getRelevantCalendarsService(userId, {
    page,
    limit,
  });

  res.status(200).json({
    success: true,
    message: "Relevant academic calendars retrieved successfully.",
    data: result.items,
    ...(result.pagination ? { pagination: result.pagination } : {}),
  });
});

export const getCurrentCalendar = catchAsync(
  async (req: Request, res: Response) => {
    const calendar = await calendarService.getCurrentPublishedCalendarService(
      req.user.id,
    );

    res.status(200).json({
      success: true,
      message: calendar
        ? "Current published academic calendar retrieved successfully."
        : "No published academic calendar found for your program or batch.",
      data: calendar,
    });
  },
);

export const getUpcomingEvents = catchAsync(
  async (req: Request, res: Response) => {
    const limit =
      req.query.limit !== undefined ? Number(req.query.limit) : undefined;
    const events = await calendarService.getUpcomingEventsService(
      req.user.id,
      limit,
    );

    res.status(200).json({
      success: true,
      message: "Upcoming academic events retrieved successfully.",
      data: events,
    });
  },
);

export const getCalendarById = catchAsync(
  async (req: Request, res: Response) => {
    const calendar = await calendarService.getCalendarByIdService(
      req.params.id as string,
      req.user,
    );

    res.status(200).json({
      success: true,
      message: "Academic calendar retrieved successfully.",
      data: calendar,
    });
  },
);

export const getAdminCalendars = catchAsync(
  async (req: Request, res: Response) => {
    const status = req.query.status as CalendarStatus | undefined;
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 25);
    const result = await calendarService.getAdminCalendarsService(status, {
      page,
      limit,
    });

    res.status(200).json({
      success: true,
      message: "All academic calendars retrieved successfully.",
      data: result.items,
      pagination: result.pagination,
    });
  },
);

export const createCalendar = catchAsync(
  async (req: Request, res: Response) => {
    const newCalendar = await calendarService.createCalendarService(
      req.body,
      req.user.id,
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
    const updated = await calendarService.updateCalendarService(
      req.params.id as string,
      req.body,
      req.user.id,
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
    const status = req.body.status as CalendarStatus;
    const updated = await calendarService.updateCalendarStatusService(
      req.params.id as string,
      status,
      req.user.id,
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
    const duplicated = await calendarService.duplicateCalendarService(
      req.params.id as string,
      req.user.id,
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
    await calendarService.deleteCalendarService(req.params.id as string);

    res.status(200).json({
      success: true,
      message: "Academic Calendar deleted successfully.",
    });
  },
);

export const addEvent = catchAsync(async (req: Request, res: Response) => {
  const event = await calendarService.addEventService(
    req.params.id as string,
    req.body,
  );

  res.status(201).json({
    success: true,
    message: "Event added to calendar successfully.",
    data: event,
  });
});

export const updateEvent = catchAsync(async (req: Request, res: Response) => {
  const updated = await calendarService.updateEventService(
    req.params.id as string,
    req.params.eventId as string,
    req.body,
  );

  res.status(200).json({
    success: true,
    message: "Event updated successfully.",
    data: updated,
  });
});

export const deleteEvent = catchAsync(async (req: Request, res: Response) => {
  await calendarService.deleteEventService(
    req.params.id as string,
    req.params.eventId as string,
  );

  res.status(200).json({
    success: true,
    message: "Event deleted successfully.",
  });
});

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
  const result = await calendarService.importCsvService(
    req.params.id as string,
    req.body.csvContent,
    req.user.id,
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
    const templateData = generateCsvTemplate();

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="academic-calendar-template.csv"',
    );
    res.status(200).send(templateData);
  },
);
