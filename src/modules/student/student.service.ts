import { BloodGroup } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";

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
      // Fetch the associated 1-to-1 academic profile
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
  data: {
    name?: string;
    phoneNumber?: string;
    bloodGroup?: BloodGroup; // 👈 Strongly typed
    batch?: string; // 👈 Added batch
    currentSemester?: number;
    section?: string;
  },
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
    if (data.batch) profileUpdateData.batch = data.batch; // 👈 Add batch logic
    if (data.currentSemester)
      profileUpdateData.currentSemester = Number(data.currentSemester);
    if (data.section !== undefined) profileUpdateData.section = data.section;

    if (Object.keys(profileUpdateData).length > 0) {
      await tx.studentProfile.update({
        where: { userId: userId },
        data: profileUpdateData,
      });
    }

    return await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        bloodGroup: true, // Will now return the strict Enum string
        studentProfile: {
          select: {
            batch: true,
            currentSemester: true,
            section: true,
          },
        },
      },
    });
  });
};
