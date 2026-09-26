import { Request, Response } from "express";
import { catchAsync } from "../../../utils/catchAsync";
import * as resourceService from "./resources.service";

export const createResource = catchAsync(
  async (req: Request, res: Response) => {
    const data = await resourceService.createResourceService(
      req.user.id,
      req.params.id as string,
      req.body,
    );
    res.status(201).json({ success: true, message: "Resource uploaded", data });
  },
);

export const getResources = catchAsync(async (req: Request, res: Response) => {
  const isStudentNote =
    req.query.isStudentNote !== undefined
      ? req.query.isStudentNote === "true"
      : undefined;
  const category = req.query.category as string | undefined;

  const data = await resourceService.getResourcesService(
    req.params.id as string,
    { isStudentNote, category },
  );
  res.status(200).json({ success: true, data });
});

export const deleteResource = catchAsync(async (req: Request, res: Response) => {
  await resourceService.deleteResourceService(
    req.user.id,
    req.params.id as string,
    req.params.resourceId as string,
  );
  res.status(200).json({ success: true, message: "Resource deleted" });
});
