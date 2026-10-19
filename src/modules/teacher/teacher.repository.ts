import { prisma } from "../../lib/prisma";

export const findUserByEmail = async (email: string) => {
  return await prisma.user.findFirst({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
    },
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
  officeRoom?: string;
  consultationHours?: string | null;
  advisoryBatch?: number | null;
  dayOff?: string | null;
  consultationSlots?: any;
  expertiseFields?: string[];
  academicQualifications?: any;
  linkedInUrl?: string | null;
  personalWebsiteUrl?: string | null;
}) => {
  return await prisma.teacherProfile.create({
    data,
  });
};

export const createTeacherProfileTransaction = async (
  userId: string,
  profileData: Parameters<typeof createTeacherProfileRecord>[0],
) => {
  return await prisma.$transaction(async (tx) => {
    await tx.session.deleteMany({
      where: { userId },
    });

    await tx.user.update({
      where: { id: userId },
      data: { emailVerified: true, role: "TEACHER" },
    });

    return await tx.teacherProfile.create({
      data: profileData,
    });
  });
};

export const updateUserEmailVerified = async (
  userId: string,
  emailVerified: boolean,
) => {
  return await prisma.user.update({
    where: { id: userId },
    data: { emailVerified, role: "TEACHER" },
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
      isRestricted: true,
      teacherProfile: {
        select: {
          id: true,
          teacherId: true,
          designation: true,
          administrativeRole: true,
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
