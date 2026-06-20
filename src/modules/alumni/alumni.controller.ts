import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import * as alumniService from "./alumni.service";

export const getAllAlumni = catchAsync(async (req: Request, res: Response) => {
  const alumni = await alumniService.getAllAlumniService();
  res.status(200).json({ success: true, data: alumni });
});

export const createAlumni = catchAsync(async (req: Request, res: Response) => {
  const alumni = await alumniService.createAlumniService(req.body);
  res
    .status(201)
    .json({ success: true, message: "Alumni created", data: alumni });
});

export const bulkCreateAlumni = catchAsync(
  async (req: Request, res: Response) => {
    const result = await alumniService.bulkCreateAlumniService(req.body);
    res
      .status(201)
      .json({ success: true, message: "Bulk insert complete", data: result });
  },
);

export const updateAlumni = catchAsync(async (req: Request, res: Response) => {
  const alumni = await alumniService.updateAlumniService(
    req.params.id as string,
    req.body,
  );
  res
    .status(200)
    .json({ success: true, message: "Alumni updated", data: alumni });
});

export const deleteAlumni = catchAsync(async (req: Request, res: Response) => {
  await alumniService.deleteAlumniService(req.params.id as string);
  res.status(200).json({ success: true, message: "Alumni deleted" });
});
