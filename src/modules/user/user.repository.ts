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
    include: {
      studentProfile: true,
      teacherProfile: true,
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
