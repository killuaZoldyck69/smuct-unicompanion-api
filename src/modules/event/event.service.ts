import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { CreateEventPayload } from "./event.schema";

export const createEventService = async (data: CreateEventPayload) => {
  return await prisma.campusEvent.create({
    data: {
      title: data.title,
      description: data.description,
      location: data.location,
      eventDate: data.eventDate,
    },
  });
};

// 👇 Renamed to accurately reflect that it returns ALL events
export const getAllEventsService = async () => {
  return await prisma.campusEvent.findMany({
    orderBy: {
      eventDate: "asc",
    },
  });
};

export const deleteEventService = async (id: string) => {
  const existingEvent = await prisma.campusEvent.findUnique({
    where: { id },
  });

  if (!existingEvent) {
    throw new AppError("Campus event not found.", 404);
  }

  return await prisma.campusEvent.delete({
    where: { id },
  });
};
