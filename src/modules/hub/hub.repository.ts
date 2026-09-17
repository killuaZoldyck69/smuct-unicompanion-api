import { prisma } from "../../lib/prisma";
import { HubRole } from "../../constants/enums";
import { CreateHubPayload, UpdateHubPayload } from "./hub.schema";

export const findHubMember = async (userId: string, hubId: string) => {
  return await prisma.hubMember.findUnique({
    where: { userId_hubId: { userId, hubId } },
  });
};

export interface FindAvailableTeachersQuery {
  search?: string;
  department?: string;
  page?: number | string;
  limit?: number | string;
}

export const findAvailableTeachers = async (
  query?: FindAvailableTeachersQuery,
) => {
  const where: any = { role: "TEACHER" };

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
        consultationHours: true,
        expertiseFields: true,
        linkedInUrl: true,
        personalWebsiteUrl: true,
      },
    },
  };

  const isPaginated = query?.page !== undefined || query?.limit !== undefined;

  if (isPaginated) {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query?.limit) || 15));
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
  }

  const teachers = await prisma.user.findMany({
    where,
    select,
    orderBy: { name: "asc" },
  });

  return {
    teachers,
    meta: {
      page: 1,
      limit: teachers.length,
      total: teachers.length,
      totalPages: 1,
      hasMore: false,
    },
  };
};

export const findUserWithStudentProfile = async (userId: string) => {
  return await prisma.user.findUnique({
    where: { id: userId },
    include: { studentProfile: true },
  });
};

export const createHubWithMembers = async (
  userId: string,
  data: CreateHubPayload,
  isTeacher: boolean,
  isCR: boolean,
  joinCode: string,
) => {
  return await prisma.$transaction(async (tx) => {
    const hub = await tx.courseHub.create({
      data: {
        courseCode: data.courseCode,
        courseName: data.courseName,
        credit: data.credit,
        termOffer: data.termOffer,
        weeklyClassSchedule: data.weeklyClassSchedule as any,
        department: data.department,
        batch: data.batch,
        section: data.section || null,
        semesterNumber: data.semesterNumber,
        joinCode,
      },
    });

    // Add Creator to the Hub
    await tx.hubMember.create({
      data: { userId, hubId: hub.id, role: isTeacher ? "TEACHER" : "CR" },
    });

    // Automatically add the assigned teacher if a CR created it
    if (isCR && data.teacherId) {
      await tx.hubMember.create({
        data: { userId: data.teacherId, hubId: hub.id, role: "TEACHER" },
      });
    }
    return hub;
  });
};

export const findHubByJoinCode = async (joinCode: string) => {
  return await prisma.courseHub.findUnique({ where: { joinCode } });
};

export const createHubMember = async (
  userId: string,
  hubId: string,
  role: HubRole = "STUDENT",
) => {
  return await prisma.hubMember.create({
    data: { userId, hubId, role },
    include: { hub: true },
  });
};

export const findMyHubMemberships = async (userId: string) => {
  return await prisma.hubMember.findMany({
    where: { userId },
    include: {
      hub: {
        include: {
          _count: { select: { members: true } },
          members: {
            where: { role: "TEACHER" },
            select: {
              id: true,
              role: true,
              user: { select: { id: true, name: true, image: true, email: true } },
            },
            take: 1,
          },
          assessments: {
            where: { deadline: { gt: new Date() } },
            orderBy: { deadline: "asc" },
            take: 1,
            select: { id: true, title: true, type: true, deadline: true },
          },
          classNotices: {
            where: { isActive: true },
            include: {
              author: {
                select: { id: true, name: true, image: true, role: true },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });
};

export const findHubWithMembersAndDetails = async (hubId: string) => {
  return await prisma.courseHub.findUnique({
    where: { id: hubId },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
              role: true,
              email: true,
              studentProfile: { select: { studentId: true } },
              teacherProfile: { select: { teacherId: true } },
            },
          },
        },
      },
      classNotices: {
        where: { isActive: true },
        include: {
          author: {
            select: { id: true, name: true, image: true, role: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
};

export const findHubMemberById = async (memberId: string) => {
  return await prisma.hubMember.findUnique({
    where: { id: memberId },
  });
};

export const updateHubMemberRole = async (
  memberId: string,
  role: HubRole,
) => {
  return await prisma.hubMember.update({
    where: { id: memberId },
    data: { role },
  });
};

export const deleteHubMemberById = async (memberId: string) => {
  return await prisma.hubMember.delete({
    where: { id: memberId },
  });
};

export const updateHub = async (
  hubId: string,
  data: UpdateHubPayload,
) => {
  return await prisma.courseHub.update({
    where: { id: hubId },
    data,
  });
};

export const updateHubArchiveStatus = async (
  hubId: string,
  isArchived: boolean,
) => {
  return await prisma.courseHub.update({
    where: { id: hubId },
    data: { isArchived },
  });
};

export const updateHubLiveClass = async (
  hubId: string,
  isClassLive: boolean,
  meetUrl?: string | null,
) => {
  return await prisma.courseHub.update({
    where: { id: hubId },
    data: {
      isClassLive,
      ...(meetUrl !== undefined && { meetUrl }),
    },
  });
};

export const deleteHubById = async (hubId: string) => {
  return await prisma.courseHub.delete({
    where: { id: hubId },
  });
};

export const createClassNotice = async (
  hubId: string,
  authorId: string,
  data: {
    type: any;
    title?: string;
    message: string;
    targetDay: string;
    effectiveDate: Date;
    newRoom?: string;
    newTime?: string;
    meetUrl?: string;
  },
) => {
  return await prisma.classNotice.create({
    data: {
      hubId,
      authorId,
      type: data.type,
      title: data.title,
      message: data.message,
      targetDay: data.targetDay,
      effectiveDate: data.effectiveDate,
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
};

export const deactivatePreviousNotices = async (
  hubId: string,
  targetDay: string,
  effectiveDate: Date,
) => {
  // Start and end of the effective date to match the day
  const startOfDay = new Date(effectiveDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(effectiveDate);
  endOfDay.setHours(23, 59, 59, 999);

  return await prisma.classNotice.updateMany({
    where: {
      hubId,
      targetDay,
      effectiveDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
      isActive: true,
    },
    data: { isActive: false },
  });
};

export const findClassNoticeById = async (noticeId: string) => {
  return await prisma.classNotice.findUnique({
    where: { id: noticeId },
    include: {
      author: { select: { id: true, name: true, role: true } },
    },
  });
};

export const deleteClassNoticeById = async (noticeId: string) => {
  return await prisma.classNotice.update({
    where: { id: noticeId },
    data: { isActive: false },
  });
};

