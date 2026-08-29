import { prisma } from "../../lib/prisma";
import { CreateEventPayload } from "./event.schema";

export const createCampusEvent = async (data: CreateEventPayload) => {
  return await prisma.campusEvent.create({
    data: {
      title: data.title,
      description: data.description,
      location: data.location,
      eventDate: data.eventDate,
    },
  });
};

export const findAllCampusEvents = async (take = 100) => {
  return await prisma.campusEvent.findMany({
    orderBy: {
      eventDate: "asc",
    },
    take,
  });
};

export const findCampusEventById = async (id: string) => {
  return await prisma.campusEvent.findUnique({
    where: { id },
  });
};

export const deleteCampusEventById = async (id: string) => {
  return await prisma.campusEvent.delete({
    where: { id },
  });
};
