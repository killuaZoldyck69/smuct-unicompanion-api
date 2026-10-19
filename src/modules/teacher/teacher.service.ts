import { auth } from "../../lib/auth";
import { AppError } from "../../utils/AppError";
import { envConfig } from "../../config/env";
import * as teacherRepository from "./teacher.repository";
import { RegisterTeacherPayload, UpdateTeacherPayload } from "./teacher.schema";
import {
  pendingTeacherRegistrationEmails,
  sendTeacherWelcomeEmail,
} from "../../services/auth-email.service";
import { appCache } from "../../lib/cache";
import { sortQualifications } from "../../utils/qualification-order";

export const registerTeacherService = async (data: RegisterTeacherPayload) => {
  const sanitizedTeacherId = data.teacherId.trim();
  const sanitizedEmail = data.email.trim().toLowerCase();
  const sanitizedName = data.name.trim();

  // 1. Pre-check: Ensure email is unique (case-insensitive)
  const existingEmail = await teacherRepository.findUserByEmail(sanitizedEmail);

  if (existingEmail) {
    throw new AppError("A user with this email already exists.", 409);
  }

  // 2. Pre-check: Ensure Teacher ID is unique
  const existingTeacherId =
    await teacherRepository.findTeacherProfileByTeacherId(sanitizedTeacherId);

  if (existingTeacherId) {
    throw new AppError(
      "This Teacher ID is already registered in the system.",
      409,
    );
  }

  let authResponse: any;

  // Track pending registration to suppress unnecessary OTP dispatch during creation
  pendingTeacherRegistrationEmails.add(sanitizedEmail);

  try {
    // 3. Create core user account via Better Auth
    authResponse = await auth.api.signUpEmail({
      body: {
        email: sanitizedEmail,
        password: data.password,
        name: sanitizedName,
      },
    });
  } catch (error: any) {
    const status = error.status || error.statusCode || 400;
    const message =
      error.body?.message || error.message || "Failed to create core user account";
    throw new AppError(message, status);
  } finally {
    pendingTeacherRegistrationEmails.delete(sanitizedEmail);
  }

  if (!authResponse?.user) {
    throw new AppError("Unexpected error during teacher registration.", 500);
  }

  const userId = authResponse.user.id;

  try {
    // 4 & 5. Atomically revoke initial session, set TEACHER role, and create profile
    const consultationHours =
      data.consultationHours ||
      (Array.isArray(data.consultationSlots) && data.consultationSlots.length > 0
        ? data.consultationSlots
            .map((s) => `${s.day}: ${s.startTime} - ${s.endTime}`)
            .join(", ")
        : undefined);

    const advisoryBatch =
      data.advisoryBatch !== undefined && data.advisoryBatch !== null
        ? typeof data.advisoryBatch === "string"
          ? parseInt(data.advisoryBatch, 10)
          : data.advisoryBatch
        : undefined;

    const profile = await teacherRepository.createTeacherProfileTransaction(
      userId,
      {
        userId: userId,
        teacherId: sanitizedTeacherId,
        designation: data.designation.trim(),
        department: data.department.trim(),
        faculty: data.faculty.trim(),
        officeRoom: data.officeRoom?.trim() || undefined,
        consultationHours,
        advisoryBatch: isNaN(advisoryBatch as number) ? undefined : advisoryBatch,
        dayOff: data.dayOff?.trim() || undefined,
        consultationSlots: data.consultationSlots,
        expertiseFields: data.expertiseFields || [],
        academicQualifications: Array.isArray(data.academicQualifications)
          ? sortQualifications(
              data.academicQualifications,
              (q: any) => q.degree || "",
              (q: any) => q.passingYear || q.year || "",
            )
          : data.academicQualifications,
        linkedInUrl: data.linkedInUrl?.trim() || undefined,
        personalWebsiteUrl: data.personalWebsiteUrl?.trim() || undefined,
      },
    );

    // Invalidate user directory and teacher directory in-memory caches
    appCache.delPattern(/^users:list/);
    appCache.delPattern(/^directory:teachers/);

    // Non-blocking welcome email with credentials, academic info, and security warning
    try {
      await sendTeacherWelcomeEmail({
        name: sanitizedName,
        email: sanitizedEmail,
        teacherId: sanitizedTeacherId,
        temporaryPassword: data.password,
        designation: data.designation.trim(),
        department: data.department.trim(),
        faculty: data.faculty.trim(),
        officeRoom: data.officeRoom?.trim() || undefined,
      });
    } catch (emailErr) {
      console.warn(
        `[TeacherService] Account created successfully, but welcome email could not be dispatched for ${sanitizedEmail}:`,
        emailErr,
      );
    }

    return { user: authResponse.user, profile };
  } catch (error: any) {
    // Rollback orphaned auth user
    await teacherRepository.deleteUserById(userId);
    console.error("Teacher Profile creation failed, rolled back user:", error);

    if (error.code === "P2002") {
      throw new AppError(
        "This Teacher ID is already registered in the system.",
        409,
      );
    }

    throw new AppError(
      error.message || "Failed to create teacher profile. Database rolled back.",
      error.statusCode || 500,
    );
  }
};

