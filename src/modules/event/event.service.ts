import { AppError } from "../../utils/AppError";
import * as eventRepository from "./event.repository";
import { CreateEventPayload, UpdateEventPayload, GetEventsQuery } from "./event.schema";
import { eventCache } from "./event.cache";

export const createEventService = async (data: CreateEventPayload) => {
  const newEvent = await eventRepository.createCampusEvent(data);
  eventCache.invalidateAll();
  return newEvent;
};

export const getAllEventsService = async (
  query?: GetEventsQuery,
  currentUserId?: string
) => {
  const page = query?.page || 1;
  const limit = query?.limit || 10;
  const tab = query?.tab || "upcoming";
  const search = query?.search?.trim() || "";
  const sortBy = query?.sortBy || "eventDate";
  const sortOrder = query?.sortOrder || (tab === "past" ? "desc" : "asc");

  const cacheKey = `events:${currentUserId || "anon"}:${tab}:${search}:${page}:${limit}:${sortBy}:${sortOrder}`;
  const cached = eventCache.get<any>(cacheKey);
  if (cached) {
    return cached;
  }

  const result = await eventRepository.findPaginatedCampusEvents({
    page,
    limit,
    tab,
    search,
    sortBy,
    sortOrder,
    currentUserId,
  });

  // Cache for 60 seconds (high read throughput)
  eventCache.set(cacheKey, result, 60);
  return result;
};

export const getEventByIdService = async (id: string, currentUserId?: string) => {
  const existingEvent = await eventRepository.findCampusEventById(id, currentUserId);

  if (!existingEvent) {
    throw new AppError("Campus event not found.", 404);
  }

  return existingEvent;
};

export const toggleEventInterestedService = async (eventId: string, userId: string) => {
  const existingEvent = await eventRepository.findCampusEventById(eventId);

  if (!existingEvent) {
    throw new AppError("Campus event not found.", 404);
  }

  const result = await eventRepository.toggleEventInterested(eventId, userId);
  eventCache.invalidateAll();
  return result;
};

export const getEventInterestedStatusService = async (eventId: string, userId?: string) => {
  const existingEvent = await eventRepository.findCampusEventById(eventId);

  if (!existingEvent) {
    throw new AppError("Campus event not found.", 404);
  }

  return await eventRepository.getEventInterested(eventId, userId);
};

export const updateEventService = async (id: string, data: UpdateEventPayload) => {
  const existingEvent = await eventRepository.findCampusEventById(id);

  if (!existingEvent) {
    throw new AppError("Campus event not found.", 404);
  }

  const updatedEvent = await eventRepository.updateCampusEvent(id, data);
  eventCache.invalidateAll();
  return updatedEvent;
};

export const deleteEventService = async (id: string) => {
  const existingEvent = await eventRepository.findCampusEventById(id);

  if (!existingEvent) {
    throw new AppError("Campus event not found.", 404);
  }

  const deleted = await eventRepository.deleteCampusEventById(id);
  eventCache.invalidateAll();
  return deleted;
};

