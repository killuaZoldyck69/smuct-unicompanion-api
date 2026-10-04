import { prisma } from "../../lib/prisma";
import { CreateEventPayload, UpdateEventPayload } from "./event.schema";

export const createCampusEvent = async (data: CreateEventPayload) => {
  return await prisma.campusEvent.create({
    data: {
      title: data.title,
      description: data.description,
      location: data.location,
      organizer: data.organizer,
      eventDate: data.eventDate,
    },
  });
};

export interface FindEventsParams {
  page?: number;
  limit?: number;
  tab?: "all" | "upcoming" | "today" | "past";
  search?: string;
  sortBy?: "eventDate" | "createdAt" | "title";
  sortOrder?: "asc" | "desc";
  currentUserId?: string;
}

export const findPaginatedCampusEvents = async (params: FindEventsParams) => {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(params.limit) || 10));
  const skip = (page - 1) * limit;
  const tab = params.tab || "upcoming";
  const search = params.search?.trim();
  const sortBy = params.sortBy || "eventDate";
  const sortOrder = params.sortOrder || (tab === "past" ? "desc" : "asc");
  const currentUserId = params.currentUserId;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  // Build date filter based on tab
  let dateFilter: any = {};
  if (tab === "upcoming") {
    dateFilter = { eventDate: { gte: startOfToday } };
  } else if (tab === "today") {
    dateFilter = { eventDate: { gte: startOfToday, lte: endOfToday } };
  } else if (tab === "past") {
    dateFilter = { eventDate: { lt: startOfToday } };
  }

  // Build search filter
  let searchFilter: any = {};
  if (search) {
    searchFilter = {
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
        { organizer: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ],
    };
  }

  const whereClause: any = {
    ...dateFilter,
    ...searchFilter,
  };

  // Run queries in parallel via transaction
  const [events, totalFiltered, countsUpcoming, countsToday, countsPast, countsAll, nextEventRaw] =
    await prisma.$transaction([
      // 1. Paginated Items
      prisma.campusEvent.findMany({
        where: whereClause,
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              interested: true,
            },
          },
          ...(currentUserId
            ? {
                interested: {
                  where: { userId: currentUserId },
                  select: { id: true },
                },
              }
            : {}),
        },
      }),

      // 2. Total count for this query
      prisma.campusEvent.count({
        where: whereClause,
      }),

      // 3. Tab Counts: Upcoming
      prisma.campusEvent.count({
        where: {
          eventDate: { gte: startOfToday },
          ...(search ? searchFilter : {}),
        },
      }),

      // 4. Tab Counts: Today
      prisma.campusEvent.count({
        where: {
          eventDate: { gte: startOfToday, lte: endOfToday },
          ...(search ? searchFilter : {}),
        },
      }),

      // 5. Tab Counts: Past
      prisma.campusEvent.count({
        where: {
          eventDate: { lt: startOfToday },
          ...(search ? searchFilter : {}),
        },
      }),

      // 6. Tab Counts: All
      prisma.campusEvent.count({
        where: search ? searchFilter : {},
      }),

      // 7. Next Upcoming Event (for Hero Card)
      prisma.campusEvent.findFirst({
        where: {
          eventDate: { gte: now },
        },
        orderBy: {
          eventDate: "asc",
        },
        include: {
          _count: {
            select: {
              interested: true,
            },
          },
          ...(currentUserId
            ? {
                interested: {
                  where: { userId: currentUserId },
                  select: { id: true },
                },
              }
            : {}),
        },
      }),
    ]);

  const items = events.map((ev) => ({
    id: ev.id,
    title: ev.title,
    description: ev.description,
    location: ev.location,
    organizer: ev.organizer,
    eventDate: ev.eventDate,
    createdAt: ev.createdAt,
    updatedAt: ev.updatedAt,
    interestedCount: ev._count?.interested || 0,
    isInterested: currentUserId ? (ev as any).interested?.length > 0 : false,
  }));

  const totalPages = Math.ceil(totalFiltered / limit) || 1;
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  const nextUpcomingEvent = nextEventRaw
    ? {
        id: nextEventRaw.id,
        title: nextEventRaw.title,
        description: nextEventRaw.description,
        location: nextEventRaw.location,
        organizer: nextEventRaw.organizer,
        eventDate: nextEventRaw.eventDate,
        createdAt: nextEventRaw.createdAt,
        updatedAt: nextEventRaw.updatedAt,
        interestedCount: nextEventRaw._count?.interested || 0,
        isInterested: currentUserId ? (nextEventRaw as any).interested?.length > 0 : false,
      }
    : null;

  return {
    items,
    pagination: {
      page,
      limit,
      totalCount: totalFiltered,
      totalPages,
      hasNextPage,
      hasPrevPage,
      nextPage: hasNextPage ? page + 1 : null,
    },
    counts: {
      upcoming: countsUpcoming,
      today: countsToday,
      past: countsPast,
      all: countsAll,
    },
    nextUpcomingEvent,
  };
};

