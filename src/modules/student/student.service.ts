import { AppError } from "../../utils/AppError";
import { prisma } from "../../lib/prisma";
import * as studentRepository from "./student.repository";
import { OnboardStudentPayload, UpdateProfilePayload } from "./student.schema";

export const onboardStudentService = async (
  userId: string,
  data: OnboardStudentPayload,
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { studentProfile: true, teacherProfile: true },
  });

  if (!user) {
    throw new AppError("User not found.", 404);
  }

  if (user.studentProfile) {
    throw new AppError("A student profile already exists for this user.", 409);
  }

  if (user.role === "TEACHER" || user.role === "ADMIN" || user.teacherProfile !== null) {
    throw new AppError(
      "Teacher and administrator accounts cannot be onboarded as students.",
      403,
    );
  }

  if (!user.emailVerified) {
    throw new AppError("Email must be verified before student onboarding.", 403);
  }

  return await studentRepository.createStudentProfileWithRole(userId, data);
};

export const updateProfileImageService = async (
  userId: string,
  imageUrl: string,
) => {
  return await studentRepository.updateStudentUserImage(userId, imageUrl);
};

export const getStudentProfileByUserId = async (userId: string) => {
  return await studentRepository.findStudentUserById(userId);
};

export const updateStudentProfileData = async (
  userId: string,
  data: UpdateProfilePayload,
) => {
  // 1. User table updates
  const userUpdateData: Record<string, any> = {};
  if (data.name) userUpdateData.name = data.name;
  if (data.phoneNumber !== undefined)
    userUpdateData.phoneNumber = data.phoneNumber;
  if (data.bloodGroup !== undefined)
    userUpdateData.bloodGroup = data.bloodGroup;

  // 2. StudentProfile table updates
  const profileUpdateData: Record<string, any> = {};
  if (data.batch) profileUpdateData.batch = data.batch;
  if (data.currentSemester)
    profileUpdateData.currentSemester = data.currentSemester;
  if (data.section !== undefined) profileUpdateData.section = data.section;
  if (data.currentTerm !== undefined)
    profileUpdateData.currentTerm = data.currentTerm;
  if (data.skills !== undefined) profileUpdateData.skills = data.skills;
  if (data.linkedInUrl !== undefined)
    profileUpdateData.linkedInUrl = data.linkedInUrl;
  if (data.personalWebsiteUrl !== undefined)
    profileUpdateData.personalWebsiteUrl = data.personalWebsiteUrl;

  return await studentRepository.updateStudentUserAndProfile(
    userId,
    userUpdateData,
    profileUpdateData,
  );
};
