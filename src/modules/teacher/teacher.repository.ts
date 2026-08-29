import { prisma } from "../../lib/prisma";

export const findUserByEmail = async (email: string) => {
  return await prisma.user.findUnique({
    where: { email },
  });
};

export const findTeacherProfileByTeacherId = async (teacherId: string) => {
  return await prisma.teacherProfile.findUnique({
    where: { teacherId },
  });
};

export const deleteUserSessions = async (userId: string) => {
  return await prisma.session.deleteMany({
    where: { userId },
  });
};

export const createTeacherProfileRecord = async (data: {
  userId: string;
  teacherId: string;
  designation: string;
  department: string;
  faculty: string;
}) => {
  return await prisma.teacherProfile.create({
    data,
  });
};

export const updateUserEmailVerified = async (
  userId: string,
  emailVerified: boolean,
) => {
  return await prisma.user.update({
    where: { id: userId },
    data: { emailVerified },
  });
};

export const deleteUserById = async (userId: string) => {
  return await prisma.user.delete({
    where: { id: userId },
  });
};

export const findTeacherUserById = async (userId: string) => {
  return await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      phoneNumber: true,
      bloodGroup: true,
      role: true,
      teacherProfile: {
        select: {
          teacherId: true,
          designation: true,
          department: true,
          faculty: true,
          officeRoom: true,
          consultationHours: true,
          expertiseFields: true,
          academicQualifications: true,
          linkedInUrl: true,
          personalWebsiteUrl: true,
        },
      },
    },
  });
};

export const updateTeacherUserImage = async (
  userId: string,
  imageUrl: string,
) => {
  return await prisma.user.update({
    where: { id: userId },
    data: { image: imageUrl },
    select: { id: true, name: true, image: true },
  });
};

export const updateTeacherUserAndProfile = async (
  userId: string,
  userUpdateData: Record<string, any>,
  profileUpdateData: Record<string, any>,
) => {
  return await prisma.$transaction(async (tx) => {
    if (Object.keys(userUpdateData).length > 0) {
      await tx.user.update({
        where: { id: userId },
        data: userUpdateData,
      });
    }

    if (Object.keys(profileUpdateData).length > 0) {
      await tx.teacherProfile.update({
        where: { userId },
        data: profileUpdateData,
      });
    }

    return await findTeacherUserById(userId);
  });
};
