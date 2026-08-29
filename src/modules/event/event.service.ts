import { AppError } from "../../utils/AppError";
import * as eventRepository from "./event.repository";
import { CreateEventPayload } from "./event.schema";

export const createEventService = async (data: CreateEventPayload) => {
  return await eventRepository.createCampusEvent(data);
};

export const getAllEventsService = async () => {
  return await eventRepository.findAllCampusEvents(100);
};

export const deleteEventService = async (id: string) => {
  const existingEvent = await eventRepository.findCampusEventById(id);

  if (!existingEvent) {
    throw new AppError("Campus event not found.", 404);
  }

  return await eventRepository.deleteCampusEventById(id);
};
