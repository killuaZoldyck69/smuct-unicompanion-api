import { AppError } from "../../utils/AppError";
import * as userRepository from "./user.repository";
import { UpdateRolePayload } from "./user.schema";
import {
  uploadSingleImageService,
  MulterFile,
} from "../upload/upload.service";
import { deleteImageFromCloudinary } from "../../lib/cloudinary";


export const getAllUsersService = async (query?: {
  page?: number | string;
  limit?: number | string;
  role?: any;
  search?: string;
}) => {
  const page = Math.max(1, Number(query?.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(query?.limit) || 25));
  const skip = (page - 1) * limit;

  const where: any = {};
  if (query?.role) {
    where.role = query.role;
  }
  if (query?.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { email: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const [users, total] = await Promise.all([
    userRepository.findUsersWithProfiles(where, skip, limit),
    userRepository.countUsers(where),
  ]);

  return {
    data: users,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const deleteUserService = async (id: string) => {
  const existingUser = await userRepository.findUserById(id);

  if (!existingUser) {
    throw new AppError("User not found.", 404);
  }

  // Cascades automatically to StudentProfile, TeacherProfile, Session, Account, etc.
  const result = await userRepository.deleteUserById(id);

  // Storage cleanup optimization: delete user profile image from Cloudinary
  if (existingUser.image) {
    deleteImageFromCloudinary(existingUser.image).catch((err) =>
      console.warn("[Cloudinary] Failed to clean up user image:", err)
    );
  }

  return result;
};

export const updateStudentRoleService = async (
  id: string,
  action: UpdateRolePayload["action"],
) => {
  // Verify user exists and retrieve their student profile
  const user = await userRepository.findUserWithStudentProfile(id);

  if (!user) {
    throw new AppError("User not found.", 404);
  }

  if (!user.studentProfile) {
    throw new AppError(
      "This action can only be performed on student accounts.",
      400,
    );
  }

  // Determine the boolean flags based on the requested action
  let updateData = {};
  if (action === "MAKE_CR") {
    updateData = { isCR: true };
  } else if (action === "MAKE_TA") {
    updateData = { isTA: true };
  } else if (action === "REMOVE_ROLE") {
    updateData = { isCR: false, isTA: false };
  }

  // Apply the update to the delegated StudentProfile
  return await userRepository.updateStudentProfileByUserId(id, updateData);
};

export const updateUserProfileImageService = async (
  userId: string,
  file?: MulterFile,
  base64?: string,
  imageUrl?: string,
) => {
  const existingUser = await userRepository.findUserById(userId);
  if (!existingUser) {
    throw new AppError("User not found.", 404);
  }
  const previousImage = existingUser.image;

  let finalImageUrl = imageUrl?.trim();

  if (file || (base64 && base64.trim())) {
    const uploadResult = await uploadSingleImageService(
      file,
      base64,
      "smuct-unicompanion/profiles",
    );
    finalImageUrl = uploadResult.secureUrl;
  }

  if (!finalImageUrl) {
    throw new AppError("No image file, base64 data, or image URL provided.", 400);
  }

  const updatedUser = await userRepository.updateUserImageById(
    userId,
    finalImageUrl,
  );

  if (!updatedUser) {
    throw new AppError("User not found.", 404);
  }

  // Storage cleanup optimization: delete previous image from Cloudinary
  if (previousImage && previousImage !== finalImageUrl) {
    deleteImageFromCloudinary(previousImage).catch((err) =>
      console.warn("[Cloudinary] Failed to clean up previous profile image:", err)
    );
  }

  return {
    imageUrl: finalImageUrl,
    user: updatedUser,
  };
};

