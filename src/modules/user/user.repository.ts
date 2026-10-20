import { prisma } from "../../lib/prisma";

export const findUsersWithProfiles = async (
  where: Record<string, any>,
  skip: number,
  take: number,
) => {
  return await prisma.user.findMany({
    where,
    skip,
    take,
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      role: true,
      phoneNumber: true,
      bloodGroup: true,
      isRestricted: true,
      createdAt: true,
      studentProfile: {
        select: {
          id: true,
          studentId: true,
          faculty: true,
          department: true,
          program: true,
          batch: true,
          currentSemester: true,
          section: true,
          currentTerm: true,
          isCR: true,
          skills: true,
          linkedInUrl: true,
          personalWebsiteUrl: true,
        },
      },
      teacherProfile: {
        select: {
          id: true,
          teacherId: true,
          designation: true,
          administrativeRole: true,
          department: true,
          faculty: true,
          officeRoom: true,
          advisoryBatch: true,
          dayOff: true,
          consultationSlots: true,
          expertiseFields: true,
          academicQualifications: true,
          linkedInUrl: true,
          personalWebsiteUrl: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

export const countUsers = async (where: Record<string, any>) => {
  return await prisma.user.count({ where });
};

export const findUserById = async (id: string) => {
  return await prisma.user.findUnique({
    where: { id },
  });
};

export const findUserWithStudentProfile = async (id: string) => {
  return await prisma.user.findUnique({
    where: { id },
    include: { studentProfile: true },
  });
};

export const findUserWithTeacherProfile = async (id: string) => {
  return await prisma.user.findUnique({
    where: { id },
    include: { teacherProfile: true },
  });
};

export const deleteUserById = async (id: string) => {
  return await prisma.user.delete({
    where: { id },
  });
};

export const updateStudentProfileByUserId = async (
  userId: string,
  data: Record<string, any>,
) => {
  return await prisma.studentProfile.update({
    where: { userId },
    data,
  });
};

export const updateTeacherProfileByUserId = async (
  userId: string,
  data: Record<string, any>,
) => {
  return await prisma.teacherProfile.update({
    where: { userId },
    data,
  });
};

export const updateUserImageById = async (id: string, image: string) => {
  return await prisma.user.update({
    where: { id },
    data: { image },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
    },
  });
};

export const setUserRestrictedById = async (id: string, isRestricted: boolean) => {
  return await prisma.user.update({
    where: { id },
    data: { isRestricted },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isRestricted: true,
    },
  });
};

export const revokeAllUserSessions = async (userId: string) => {
  return await prisma.session.deleteMany({
    where: { userId },
  });
};

