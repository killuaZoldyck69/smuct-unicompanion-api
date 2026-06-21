import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { CreateHubPayload, UpdateHubPayload } from "./hub.schema";

// 🛡️ Centralized Authorization Helper
export const verifyHubRole = async (
  userId: string,
  hubId: string,
  allowedRoles: string[],
) => {
  const member = await prisma.hubMember.findUnique({
    where: { userId_hubId: { userId, hubId } },
  });
  if (!member || !allowedRoles.includes(member.role)) {
    throw new AppError(
      "You do not have permission to perform this action in this hub.",
      403,
    );
  }
  return member;
};

export const getAvailableTeachersService = async () => {
  return await prisma.user.findMany({
    where: { role: "TEACHER" },
    select: {
      id: true,
      name: true,
      email: true,
      teacherProfile: { select: { department: true, designation: true } },
    },
    orderBy: { name: "asc" },
  });
};

const generateJoinCode = () =>
  Math.random().toString(36).substring(2, 8).toUpperCase();

export const createHubService = async (
  userId: string,
  data: CreateHubPayload,
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { studentProfile: true },
  });

  if (!user) throw new AppError("User not found", 404);

  const isCR = user.studentProfile?.isCR === true;
  const isTeacher = user.role === "TEACHER";

  if (!isCR && !isTeacher) {
    throw new AppError(
      "Only Teachers and Class Representatives can create a Hub.",
      403,
    );
  }

  if (isCR && !data.teacherId) {
    throw new AppError(
      "CR must assign a teacher (teacherId) when creating a hub.",
      400,
    );
  }

  const joinCode = generateJoinCode();

  return await prisma.$transaction(async (tx) => {
    const hub = await tx.courseHub.create({
      data: {
        courseCode: data.courseCode,
        courseName: data.courseName,
        credit: data.credit,
        termOffer: data.termOffer,

        // Use 'as any' safely here if TS is still caching the old String type
        weeklyClassSchedule: data.weeklyClassSchedule as any,

        department: data.department,
        batch: data.batch,
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

export const joinHubService = async (userId: string, joinCode: string) => {
  const hub = await prisma.courseHub.findUnique({ where: { joinCode } });
  if (!hub) throw new AppError("Invalid join code.", 404);

  // Prisma will throw a unique constraint error if they are already a member
  return await prisma.hubMember.create({
    data: { userId, hubId: hub.id, role: "STUDENT" },
    include: { hub: true },
  });
};

export const getMyHubsService = async (userId: string) => {
  return await prisma.hubMember.findMany({
    where: { userId },
    include: {
      hub: {
        include: {
          _count: { select: { members: true } },
          members: {
            where: { role: "TEACHER" },
            select: { user: { select: { name: true } } },
            take: 1, // Just grab the primary teacher
          },
          assessments: {
            where: { deadline: { gt: new Date() } }, // Only future deadlines
            orderBy: { deadline: "asc" },
            take: 1, // Only get the absolute next upcoming assessment
            select: { id: true, title: true, type: true, deadline: true },
          },
        },
      },
    },
  });
};

export const getHubDetailsService = async (hubId: string) => {
  const hub = await prisma.courseHub.findUnique({
    where: { id: hubId },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, image: true, role: true } },
        },
      },
    },
  });
  if (!hub) throw new AppError("Hub not found", 404);
  return hub;
};

export const updateMemberRoleService = async (
  userId: string,
  hubId: string,
  memberId: string,
  newRole: any,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "TA"]);
  return await prisma.hubMember.update({
    where: { id: memberId },
    data: { role: newRole },
  });
};

// Update Hub Service
export const updateHubService = async (
  userId: string,
  hubId: string,
  data: UpdateHubPayload, // Ensure this type is imported from hub.schema.ts
) => {
  // Only Teachers and CRs can edit the hub details
  await verifyHubRole(userId, hubId, ["TEACHER", "CR"]);

  // Prisma natively handles the JSON arrays (like weeklyClassSchedule and termExams)
  return await prisma.courseHub.update({
    where: { id: hubId },
    data,
  });
};

export const archiveHubService = async (
  userId: string,
  hubId: string,
  isArchived: boolean,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "TA"]);
  return await prisma.courseHub.update({
    where: { id: hubId },
    data: { isArchived },
  });
};
