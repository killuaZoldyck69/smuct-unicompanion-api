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
          department: true,
          faculty: true,
          officeRoom: true,
          consultationHours: true,
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

