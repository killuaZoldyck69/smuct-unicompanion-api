import { AppError } from "../../utils/AppError";
import * as fieldRepository from "./field.repository";
import {
  UpdateFieldSettingsPayload,
  BookFieldPayload,
  GetAllBookingsQuery,
  GetMyBookingsQuery,
  GetScheduleQuery,
} from "./field.schema";

// In-memory cache for high-frequency settings read
let cachedSettings: any = null;
let settingsCacheTimestamp = 0;
const SETTINGS_CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

export const getFieldSettingsService = async () => {
  const now = Date.now();
  if (cachedSettings && now - settingsCacheTimestamp < SETTINGS_CACHE_TTL_MS) {
    return cachedSettings;
  }
  let settings = await fieldRepository.findFieldSettings();
  if (!settings) {
    settings = await fieldRepository.createDefaultFieldSettings();
  }
  cachedSettings = settings;
  settingsCacheTimestamp = now;
  return settings;
};

export const updateFieldSettingsService = async (
  data: UpdateFieldSettingsPayload,
) => {
  const settings = await getFieldSettingsService();
  const updated = await fieldRepository.updateFieldSettings(settings.id, data);
  cachedSettings = updated;
  settingsCacheTimestamp = Date.now();
  return updated;
};

export const bookFieldService = async (
  userId: string,
  data: BookFieldPayload,
) => {
  // 1. Check if global booking is open
  const settings = await getFieldSettingsService();
  if (!settings.isBookingOpen) {
    throw new AppError(
      settings.closedNotice || "Field bookings are currently closed.",
      403,
    );
  }

  // 2. Prevent booking if the time slot overlaps with an already APPROVED booking
  const conflictingBooking =
    await fieldRepository.findConflictingApprovedBooking(
      data.startTime,
      data.endTime,
    );

  if (conflictingBooking) {
    throw new AppError(
      "Cannot request booking. This time slot overlaps with an already approved event.",
      400,
    );
  }

  // 3. Create the booking request
  return await fieldRepository.createFieldBooking(userId, data);
};

export const getMyBookingsService = async (
  userId: string,
  query?: GetMyBookingsQuery,
) => {
  const page = query?.page || 1;
  const limit = query?.limit || 20;
  const skip = (page - 1) * limit;

  const { items, total } = await fieldRepository.findBookingsByUserId(
    userId,
    { status: query?.status },
    skip,
    limit,
  );

  const totalPages = Math.ceil(total / limit) || 1;

  return {
    data: items,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  };
};

export const getAllBookingsService = async (query?: GetAllBookingsQuery) => {
  const page = query?.page || 1;
  const limit = query?.limit || 20;
  const skip = (page - 1) * limit;

  const { items, total, counts } = await fieldRepository.findAllBookings(
    {
      status: query?.status,
      search: query?.search,
      startDate: query?.startDate,
      endDate: query?.endDate,
    },
    skip,
    limit,
  );

  const totalPages = Math.ceil(total / limit) || 1;

  return {
    data: items,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
      counts,
    },
  };
};

export const getApprovedScheduleService = async (query?: GetScheduleQuery) => {
  const limit = query?.limit || 500;
  return await fieldRepository.findApprovedSchedule(
    {
      startDate: query?.startDate,
      endDate: query?.endDate,
    },
    limit,
  );
};

export const updateBookingStatusService = async (
  id: string,
  status: "APPROVED" | "REJECTED",
) => {
  const booking = await fieldRepository.findBookingById(id);
  if (!booking) throw new AppError("Booking not found", 404);

  // If approving, prevent overlapping approvals
  if (status === "APPROVED") {
    const conflictingBooking =
      await fieldRepository.findConflictingApprovedBooking(
        booking.startTime,
        booking.endTime,
        booking.id, // Exclude self
      );

    if (conflictingBooking) {
      throw new AppError(
        "Cannot approve. This time slot overlaps with an already approved booking.",
        400,
      );
    }
  }

  return await fieldRepository.updateBookingStatus(id, status);
};

export const deleteBookingService = async (
  id: string,
  userId: string,
  userRole?: string,
) => {
  const booking = await fieldRepository.findBookingById(id);
  if (!booking) throw new AppError("Booking not found", 404);

  const isAuthor = booking.userId === userId;
  const isAdmin = userRole === "ADMIN" || userRole === "SUPER_ADMIN";

  if (!isAuthor && !isAdmin) {
    throw new AppError(
      "Unauthorized: You can only delete your own bookings",
      403,
    );
  }

  return await fieldRepository.deleteBooking(id);
};
