import { prisma } from "../../lib/prisma";
import { HubRole } from "../../constants/enums";
import { Prisma } from "../../../generated/prisma/client";
import { AppError } from "../../utils/AppError";
import {
  CreateHubPayload,
  UpdateHubPayload,
  type MyHubsView,
} from "./hub.schema";
import {
  CLASS_NOTICE_LIMITS,
  DhakaDayBounds,
  ONE_DAY_MS,
  SanitizedClassNoticeData,
  getDhakaDayBoundsUtc,
} from "./class-routine.domain";

const hubMemberUserSelect = {
  id: true,
  name: true,
  image: true,
  role: true,
  googleDriveConnected: true,
  email: true,
  phoneNumber: true,
  studentProfile: {
    select: {
      studentId: true,
      department: true,
      batch: true,
      currentSemester: true,
      section: true,
      program: true,
    },
  },
  teacherProfile: {
    select: {
      teacherId: true,
      department: true,
      designation: true,
      faculty: true,
      officeRoom: true,
      consultationSlots: true,
    },
  },
} satisfies Prisma.UserSelect;

// Normalize legacy database rows while the TA-removal migration is pending.
const normalizeHubRole = (role: string): HubRole => {
  switch (role) {
    case "TEACHER":
      return HubRole.TEACHER;
    case "CR":
      return HubRole.CR;
    case "STUDENT":
    case "TA":
      return HubRole.STUDENT;
    default:
      throw new Error(`Unexpected Course Hub membership role: ${role}`);
  }
};

export const findHubMember = async (userId: string, hubId: string) => {
  const [member] = await prisma.$queryRaw<
    Array<{
      id: string;
      userId: string;
      hubId: string;
      role: string;
      isActive: boolean;
    }>
  >`
    SELECT id, "userId", "hubId", "role"::text AS role, "isActive"
    FROM "HubMember"
    WHERE "userId" = ${userId} AND "hubId" = ${hubId}
    LIMIT 1
  `;

  return member ? { ...member, role: normalizeHubRole(member.role) } : null;
};

export interface FindAvailableTeachersQuery {
  search?: string;
  department?: string;
  page?: number | string;
  limit?: number | string;
}

export const DEFAULT_TEACHERS_PAGE_LIMIT = 20;
export const MAX_TEACHERS_PAGE_LIMIT = 50;

export const findAvailableTeachers = async (
  query?: FindAvailableTeachersQuery,
) => {
  const where: Prisma.UserWhereInput = {
    role: "TEACHER",
    isRestricted: false,
  };

  if (query?.department?.trim()) {
    where.teacherProfile = {
      department: { contains: query.department.trim(), mode: "insensitive" },
    };
  }

  if (query?.search?.trim()) {
    const s = query.search.trim();
    where.OR = [
      { name: { contains: s, mode: "insensitive" } },
      { email: { contains: s, mode: "insensitive" } },
      { phoneNumber: { contains: s, mode: "insensitive" } },
      {
        teacherProfile: {
          OR: [
            { department: { contains: s, mode: "insensitive" } },
            { designation: { contains: s, mode: "insensitive" } },
            { faculty: { contains: s, mode: "insensitive" } },
            { officeRoom: { contains: s, mode: "insensitive" } },
          ],
        },
      },
    ];
  }

  const select = {
    id: true,
    name: true,
    email: true,
    image: true,
    phoneNumber: true,
    role: true,
    teacherProfile: {
      select: {
        department: true,
        designation: true,
        faculty: true,
        officeRoom: true,
        consultationSlots: true,
        expertiseFields: true,
        linkedInUrl: true,
        personalWebsiteUrl: true,
      },
    },
  };

  const page = Math.max(1, Number(query?.page) || 1);
  const limit = Math.max(
    1,
    Math.min(
      MAX_TEACHERS_PAGE_LIMIT,
      Number(query?.limit) || DEFAULT_TEACHERS_PAGE_LIMIT,
    ),
  );
  const skip = (page - 1) * limit;

  const [teachers, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select,
      skip,
      take: limit,
      orderBy: { name: "asc" },
    }),
    prisma.user.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    teachers,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  };
};

export const MAX_CGPA_HUB_MEMBERSHIPS = 50;
export const MAX_HUB_LIST_MEMBERSHIPS = 100;
export const MAX_ADMIN_DEFAULT_HUBS = 50;

export const findActiveTeacherById = (teacherId: string) =>
  prisma.user.findUnique({
    where: { id: teacherId },
    select: {
      id: true,
      role: true,
      isRestricted: true,
    },
  });

