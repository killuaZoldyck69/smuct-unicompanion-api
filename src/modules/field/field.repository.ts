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

/**
 * Checks if the requested time slot overlaps with an already approved booking.
 * startTime < newEndTime && endTime > newStartTime ensures cross-boundary overlap detection.
 */
export const findConflictingApprovedBooking = async (
  startTime: Date,
  endTime: Date,
  excludeBookingId?: string,
) => {
  return await prisma.fieldBooking.findFirst({
    where: {
      status: "APPROVED",
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
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
    data: {
      userId,
      purpose: data.purpose,
      bookingDate: data.bookingDate,
      startTime: data.startTime,
      endTime: data.endTime,
    },
  });
};

export const findBookingsByUserId = async (
  userId: string,
  filter?: { status?: string },
  skip = 0,
  take = 20,
) => {
  const where: any = { userId };
  if (filter?.status && filter.status !== "ALL") {
    where.status = filter.status;
  }

  const [items, total] = await Promise.all([
    prisma.fieldBooking.findMany({
      where,
      orderBy: [{ bookingDate: "desc" }, { startTime: "desc" }],
      skip,
      take,
    }),
    prisma.fieldBooking.count({ where }),
  ]);

  return { items, total };
};

export const findAllBookings = async (
  filter: {
    status?: string;
    search?: string;
    startDate?: Date;
    endDate?: Date;
  },
  skip = 0,
  take = 20,
) => {
  const where: any = {};

  if (filter.status && filter.status !== "ALL") {
    where.status = filter.status;
  }

  if (filter.startDate || filter.endDate) {
    where.bookingDate = {};
    if (filter.startDate) where.bookingDate.gte = filter.startDate;
    if (filter.endDate) where.bookingDate.lte = filter.endDate;
  }

  if (filter.search) {
    const q = filter.search;
    where.OR = [
      { purpose: { contains: q, mode: "insensitive" } },
      { user: { name: { contains: q, mode: "insensitive" } } },
      { user: { email: { contains: q, mode: "insensitive" } } },
      {
        user: {
          studentProfile: { studentId: { contains: q, mode: "insensitive" } },
        },
      },
      {
        user: {
          teacherProfile: { teacherId: { contains: q, mode: "insensitive" } },
        },
      },
      {
        user: {
          studentProfile: {
            department: { contains: q, mode: "insensitive" },
          },
        },
      },
      {
        user: {
          teacherProfile: {
            department: { contains: q, mode: "insensitive" },
          },
        },
      },
    ];
  }

  const [items, total, statusGroups] = await Promise.all([
    prisma.fieldBooking.findMany({
      where,
      orderBy: [{ bookingDate: "desc" }, { startTime: "desc" }],
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
            phoneNumber: true,
            studentProfile: {
              select: {
                studentId: true,
                department: true,
                program: true,
                batch: true,
                currentSemester: true,
                section: true,
              },
            },
            teacherProfile: {
              select: {
                teacherId: true,
                designation: true,
                department: true,
                faculty: true,
                officeRoom: true,
              },
            },
          },
        },
      },
      skip,
      take,
    }),
    prisma.fieldBooking.count({ where }),
    prisma.fieldBooking.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  let allCount = 0;
  let pendingCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;
  statusGroups.forEach((g) => {
    const c = g._count._all;
    allCount += c;
    if (g.status === "PENDING") pendingCount += c;
    else if (g.status === "APPROVED") approvedCount += c;
    else if (g.status === "REJECTED") rejectedCount += c;
  });

  return {
    items,
    total,
    counts: {
      all: allCount,
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
    },
  };
};

export const findApprovedSchedule = async (
  filter?: { startDate?: Date; endDate?: Date },
  take = 500,
) => {
  const where: any = {
    status: "APPROVED",
  };

  if (filter?.startDate || filter?.endDate) {
    where.bookingDate = {};
    if (filter.startDate) where.bookingDate.gte = filter.startDate;
    if (filter.endDate) where.bookingDate.lte = filter.endDate;
  }

  return await prisma.fieldBooking.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
          phoneNumber: true,
          studentProfile: {
            select: {
              studentId: true,
              department: true,
              program: true,
              batch: true,
              currentSemester: true,
              section: true,
            },
          },
          teacherProfile: {
            select: {
              teacherId: true,
              designation: true,
              department: true,
              faculty: true,
              officeRoom: true,
            },
          },
        },
      },
    },
    orderBy: [{ bookingDate: "asc" }, { startTime: "asc" }],
    take,
  });
};

export const findApprovedFutureSchedule = findApprovedSchedule;

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

export const deleteBooking = async (id: string) => {
  return await prisma.fieldBooking.delete({
    where: { id },
  });
};
