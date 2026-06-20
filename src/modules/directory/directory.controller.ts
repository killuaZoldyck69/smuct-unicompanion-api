import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import * as directoryService from "./directory.service";

export const getAllTeachers = catchAsync(
  async (req: Request, res: Response) => {
    const teachers = await directoryService.getAllTeachersService();

    res.status(200).json({
      success: true,
      message: "Teachers directory retrieved successfully.",
      data: teachers,
    });
  },
);
