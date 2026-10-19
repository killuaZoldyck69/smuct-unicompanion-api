import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import * as userService from "./user.service";
import { MulterFile } from "../upload/upload.service";

export const getAllUsers = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.getAllUsersService(req.query as any);

  // Set HTTP caching headers for client & reverse proxy (private, short max-age, stale-while-revalidate)
  res.setHeader(
    "Cache-Control",
    "private, max-age=30, stale-while-revalidate=60",
  );

  res.status(200).json({
    success: true,
    message: "Users retrieved successfully.",
    data: result.data,
    meta: result.meta,
  });
});

export const restrictUser = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const callerId = req.user?.id;
  const isRestricted = req.body?.isRestricted !== false;

  const result = await userService.restrictUserService(
    id,
    callerId,
    isRestricted,
  );

  res.status(200).json({
    success: true,
    message: isRestricted
      ? "User account has been restricted successfully."
      : "User account restriction has been lifted.",
    data: result,
  });
});

export const deleteUser = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const callerId = req.user?.id;

  const result = await userService.deleteUserService(id, callerId);

  res.status(200).json({
    success: true,
    message: "User account has been restricted successfully.",
    data: result,
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

export const updateTeacherPosition = catchAsync(
  async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { designation, administrativeRole } = req.body;

    const updatedProfile = await userService.updateTeacherPositionService(id, {
      designation,
      administrativeRole,
    });

    res.status(200).json({
      success: true,
      message: "Teacher position and role updated successfully.",
      data: updatedProfile,
    });
  },
);

export const adminUpdateTeacherProfile = catchAsync(
  async (req: Request, res: Response) => {
    const id = req.params.id as string;

    const updatedUser = await userService.adminUpdateTeacherProfileService(
      id,
      req.body,
    );

    res.status(200).json({
      success: true,
      message: "Faculty profile updated successfully.",
      data: updatedUser,
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

export const runMaintenanceCleanup = catchAsync(
  async (req: Request, res: Response) => {
    const hours = req.query?.hours ? Number(req.query.hours) : 24;
    const { cleanupStaleData } = await import("../../services/cleanup.service");
    const result = await cleanupStaleData(hours);

    res.status(200).json({
      success: true,
      message: "Security maintenance cleanup executed successfully.",
      data: result,
    });
  },
);