export const findUserWithStudentProfile = (userId: string) =>
  prisma.user.findUnique({
    where: { id: userId },
    include: { studentProfile: true },
  });

export const findUserRoleAndCrStatus = (userId: string) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      studentProfile: {
        select: { isCR: true },
      },
    },
  });

export const createHubWithMembers = (
  userId: string,
  data: CreateHubPayload,
  isTeacher: boolean,
  isCR: boolean,
  joinCode: string,
) =>
  prisma.$transaction(async (tx) => {
    const hub = await tx.courseHub.create({
      data: {
        courseCode: data.courseCode,
        courseName: data.courseName,
        credit: data.credit,
        termOffer: data.termOffer,
        weeklyClassSchedule:
          data.weeklyClassSchedule as unknown as Prisma.InputJsonValue,
        department: data.department,
        batch: data.batch,
        section: data.section || null,
        semesterNumber: data.semesterNumber,
        joinCode,
      },
    });

    await tx.hubMember.create({
      data: { userId, hubId: hub.id, role: isTeacher ? "TEACHER" : "CR" },
    });

    if (isCR && data.teacherId) {
      await tx.hubMember.create({
        data: { userId: data.teacherId, hubId: hub.id, role: "TEACHER" },
      });
    }
    return hub;
  });

export const findHubByJoinCode = (joinCode: string) =>
  prisma.courseHub.findUnique({ where: { joinCode } });

export const createHubMember = (
  userId: string,
  hubId: string,
  role: HubRole = "STUDENT",
) =>
  prisma.hubMember.create({
    data: { userId, hubId, role },
    include: { hub: true },
  });

const getActiveNoticeWindow = (now: Date = new Date()) => {
  const dhakaToday = getDhakaDayBoundsUtc(now);
  const startMs = dhakaToday ? dhakaToday.startUtc.getTime() : now.getTime();
  return {
    cutoff: new Date(startMs - ONE_DAY_MS),
    horizon: new Date(
      startMs + (CLASS_NOTICE_LIMITS.advanceWindowDays + 1) * ONE_DAY_MS,
    ),
  };
};

export const getActiveNoticeCutoff = (now: Date = new Date()): Date =>
  getActiveNoticeWindow(now).cutoff;

export const getActiveNoticeHorizon = (now: Date = new Date()): Date =>
  getActiveNoticeWindow(now).horizon;

const buildActiveClassNoticesQuery = (now: Date = new Date()) => {
  const { cutoff, horizon } = getActiveNoticeWindow(now);
  return {
    where: {
      isActive: true,
      effectiveDate: {
        gte: cutoff,
        lte: horizon,
      },
    },
    select: {
      id: true,
      hubId: true,
      type: true,
      message: true,
      targetDay: true,
      targetStartTime: true,
      effectiveDate: true,
      newRoom: true,
      newTime: true,
      meetUrl: true,
      isActive: true,
      createdAt: true,
      author: {
        select: { id: true, name: true, image: true, role: true },
      },
    },
    orderBy: { createdAt: "desc" as const },
    take: 30,
  };
};

/**
 * Shared CourseHub projection for /api/hubs/my across all views:
 * "cgpa" (minimal course/credit fields), "exams" (term exam metadata),
 * "list" (Course Hubs tab card fields), "schedule" (routine + active notices),
 * and "default" (full legacy hub card).
 */
export const buildMyHubSelect = (
  view: MyHubsView = "default",
  now: Date = new Date(),
) => {
  if (view === "cgpa") {
    return {
      id: true,
      courseCode: true,
      courseName: true,
      credit: true,
      semesterNumber: true,
      termOffer: true,
      isArchived: true,
      createdAt: true,
    };
  }

  if (view === "exams") {
    return {
      id: true,
      courseCode: true,
      courseName: true,
      department: true,
      batch: true,
      section: true,
      semesterNumber: true,
      termOffer: true,
      isArchived: true,
      termExams: true,
      createdAt: true,
    };
  }

  if (view === "list") {
    return {
      id: true,
      courseCode: true,
      courseName: true,
      semesterNumber: true,
      section: true,
      isArchived: true,
      isClassLive: true,
      createdAt: true,
      _count: {
        select: {
          members: { where: { isActive: true } },
        },
      },
      members: {
        where: { role: HubRole.TEACHER, isActive: true },
        select: {
          id: true,
          role: true,
          user: { select: { id: true, name: true, image: true } },
        },
        take: 1,
      },
      assessments: {
        where: { deadline: { gt: now } },
        orderBy: { deadline: "asc" as const },
        take: 1,
        select: { id: true, title: true, type: true, deadline: true },
      },
    };
  }

  const baseSelect = {
    id: true,
    courseCode: true,
    courseName: true,
    department: true,
    batch: true,
    section: true,
    semesterNumber: true,
    termOffer: true,
    weeklyClassSchedule: true,
    isArchived: true,
    meetUrl: true,
    isClassLive: true,
    createdAt: true,
    members: {
      where: { role: HubRole.TEACHER, isActive: true },
      select: {
        id: true,
        role: true,
        user: { select: { id: true, name: true, image: true } },
      },
      take: 1,
    },
    classNotices: buildActiveClassNoticesQuery(now),
  };

  if (view === "schedule") {
    return baseSelect;
  }

  return {
    ...baseSelect,
    credit: true,
    joinCode: true,
    isReviewOpen: true,
    termExams: true,
    _count: {
      select: {
        members: { where: { isActive: true } },
      },
    },
    assessments: {
      where: { deadline: { gt: now } },
      orderBy: { deadline: "asc" as const },
      take: 1,
      select: { id: true, title: true, type: true, deadline: true },
    },
  };
};

