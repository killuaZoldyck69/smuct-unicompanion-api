import { Request, Response } from "express";
import { catchAsync } from "../../../utils/catchAsync";
import * as membersService from "./members.service";
import { HubRole } from "../../../constants/enums";

export const getHubMembers = catchAsync(async (req: Request, res: Response) => {
  const members = await membersService.getHubMembersService(
    req.user.id,
    req.params.id as string,
  );

  res.setHeader("Cache-Control", "private, no-cache");
  res.status(200).json({
    success: true,
    data: members,
  });
});

export const updateMemberRole = catchAsync(async (req: Request, res: Response) => {
  const updated = await membersService.updateMemberRoleService(
    req.user.id,
    req.params.id as string,
    req.params.memberId as string,
    req.body.role as HubRole,
  );

  res.status(200).json({
    success: true,
    message: "Member role updated successfully.",
    data: updated,
  });
});

export const removeMember = catchAsync(async (req: Request, res: Response) => {
  await membersService.removeMemberService(
    req.user.id,
    req.params.id as string,
    req.params.memberId as string,
  );

  res.status(200).json({
    success: true,
    message: "Member removed from the hub successfully.",
  });
});
