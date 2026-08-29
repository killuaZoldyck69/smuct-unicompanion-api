import { AppError } from "../../utils/AppError";
import * as studentRepository from "./student.repository";
import { OnboardStudentPayload, UpdateProfilePayload } from "./student.schema";

export const onboardStudentService = async (
  userId: string,
  data: OnboardStudentPayload,
) => {
  const existingProfile = await studentRepository.findStudentProfileByUserId(userId);

  if (existingProfile) {
    throw new AppError("A student profile already exists for this user.", 409);
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
