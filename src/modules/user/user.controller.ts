import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import * as userService from "./user.service";
import { MulterFile } from "../upload/upload.service";

export const getAllUsers = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.getAllUsersService(req.query);

  res.status(200).json({
    success: true,
    message: "Users retrieved successfully.",
    data: result.data,
    meta: result.meta,
  });
});

export const deleteUser = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string; // Assert type to satisfy TypeScript

  await userService.deleteUserService(id);

  res.status(200).json({
    success: true,
    message: "User and associated profiles deleted successfully.",
  });
});

export const updateStudentRole = catchAsync(
  async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { action } = req.body;

    const updatedProfile = await userService.updateStudentRoleService(
      id,
      action,
    );

    res.status(200).json({
      success: true,
      message: `Student role updated successfully (${action}).`,
      data: updatedProfile,
    });
  },
);

export const updateUserProfileImage = catchAsync(
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
      data: result,
    });
  },
);