export const findMyHubMemberships = (
  userId: string,
  view: MyHubsView = "default",
) => {
  const hubSelect = buildMyHubSelect(view);
  const isActiveOnlyView = view !== "default" && view !== "list";

  const memberHubSelect = {
    id: true,
    userId: true,
    hubId: true,
    role: true,
    isActive: true,
    hub: {
      select: hubSelect,
    },
  };

  if (view === "cgpa") {
    return prisma.hubMember.findMany({
      where: {
        userId,
        isActive: true,
        hub: { isArchived: false },
      },
      orderBy: { hub: { createdAt: "asc" as const } },
      take: MAX_CGPA_HUB_MEMBERSHIPS,
      select: memberHubSelect,
    });
  }

  return prisma.hubMember.findMany({
    where: {
      userId,
      isActive: true,
      ...(isActiveOnlyView ? { hub: { isArchived: false } } : {}),
    },
    orderBy: { hub: { createdAt: "desc" as const } },
    take: MAX_HUB_LIST_MEMBERSHIPS,
    select: memberHubSelect,
  });
};

/**
 * Returns course hubs across the university for administrative overview.
 * Mapped to standard HubMember structure so clients consume it seamlessly.
 */
export const findAllHubsForAdmin = async (
  adminUserId: string,
  view: MyHubsView = "default",
) => {
  const hubSelect = buildMyHubSelect(view);
  const isActiveOnlyView = view !== "default" && view !== "list";

  const hubs = await prisma.courseHub.findMany({
    ...(isActiveOnlyView ? { where: { isArchived: false } } : {}),
    orderBy: { createdAt: "desc" },
    take: MAX_ADMIN_DEFAULT_HUBS,
    select: hubSelect,
  });

  return hubs.map((hub) => ({
    id: `admin-view-${hub.id}`,
    userId: adminUserId,
    hubId: hub.id,
    role: "ADMIN" as HubRole | "ADMIN",
    isActive: true,
    joinedAt: hub.createdAt,
    hub,
  }));
};

export const findHubWithMembersAndDetails = async (hubId: string) => {
  const [hub, legacyMembers] = await Promise.all([
    prisma.courseHub.findUnique({
      where: { id: hubId },
      include: {
        members: {
          where: {
            isActive: true,
            role: { in: [HubRole.TEACHER, HubRole.CR, HubRole.STUDENT] },
          },
          include: { user: { select: hubMemberUserSelect } },
        },
        classNotices: buildActiveClassNoticesQuery(),
      },
    }),
    prisma.$queryRaw<
      Array<{
        id: string;
        userId: string;
        hubId: string;
        isActive: boolean;
      }>
    >`
      SELECT id, "userId", "hubId", "isActive"
      FROM "HubMember"
      WHERE "hubId" = ${hubId} AND "isActive" = true AND "role"::text = 'TA'
    `,
  ]);

  if (!hub || legacyMembers.length === 0) return hub;

  const legacyUsers = await prisma.user.findMany({
    where: { id: { in: legacyMembers.map((member) => member.userId) } },
    select: hubMemberUserSelect,
  });
  const usersById = new Map(legacyUsers.map((user) => [user.id, user]));

  const migratedMembers = legacyMembers.map((member) => {
    const user = usersById.get(member.userId);
    if (!user) {
      throw new Error(`Course Hub member ${member.id} has no associated user`);
    }

    return { ...member, role: HubRole.STUDENT, user };
  });

  return { ...hub, members: [...hub.members, ...migratedMembers] };
};

const toPrismaJson = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

