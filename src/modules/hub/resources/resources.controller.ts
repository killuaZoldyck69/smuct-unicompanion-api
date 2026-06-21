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
  const data = await resourceService.getResourcesService(
    req.params.id as string,
  );
  res.status(200).json({ success: true, data });
});
