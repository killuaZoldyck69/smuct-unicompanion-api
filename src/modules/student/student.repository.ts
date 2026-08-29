import { prisma } from "../../lib/prisma";
import { OnboardStudentPayload } from "./student.schema";

export const findStudentProfileByUserId = async (userId: string) => {
  return await prisma.studentProfile.findUnique({
    where: { userId },
  });
};

export const createStudentProfileWithRole = async (
  userId: string,
  data: OnboardStudentPayload,
) => {
  return await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { role: "STUDENT" },
    });

    return await tx.studentProfile.create({
      data: {
        userId,
        studentId: data.studentId,
        faculty: data.faculty,
        department: data.department,
        program: data.program,
        batch: data.batch,
        currentSemester: data.currentSemester,
        section: data.section,
        isCR: false,
        isTA: false,
      },
    });
  });
};

export const updateStudentUserImage = async (
  userId: string,
  imageUrl: string,
) => {
  return await prisma.user.update({
    where: { id: userId },
    data: { image: imageUrl },
    select: { id: true, name: true, image: true },
  });
};

export const findStudentUserById = async (userId: string) => {
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
          faculty: true,
          department: true,
          program: true,
          batch: true,
          currentSemester: true,
          section: true,
          isCR: true,
          isTA: true,
          skills: true,
          linkedInUrl: true,
          personalWebsiteUrl: true,
        },
      },
    },
  });
};

export const updateStudentUserAndProfile = async (
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
      await tx.studentProfile.update({
        where: { userId },
        data: profileUpdateData,
      });
    }

    return await findStudentUserById(userId);
  });
};
