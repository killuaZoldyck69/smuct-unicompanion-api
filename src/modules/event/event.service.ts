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
  const cacheKey = `events:${currentUserId || "anon"}:${JSON.stringify(query || {})}`;
  const cached = eventCache.get<any>(cacheKey);
  if (cached) {
    return cached;
  }

  const result = await eventRepository.findPaginatedCampusEvents({
    page: query?.page,
    limit: query?.limit,
    tab: query?.tab,
    search: query?.search,
    sortBy: query?.sortBy,
    sortOrder: query?.sortOrder,
    currentUserId,
  });

  // Cache for 45 seconds (high read throughput)
  eventCache.set(cacheKey, result, 45);
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

