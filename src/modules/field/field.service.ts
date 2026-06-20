import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { UpdateFieldSettingsPayload, BookFieldPayload } from "./field.schema";

export const getFieldSettingsService = async () => {
  let settings = await prisma.fieldSetting.findFirst();
  if (!settings) {
    settings = await prisma.fieldSetting.create({
      data: { isBookingOpen: true },
    });
  }
  return settings;
};

export const updateFieldSettingsService = async (
  data: UpdateFieldSettingsPayload,
) => {
  const settings = await getFieldSettingsService();
  return await prisma.fieldSetting.update({
    where: { id: settings.id },
    data,
  });
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
  const conflictingBooking = await prisma.fieldBooking.findFirst({
    where: {
      status: "APPROVED",
      bookingDate: data.bookingDate,
      // Overlap math: (newStart < existingEnd) AND (newEnd > existingStart)
      startTime: { lt: data.endTime },
      endTime: { gt: data.startTime },
    },
  });

  if (conflictingBooking) {
    throw new AppError(
      "Cannot request booking. This time slot is already reserved by another event.",
      400,
    );
  }

  // 3. Create the booking request
  return await prisma.fieldBooking.create({
    data: { ...data, userId },
  });
};

export const getMyBookingsService = async (userId: string) => {
  return await prisma.fieldBooking.findMany({
    where: { userId },
    orderBy: { bookingDate: "desc" },
  });
};

export const getAllBookingsService = async () => {
  return await prisma.fieldBooking.findMany({
    orderBy: { bookingDate: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  });
};

export const getApprovedScheduleService = async () => {
  // Start of the current day to filter out past dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return await prisma.fieldBooking.findMany({
    where: {
      status: "APPROVED",
      bookingDate: {
        gte: today,
      },
    },
    include: {
      user: { select: { name: true } },
    },
    orderBy: [{ bookingDate: "asc" }, { startTime: "asc" }],
  });
};

export const updateBookingStatusService = async (
  id: string,
  status: "APPROVED" | "REJECTED",
) => {
  const booking = await prisma.fieldBooking.findUnique({ where: { id } });
  if (!booking) throw new AppError("Booking not found", 404);

  // If the admin is trying to approve, double-check for overlaps just in case
  // two pending requests were made for the same slot before one was approved.
  if (status === "APPROVED") {
    const conflictingBooking = await prisma.fieldBooking.findFirst({
      where: {
        status: "APPROVED",
        bookingDate: booking.bookingDate,
        startTime: { lt: booking.endTime },
        endTime: { gt: booking.startTime },
      },
    });

    if (conflictingBooking) {
      throw new AppError(
        "Cannot approve. This time slot overlaps with an already approved booking.",
        400,
      );
    }
  }

  return await prisma.fieldBooking.update({
    where: { id },
    data: { status },
  });
};
