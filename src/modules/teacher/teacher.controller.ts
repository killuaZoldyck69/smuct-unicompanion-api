import { Request, Response } from "express";
import * as teacherService from "./teacher.service";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";

export const registerTeacher = catchAsync(
  async (req: Request, res: Response) => {
    const result = await teacherService.registerTeacherService(req.body);

    const formattedData = {
      id: result.user.id,
      teacherId: result.profile.teacherId,
      name: result.user.name,
      email: result.user.email,
      role: result.user.role,
      designation: result.profile.designation,
      department: result.profile.department,
      faculty: result.profile.faculty,
    };

    res.status(201).json({
      success: true,
      message: "Teacher registered successfully by Administrator.",
      data: formattedData,
    });
  },
);

export const getTeacherProfile = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const userProfile = await teacherService.getTeacherProfileByUserId(userId);

    if (!userProfile || !userProfile.teacherProfile) {
      throw new AppError("Teacher profile not found.", 404);
    }

    // Flatten the response
    // The spread operator automatically includes expertiseFields, academicQualifications, etc.
    const formattedProfile = {
      id: userProfile.id,
      name: userProfile.name,
      email: userProfile.email,
      image: userProfile.image,
      phoneNumber: userProfile.phoneNumber,
      bloodGroup: userProfile.bloodGroup,
      role: userProfile.role,
      ...userProfile.teacherProfile,
    };

    res.status(200).json({
      success: true,
      message: "Teacher profile retrieved successfully.",
      data: formattedProfile,
    });
  },
);

export const updateTeacherProfileImage = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const { imageUrl } = req.body;

    const updatedUser = await teacherService.updateTeacherProfileImageService(
      userId,
      imageUrl,
    );

    res.status(200).json({
      success: true,
      message: "Teacher profile image updated successfully.",
      data: updatedUser,
    });
  },
);

export const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const updatedProfile = await teacherService.updateTeacherProfileData(
    userId,
    req.body,
  );

  if (!updatedProfile) {
    throw new AppError("Failed to retrieve updated profile.", 500);
  }

  // Flatten the response
  const formattedProfile = {
    id: updatedProfile.id,
    name: updatedProfile.name,
    email: updatedProfile.email,
    image: updatedProfile.image,
    phoneNumber: updatedProfile.phoneNumber,
    bloodGroup: updatedProfile.bloodGroup,
    role: updatedProfile.role,
    ...updatedProfile.teacherProfile,
  };

  res.status(200).json({
    success: true,
    message: "Teacher profile updated successfully.",
    data: formattedProfile,
  });
});
