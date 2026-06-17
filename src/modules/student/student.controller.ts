import { Request, Response } from "express";
import * as studentService from "./student.service";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";

export const onboardStudent = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const result = await studentService.onboardStudentService(userId, req.body);

    res.status(201).json({
      success: true,
      message: "Student profile created successfully.",
      data: result,
    });
  },
);

export const updateProfileImage = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const { imageUrl } = req.body;

    const updatedUser = await studentService.updateProfileImageService(
      userId,
      imageUrl,
    );

    res.status(200).json({
      success: true,
      message: "Profile image updated successfully.",
      data: updatedUser,
    });
  },
);

export const getStudentProfile = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const userProfile = await studentService.getStudentProfileByUserId(userId);

    if (!userProfile || !userProfile.studentProfile) {
      throw new AppError("Student profile not found.", 404);
    }

    // Flatten response for mobile client consumption
    const formattedProfile = {
      id: userProfile.id,
      name: userProfile.name,
      email: userProfile.email,
      image: userProfile.image,
      phoneNumber: userProfile.phoneNumber,
      bloodGroup: userProfile.bloodGroup,
      role: userProfile.role,
      ...userProfile.studentProfile,
    };

    res.status(200).json({
      success: true,
      message: "Profile retrieved successfully.",
      data: formattedProfile,
    });
  },
);

export const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const updatedProfile = await studentService.updateStudentProfileData(
    userId,
    req.body,
  );

  if (!updatedProfile) {
    throw new AppError("Failed to retrieve updated profile.", 500);
  }

  const formattedProfile = {
    id: updatedProfile.id,
    name: updatedProfile.name,
    email: updatedProfile.email,
    image: updatedProfile.image,
    phoneNumber: updatedProfile.phoneNumber,
    bloodGroup: updatedProfile.bloodGroup,
    role: updatedProfile.role,
    ...updatedProfile.studentProfile,
  };

  res.status(200).json({
    success: true,
    message: "Profile updated successfully.",
    data: formattedProfile,
  });
});
