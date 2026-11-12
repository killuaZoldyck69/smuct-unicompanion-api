import { Request, Response } from "express";
import * as studentService from "./student.service";
import * as userService from "../user/user.service";
import { MulterFile } from "../upload/upload.service";
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
    const file = req.file as unknown as MulterFile | undefined;
    const base64 = req.body?.image as string | undefined;
    const imageUrl = req.body?.imageUrl as string | undefined;

    const result = await userService.updateUserProfileImageService(
      userId,
      file,
      base64,
      imageUrl,
    );

    res.status(200).json({
      success: true,
      message: "Profile image updated successfully.",
      data: result.user,
    });
  },
);

export function formatStudentProfile(userProfile: any) {
  return {
    id: userProfile.id,
    name: userProfile.name,
    email: userProfile.email,
    image: userProfile.image,
    phoneNumber: userProfile.phoneNumber,
    bloodGroup: userProfile.bloodGroup,
    role: userProfile.role,
    ...userProfile.studentProfile,
  };
}

export const getStudentProfile = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user.id;
    const userProfile = await studentService.getStudentProfileByUserId(userId);

    if (!userProfile || !userProfile.studentProfile) {
      throw new AppError("Student profile not found.", 404);
    }

    res.status(200).json({
      success: true,
      message: "Profile retrieved successfully.",
      data: formatStudentProfile(userProfile),
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

  res.status(200).json({
    success: true,
    message: "Profile updated successfully.",
    data: formatStudentProfile(updatedProfile),
  });
});
