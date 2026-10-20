import { AppError } from "../../utils/AppError";
import { prisma } from "../../lib/prisma";
import * as studentRepository from "./student.repository";
import { OnboardStudentPayload, UpdateProfilePayload } from "./student.schema";
import { appCache } from "../../lib/cache";

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
  data: UpdateProfilePayload | any,
) => {
  // 1. User table updates
  const userUpdateData: Record<string, any> = {};
  if (data.name) userUpdateData.name = data.name.trim();
  if (data.phoneNumber !== undefined)
    userUpdateData.phoneNumber = data.phoneNumber?.trim() || null;
  if (data.bloodGroup !== undefined)
    userUpdateData.bloodGroup = data.bloodGroup || null;

  // 2. StudentProfile table updates
  const profileUpdateData: Record<string, any> = {};
  if (data.studentId !== undefined)
    profileUpdateData.studentId = data.studentId.trim();
  if (data.faculty !== undefined)
    profileUpdateData.faculty = data.faculty.trim();
  if (data.department !== undefined)
    profileUpdateData.department = data.department.trim();
  if (data.program !== undefined)
    profileUpdateData.program = data.program.trim();
  if (data.batch !== undefined) profileUpdateData.batch = data.batch.trim();
  if (data.currentSemester !== undefined)
    profileUpdateData.currentSemester = Number(data.currentSemester);
  if (data.section !== undefined) profileUpdateData.section = data.section.trim();
  if (data.currentTerm !== undefined)
    profileUpdateData.currentTerm = data.currentTerm ? data.currentTerm.trim() : null;
  if (data.isCR !== undefined)
    profileUpdateData.isCR = Boolean(data.isCR);
  if (data.skills !== undefined)
    profileUpdateData.skills = Array.isArray(data.skills) ? data.skills : [];
  if (data.linkedInUrl !== undefined)
    profileUpdateData.linkedInUrl = data.linkedInUrl ? data.linkedInUrl.trim() : null;
  if (data.personalWebsiteUrl !== undefined)
    profileUpdateData.personalWebsiteUrl = data.personalWebsiteUrl
      ? data.personalWebsiteUrl.trim()
      : null;

  const result = await studentRepository.updateStudentUserAndProfile(
    userId,
    userUpdateData,
    profileUpdateData,
  );

  // Invalidate in-memory caches
  appCache.delPattern(/^users:list/);
  appCache.delPattern(/^directory:students/);

  return result;
};
