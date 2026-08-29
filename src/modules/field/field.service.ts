import { AppError } from "../../utils/AppError";
import * as fieldRepository from "./field.repository";
import { UpdateFieldSettingsPayload, BookFieldPayload } from "./field.schema";

export const getFieldSettingsService = async () => {
  let settings = await fieldRepository.findFieldSettings();
  if (!settings) {
    settings = await fieldRepository.createDefaultFieldSettings();
  }
  return settings;
};

export const updateFieldSettingsService = async (
  data: UpdateFieldSettingsPayload,
) => {
  const settings = await getFieldSettingsService();
  return await fieldRepository.updateFieldSettings(settings.id, data);
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
      data.bookingDate,
      data.startTime,
      data.endTime,
    );

  if (conflictingBooking) {
    throw new AppError(
      "Cannot request booking. This time slot is already reserved by another event.",
      400,
    );
  }

  // 3. Create the booking request
  return await fieldRepository.createFieldBooking(userId, data);
};

export const getMyBookingsService = async (userId: string) => {
  return await fieldRepository.findBookingsByUserId(userId, 100);
};

export const getAllBookingsService = async () => {
  return await fieldRepository.findAllBookings(100);
};

export const getApprovedScheduleService = async () => {
  // Start of the current day to filter out past dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return await fieldRepository.findApprovedFutureSchedule(today, 100);
};

export const updateBookingStatusService = async (
  id: string,
  status: "APPROVED" | "REJECTED",
) => {
  const booking = await fieldRepository.findBookingById(id);
  if (!booking) throw new AppError("Booking not found", 404);

  // If the admin is trying to approve, double-check for overlaps just in case
  // two pending requests were made for the same slot before one was approved.
  if (status === "APPROVED") {
    const conflictingBooking =
      await fieldRepository.findConflictingApprovedBooking(
        booking.bookingDate,
        booking.startTime,
        booking.endTime,
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
