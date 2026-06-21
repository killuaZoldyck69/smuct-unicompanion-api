import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import * as hubService from "./hub.service";

export const createHub = catchAsync(async (req: Request, res: Response) => {
  const hub = await hubService.createHubService(req.user.id, req.body);
  res
    .status(201)
    .json({ success: true, message: "Hub created successfully", data: hub });
});

export const getAvailableTeachers = catchAsync(
  async (req: Request, res: Response) => {
    const teachers = await hubService.getAvailableTeachersService();
    res.status(200).json({ success: true, data: teachers });
  },
);

export const joinHub = catchAsync(async (req: Request, res: Response) => {
  const member = await hubService.joinHubService(
    req.user.id,
    req.body.joinCode,
  );
  res
    .status(200)
    .json({ success: true, message: "Joined hub successfully", data: member });
});

export const getMyHubs = catchAsync(async (req: Request, res: Response) => {
  const hubs = await hubService.getMyHubsService(req.user.id);
  res.status(200).json({ success: true, data: hubs });
});

export const getHubDetails = catchAsync(async (req: Request, res: Response) => {
  const hub = await hubService.getHubDetailsService(req.params.id as string);
  res.status(200).json({ success: true, data: hub });
});

export const updateMemberRole = catchAsync(
  async (req: Request, res: Response) => {
    const member = await hubService.updateMemberRoleService(
      req.user.id,
      req.params.id as string,
      req.params.memberId as string,
      req.body.role,
    );
    res
      .status(200)
      .json({ success: true, message: "Member role updated", data: member });
  },
);

export const updateHub = catchAsync(async (req: Request, res: Response) => {
  const hubId = req.params.id as string;
  const userId = req.user.id;

  const updatedHub = await hubService.updateHubService(userId, hubId, req.body);

  res.status(200).json({
    success: true,
    message: "Hub updated successfully",
    data: updatedHub,
  });
});

export const archiveHub = catchAsync(async (req: Request, res: Response) => {
  const hub = await hubService.archiveHubService(
    req.user.id,
    req.params.id as string,
    req.body.isArchived,
  );
  res
    .status(200)
    .json({ success: true, message: "Hub archive status updated", data: hub });
});
