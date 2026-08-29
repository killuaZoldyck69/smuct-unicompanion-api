import { prisma } from "../../lib/prisma";
import { BookFieldPayload, UpdateFieldSettingsPayload } from "./field.schema";

export const findFieldSettings = async () => {
  return await prisma.fieldSetting.findFirst();
};

export const createDefaultFieldSettings = async () => {
  return await prisma.fieldSetting.create({
    data: { isBookingOpen: true },
  });
};

export const updateFieldSettings = async (
  id: string,
  data: UpdateFieldSettingsPayload,
) => {
  return await prisma.fieldSetting.update({
    where: { id },
    data,
  });
};

export const findConflictingApprovedBooking = async (
  bookingDate: Date,
  startTime: Date,
  endTime: Date,
) => {
  return await prisma.fieldBooking.findFirst({
    where: {
      status: "APPROVED",
      bookingDate,
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
  });
};

export const createFieldBooking = async (
  userId: string,
  data: BookFieldPayload,
) => {
  return await prisma.fieldBooking.create({
    data: { ...data, userId },
  });
};

export const findBookingsByUserId = async (
  userId: string,
  take = 100,
) => {
  return await prisma.fieldBooking.findMany({
    where: { userId },
    orderBy: { bookingDate: "desc" },
    take,
  });
};

export const findAllBookings = async (take = 100) => {
  return await prisma.fieldBooking.findMany({
    orderBy: { bookingDate: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    take,
  });
};

export const findApprovedFutureSchedule = async (
  today: Date,
  take = 100,
) => {
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
    take,
  });
};

export const findBookingById = async (id: string) => {
  return await prisma.fieldBooking.findUnique({
    where: { id },
  });
};

export const updateBookingStatus = async (
  id: string,
  status: "APPROVED" | "REJECTED",
) => {
  return await prisma.fieldBooking.update({
    where: { id },
    data: { status },
  });
};