export const updateHubAtomic = (
  hubId: string,
  data: UpdateHubPayload,
  archivedMessage: string,
) =>
  prisma.$transaction(async (tx) => {
    const [lockedHub] = await tx.$queryRaw<
      Array<{
        id: string;
        isArchived: boolean;
        termExams: Prisma.JsonValue | null;
      }>
    >`
      SELECT id, "isArchived", "termExams"
      FROM "CourseHub"
      WHERE id = ${hubId}
      FOR UPDATE
    `;

    if (!lockedHub) {
      throw new AppError("Course Hub not found.", 404);
    }
    if (lockedHub.isArchived) {
      throw new AppError(archivedMessage, 400);
    }

    const { weeklyClassSchedule, termExams, ...rest } = data;
    const updated = await tx.courseHub.update({
      where: { id: hubId },
      data: {
        ...rest,
        ...(weeklyClassSchedule !== undefined && {
          weeklyClassSchedule: toPrismaJson(weeklyClassSchedule),
        }),
        ...(termExams !== undefined && {
          termExams: toPrismaJson(termExams),
        }),
      },
    });

    return { previousTermExams: lockedHub.termExams, updated };
  });

export const updateHubArchiveStatus = (hubId: string, isArchived: boolean) =>
  prisma.courseHub.update({
    where: { id: hubId },
    data: { isArchived },
  });

export const updateHubLiveClassAtomic = (
  hubId: string,
  isClassLive: boolean,
  meetUrl?: string | null,
) =>
  prisma.$transaction(async (tx) => {
    const [lockedHub] = await tx.$queryRaw<
      Array<{ id: string; isArchived: boolean; meetUrl: string | null }>
    >`
      SELECT id, "isArchived", "meetUrl"
      FROM "CourseHub"
      WHERE id = ${hubId}
      FOR UPDATE
    `;

    if (!lockedHub) {
      throw new AppError("Course Hub not found.", 404);
    }
    if (lockedHub.isArchived) {
      throw new AppError(
        "Cannot modify live status for an archived course hub.",
        400,
      );
    }

    const effectiveMeetUrl =
      meetUrl !== undefined ? meetUrl : lockedHub.meetUrl;
    if (isClassLive && !effectiveMeetUrl) {
      throw new AppError(
        "Please configure an online class link before going live.",
        400,
      );
    }

    return tx.courseHub.update({
      where: { id: hubId },
      data: {
        isClassLive,
        ...(meetUrl !== undefined && { meetUrl }),
      },
    });
  });

export const deleteHubById = (hubId: string) =>
  prisma.courseHub.delete({
    where: { id: hubId },
  });

export const findHubStatusById = (hubId: string) =>
  prisma.courseHub.findUnique({
    where: { id: hubId },
    select: { id: true, isArchived: true, meetUrl: true, termExams: true },
  });

export const replaceClassNoticeAtomic = (
  hubId: string,
  authorId: string,
  data: SanitizedClassNoticeData,
  dhakaBounds: DhakaDayBounds,
) =>
  prisma.$transaction(async (tx) => {
    const [lockedHub] = await tx.$queryRaw<
      Array<{ id: string; isArchived: boolean }>
    >`
      SELECT id, "isArchived"
      FROM "CourseHub"
      WHERE id = ${hubId}
      FOR UPDATE
    `;

    if (!lockedHub) {
      throw new AppError("Course Hub not found.", 404);
    }
    if (lockedHub.isArchived) {
      throw new AppError(
        "Cannot publish class notices for an archived course hub.",
        400,
      );
    }

    await tx.classNotice.updateMany({
      where: {
        hubId,
        targetDay: { equals: data.targetDay, mode: "insensitive" },
        ...(data.targetStartTime !== undefined
          ? { targetStartTime: data.targetStartTime }
          : {}),
        effectiveDate: {
          gte: dhakaBounds.startUtc,
          lte: dhakaBounds.endUtc,
        },
        isActive: true,
      },
      data: { isActive: false },
    });

    return tx.classNotice.create({
      data: {
        hubId,
        authorId,
        type: data.type,
        message: data.message,
        targetDay: data.targetDay,
        targetStartTime: data.targetStartTime ?? null,
        effectiveDate: dhakaBounds.canonicalDate,
        newRoom: data.newRoom,
        newTime: data.newTime,
        meetUrl: data.meetUrl,
      },
      include: {
        author: {
          select: { id: true, name: true, image: true, role: true },
        },
      },
    });
  });

export const deactivateClassNoticeInHub = (hubId: string, noticeId: string) =>
  prisma.classNotice.updateMany({
    where: {
      id: noticeId,
      hubId,
      isActive: true,
    },
    data: { isActive: false },
  });
