import { prisma } from "../../../lib/prisma";
import { HubRole } from "../../../constants/enums";

export const findMemberById = async (memberId: string) => {
  return await prisma.hubMember.findUnique({
    where: { id: memberId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          phoneNumber: true,
        },
      },
    },
  });
};

export const findMemberByHubAndId = async (hubId: string, memberId: string) => {
  return await prisma.hubMember.findFirst({
    where: { id: memberId, hubId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          phoneNumber: true,
        },
      },
    },
  });
};

export const findHubMembership = async (userId: string, hubId: string) => {
  return await prisma.hubMember.findUnique({
    where: { userId_hubId: { userId, hubId } },
  });
};

export const updateRole = async (memberId: string, role: HubRole) => {
  return await prisma.hubMember.update({
    where: { id: memberId },
    data: { role },
  });
};

export const deleteMember = async (memberId: string) => {
  return await prisma.hubMember.delete({
    where: { id: memberId },
  });
};

export const findMembersByHubId = async (hubId: string) => {
  return await prisma.hubMember.findMany({
    where: { hubId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          image: true,
          role: true,
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
              consultationHours: true,
            },
          },
        },
      },
    },
  });
};
