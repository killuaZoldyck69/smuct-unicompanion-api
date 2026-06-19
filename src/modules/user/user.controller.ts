import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import * as userService from "./user.service";

export const getAllUsers = catchAsync(async (req: Request, res: Response) => {
  const users = await userService.getAllUsersService();

  res.status(200).json({
    success: true,
    message: "Users retrieved successfully.",
    data: users,
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
