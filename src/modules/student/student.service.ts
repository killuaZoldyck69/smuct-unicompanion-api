import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";

type OnboardPayload = {
  studentId: string;
  department: string;
  batch: string;
  currentSemester: number;
  section?: string;
};

type UpdateProfilePayload = {
  name?: string;
  phoneNumber?: string;
  bloodGroup?: any;
  batch?: string;
  currentSemester?: number;
  section?: string;
};

export const onboardStudentService = async (
  userId: string,
  data: OnboardPayload,
) => {
  // Check for existing profile to prevent manual duplication outside of unique constraints
  const existingProfile = await prisma.studentProfile.findUnique({
    where: { userId },
  });

  if (existingProfile) {
    throw new AppError("A student profile already exists for this user.", 409);
  }

  return await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { role: "STUDENT" },
    });

    return await tx.studentProfile.create({
      data: {
        userId,
        studentId: data.studentId,
        department: data.department,
        batch: data.batch,
        currentSemester: data.currentSemester,
        section: data.section || null,
        isCR: false,
        isTA: false,
      },
    });
  });
};

export const updateProfileImageService = async (
  userId: string,
  imageUrl: string,
) => {
  return await prisma.user.update({
    where: { id: userId },
    data: { image: imageUrl },
    select: { id: true, name: true, image: true },
  });
};

export const getStudentProfileByUserId = async (userId: string) => {
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
      studentProfile: {
        select: {
          studentId: true,
          department: true,
          batch: true,
          currentSemester: true,
          section: true,
          isCR: true,
          isTA: true,
        },
      },
    },
  });
};

export const updateStudentProfileData = async (
  userId: string,
  data: UpdateProfilePayload,
) => {
  return await prisma.$transaction(async (tx) => {
    // 1. User table updates
    const userUpdateData: any = {};
    if (data.name) userUpdateData.name = data.name;
    if (data.phoneNumber !== undefined)
      userUpdateData.phoneNumber = data.phoneNumber;
    if (data.bloodGroup !== undefined)
      userUpdateData.bloodGroup = data.bloodGroup;

    if (Object.keys(userUpdateData).length > 0) {
      await tx.user.update({
        where: { id: userId },
        data: userUpdateData,
      });
    }

    // 2. StudentProfile table updates
    const profileUpdateData: any = {};
    if (data.batch) profileUpdateData.batch = data.batch;
    if (data.currentSemester)
      profileUpdateData.currentSemester = data.currentSemester;
    if (data.section !== undefined) profileUpdateData.section = data.section;

    if (Object.keys(profileUpdateData).length > 0) {
      await tx.studentProfile.update({
        where: { userId: userId },
        data: profileUpdateData,
      });
    }

    // Return merged updated data
    return await getStudentProfileByUserId(userId);
  });
};
