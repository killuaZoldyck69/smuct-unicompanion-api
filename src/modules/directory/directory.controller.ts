import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import * as directoryService from "./directory.service";
import { GetTeachersDirectoryQuery } from "./directory.schema";

export const getAllTeachers = catchAsync(
  async (req: Request, res: Response) => {
    const result = await directoryService.getAllTeachersService(
      req.query as unknown as GetTeachersDirectoryQuery,
    );

    res.status(200).json({
      success: true,
      message: "Teachers directory retrieved successfully.",
      data: result.teachers,
      meta: result.meta,
    });
  },
);

export const getTeacherDepartments = catchAsync(
  async (req: Request, res: Response) => {
    const departments =
      await directoryService.getTeacherDepartmentsService();

    res.status(200).json({
      success: true,
      message: "Teacher departments retrieved successfully.",
      data: departments,
    });
  },
);
