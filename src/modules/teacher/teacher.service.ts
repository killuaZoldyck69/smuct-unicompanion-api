import { auth } from "../../lib/auth";
import { AppError } from "../../utils/AppError";
import { envConfig } from "../../config/env";
import * as teacherRepository from "./teacher.repository";
import { RegisterTeacherPayload, UpdateTeacherPayload } from "./teacher.schema";

export const registerTeacherService = async (data: RegisterTeacherPayload) => {
  // 1. Pre-check: Ensure email is unique
  const existingEmail = await teacherRepository.findUserByEmail(data.email);

  if (existingEmail) {
    throw new AppError("A user with this email already exists.", 409);
  }

  // 2. Pre-check: Ensure Teacher ID is unique
  const existingTeacherId =
    await teacherRepository.findTeacherProfileByTeacherId(data.teacherId);

  if (existingTeacherId) {
    throw new AppError(
      "This Teacher ID is already registered in the system.",
      409,
    );
  }

  let authResponse: any;

  try {
    // 3. Create core user account via Better Auth
    authResponse = await auth.api.signUpEmail({
      body: {
        email: data.email,
        password: data.password,
        name: data.name,
        role: "TEACHER",
      },
    });
  } catch (error: any) {
    throw new AppError(
      error.message || "Failed to create core user account",
      500,
    );
  }

  if (!authResponse?.user) {
    throw new AppError("Unexpected error during teacher registration.", 500);
  }

  const userId = authResponse.user.id;

  try {
    // 4. Revoke the automatic session
    await teacherRepository.deleteUserSessions(userId);

    // 5. Create the delegated Teacher Profile with the new fields
    const profile = await teacherRepository.createTeacherProfileRecord({
      userId: userId,
      teacherId: data.teacherId,
      designation: data.designation,
      department: data.department,
      faculty: data.faculty,
    });

    // Auto-verify the Teacher so they don't have to click a verification link
    await teacherRepository.updateUserEmailVerified(userId, true);

    // Trigger password reset flow so the Teacher can securely set their initial password
    await (auth.api as any).forgetPassword({
      body: {
        email: data.email,
        redirectTo: `${envConfig.FRONTEND_URL}?type=reset-password`,
      },
    });

    return { user: authResponse.user, profile };
  } catch (error) {
    // 6. Manual Rollback
    await teacherRepository.deleteUserById(userId);
    console.error("Teacher Profile creation failed, rolled back user:", error);

    throw new AppError(
      "Failed to create teacher profile. Database rolled back.",
      500,
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
  if (data.name) userUpdateData.name = data.name;
  if (data.phoneNumber !== undefined)
    userUpdateData.phoneNumber = data.phoneNumber;
  if (data.bloodGroup !== undefined)
    userUpdateData.bloodGroup = data.bloodGroup;

  // 2. Update Delegated Teacher Profile Data
  const profileUpdateData: Record<string, any> = {};
  if (data.designation) profileUpdateData.designation = data.designation;
  if (data.department) profileUpdateData.department = data.department;
  if (data.faculty !== undefined) profileUpdateData.faculty = data.faculty;
  if (data.officeRoom !== undefined)
    profileUpdateData.officeRoom = data.officeRoom;
  if (data.consultationHours !== undefined)
    profileUpdateData.consultationHours = data.consultationHours;

  if (data.expertiseFields !== undefined)
    profileUpdateData.expertiseFields = data.expertiseFields;
  if (data.academicQualifications !== undefined)
    profileUpdateData.academicQualifications = data.academicQualifications;
  if (data.linkedInUrl !== undefined)
    profileUpdateData.linkedInUrl = data.linkedInUrl;
  if (data.personalWebsiteUrl !== undefined)
    profileUpdateData.personalWebsiteUrl = data.personalWebsiteUrl;

  return await teacherRepository.updateTeacherUserAndProfile(
    userId,
    userUpdateData,
    profileUpdateData,
  );
};