export const findAllCampusEvents = async (take = 100, currentUserId?: string) => {
  const events = await prisma.campusEvent.findMany({
    orderBy: {
      eventDate: "asc",
    },
    include: {
      _count: {
        select: {
          interested: true,
        },
      },
      ...(currentUserId
        ? {
            interested: {
              where: { userId: currentUserId },
              select: { id: true },
            },
          }
        : {}),
    },
    take,
  });

  return events.map((ev) => ({
    id: ev.id,
    title: ev.title,
    description: ev.description,
    location: ev.location,
    organizer: ev.organizer,
    eventDate: ev.eventDate,
    createdAt: ev.createdAt,
    updatedAt: ev.updatedAt,
    interestedCount: ev._count?.interested || 0,
    isInterested: currentUserId ? (ev as any).interested?.length > 0 : false,
  }));
};

export const findCampusEventById = async (id: string, currentUserId?: string) => {
  const ev = await prisma.campusEvent.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          interested: true,
        },
      },
      ...(currentUserId
        ? {
            interested: {
              where: { userId: currentUserId },
              select: { id: true },
            },
          }
        : {}),
    },
  });

  if (!ev) return null;

  return {
    id: ev.id,
    title: ev.title,
    description: ev.description,
    location: ev.location,
    organizer: ev.organizer,
    eventDate: ev.eventDate,
    createdAt: ev.createdAt,
    updatedAt: ev.updatedAt,
    interestedCount: ev._count?.interested || 0,
    isInterested: currentUserId ? (ev as any).interested?.length > 0 : false,
  };
};

export const toggleEventInterested = async (eventId: string, userId: string) => {
  const existing = await prisma.eventInterested.findUnique({
    where: {
      eventId_userId: {
        eventId,
        userId,
      },
    },
  });

  let isInterested = false;
  if (existing) {
    await prisma.eventInterested.delete({
      where: { id: existing.id },
    });
    isInterested = false;
  } else {
    await prisma.eventInterested.create({
      data: {
        eventId,
        userId,
      },
    });
    isInterested = true;
  }

  const count = await prisma.eventInterested.count({
    where: { eventId },
  });

  return {
    isInterested,
    interestedCount: count,
  };
};

export const getEventInterested = async (eventId: string, userId?: string) => {
  const count = await prisma.eventInterested.count({
    where: { eventId },
  });

  let isInterested = false;
  if (userId) {
    const userInterest = await prisma.eventInterested.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });
    isInterested = !!userInterest;
  }

  return {
    isInterested,
    interestedCount: count,
  };
};

export const updateCampusEvent = async (id: string, data: UpdateEventPayload) => {
  return await prisma.campusEvent.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.location !== undefined ? { location: data.location } : {}),
      ...(data.organizer !== undefined ? { organizer: data.organizer } : {}),
      ...(data.eventDate !== undefined ? { eventDate: data.eventDate } : {}),
    },
  });
};

export const deleteCampusEventById = async (id: string) => {
  return await prisma.campusEvent.delete({
    where: { id },
  });
};