export const getTeacherProfileByUserId = async (userId: string) => {
  return await teacherRepository.findTeacherUserById(userId);
};

export const updateTeacherProfileImageService = async (
  userId: string,
  imageUrl: string,
) => {
  return await teacherRepository.updateTeacherUserImage(userId, imageUrl);
};

export const updateTeacherProfileData = async (
  userId: string,
  data: UpdateTeacherPayload,
) => {
  // 1. Update Core User Data
  const userUpdateData: Record<string, any> = {};
  if (data.name) userUpdateData.name = data.name.trim();
  if (data.phoneNumber !== undefined)
    userUpdateData.phoneNumber = data.phoneNumber?.trim() || null;
  if (data.bloodGroup !== undefined)
    userUpdateData.bloodGroup = data.bloodGroup || null;

  // 2. Update Delegated Teacher Profile Data
  const profileUpdateData: Record<string, any> = {};
  if (data.designation) profileUpdateData.designation = data.designation.trim();
  if (data.administrativeRole !== undefined)
    profileUpdateData.administrativeRole = data.administrativeRole
      ? data.administrativeRole.trim()
      : null;
  if (data.department) profileUpdateData.department = data.department.trim();
  if (data.faculty !== undefined) profileUpdateData.faculty = data.faculty;
  if (data.officeRoom !== undefined)
    profileUpdateData.officeRoom = data.officeRoom;
  if (data.advisoryBatch !== undefined)
    profileUpdateData.advisoryBatch = data.advisoryBatch;
  if (data.dayOff !== undefined)
    profileUpdateData.dayOff = data.dayOff;
  if (data.consultationSlots !== undefined) {
    profileUpdateData.consultationSlots = data.consultationSlots;
    if (data.consultationHours === undefined && Array.isArray(data.consultationSlots)) {
      profileUpdateData.consultationHours = data.consultationSlots
        .map((s) => `${s.day}: ${s.startTime} - ${s.endTime}`)
        .join(", ");
    }
  }
  if (data.consultationHours !== undefined)
    profileUpdateData.consultationHours = data.consultationHours;

  if (data.expertiseFields !== undefined)
    profileUpdateData.expertiseFields = data.expertiseFields;
  if (data.academicQualifications !== undefined) {
    profileUpdateData.academicQualifications = Array.isArray(
      data.academicQualifications,
    )
      ? sortQualifications(
          data.academicQualifications,
          (q: any) => q.degree || "",
          (q: any) => q.passingYear || q.year || "",
        )
      : data.academicQualifications;
  }
  if (data.linkedInUrl !== undefined)
    profileUpdateData.linkedInUrl = data.linkedInUrl;
  if (data.personalWebsiteUrl !== undefined)
    profileUpdateData.personalWebsiteUrl = data.personalWebsiteUrl;

  const result = await teacherRepository.updateTeacherUserAndProfile(
    userId,
    userUpdateData,
    profileUpdateData,
  );

  // Invalidate user directory and teacher directory in-memory caches
  appCache.delPattern(/^users:list/);
  appCache.delPattern(/^directory:teachers/);

  return result;
};
