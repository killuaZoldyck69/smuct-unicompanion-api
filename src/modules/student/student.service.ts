import { AppError } from "../../utils/AppError";
import { prisma } from "../../lib/prisma";
import * as studentRepository from "./student.repository";
import { OnboardStudentPayload, UpdateProfilePayload } from "./student.schema";
import { appCache } from "../../lib/cache";
import { envConfig } from "../../config/env";
import {
  evaluateDeletionGuardBlock,
  hashAccountIdentifier,
} from "../../utils/account-deletion-guard";

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

  const studentIdHash = hashAccountIdentifier(
    "STUDENT_ID",
    data.studentId,
    envConfig.BETTER_AUTH_SECRET,
  );
  const studentGuard = await prisma.accountDeletionGuard.findUnique({
    where: { identifierHash: studentIdHash },
    select: { isPermanentlyBlocked: true, blockedUntil: true },
  });
  const guardCheck = evaluateDeletionGuardBlock(studentGuard);
  if (guardCheck.blocked && guardCheck.message) {
    throw new AppError(guardCheck.message, 403);
  }

  const existingByStudentId =
    await studentRepository.findStudentProfileByStudentId(data.studentId);
  if (existingByStudentId && existingByStudentId.userId !== userId) {
    throw new AppError(
      "This Student ID is already registered to another account.",
      409,
    );
  }

  const created = await studentRepository.createStudentProfileWithRole(
    userId,
    data,
  );

  appCache.delPattern(/^users:list/);
  appCache.delPattern(/^directory:students/);

  return created;
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
    userUpdateData.phoneNumber = data.phoneNumber?.trim() || "";
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
