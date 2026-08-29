import { prisma } from "../../lib/prisma";
import { HubRole } from "../../constants/enums";
import { CreateHubPayload, UpdateHubPayload } from "./hub.schema";

export const findHubMember = async (userId: string, hubId: string) => {
  return await prisma.hubMember.findUnique({
    where: { userId_hubId: { userId, hubId } },
  });
};

export const findAvailableTeachers = async () => {
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
            select: { user: { select: { name: true } } },
            take: 1,
          },
          assessments: {
            where: { deadline: { gt: new Date() } },
            orderBy: { deadline: "asc" },
            take: 1,
            select: { id: true, title: true, type: true, deadline: true },
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

export const deleteHubById = async (hubId: string) => {
  return await prisma.courseHub.delete({
    where: { id: hubId },
  });
};
