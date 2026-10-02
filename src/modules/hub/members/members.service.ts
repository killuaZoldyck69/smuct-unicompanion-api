import { AppError } from "../../../utils/AppError";
import { HubRole } from "../../../constants/enums";
import * as membersRepo from "./members.repository";
import { appCache } from "../../../lib/cache";

export const verifyMembershipRole = async (
  userId: string,
  hubId: string,
  allowedRoles: HubRole[],
) => {
  const membership = await membersRepo.findHubMembership(userId, hubId);
  if (!membership) {
    throw new AppError("Access denied: You are not a member of this hub.", 403);
  }

  if (!allowedRoles.includes(membership.role as HubRole)) {
    throw new AppError(
      "Access denied: You do not have permission to perform this action.",
      403,
    );
  }

  return membership;
};

export const getHubMembersService = async (userId: string, hubId: string) => {
  await verifyMembershipRole(userId, hubId, [
    "TEACHER",
    "CR",
    "TA",
    "STUDENT",
  ]);

  const cacheKey = `hub:${hubId}:members`;
  return await appCache.getOrSet(
    cacheKey,
    async () => {
      return await membersRepo.findMembersByHubId(hubId);
    },
    60,
  );
};

export const updateMemberRoleService = async (
  requesterUserId: string,
  hubId: string,
  memberId: string,
  newRole: HubRole,
) => {
  const requester = await verifyMembershipRole(requesterUserId, hubId, [
    "TEACHER",
    "CR",
    "TA",
  ]);

  const targetMember = await membersRepo.findMemberByHubAndId(hubId, memberId);
  if (!targetMember) {
    throw new AppError("Member not found in this course hub.", 404);
  }

  const isRequesterLeadershipOnly =
    requester.role === "CR" || requester.role === "TA";

  if (isRequesterLeadershipOnly && targetMember.role === "TEACHER") {
    throw new AppError(
      "Class Representatives and TAs cannot modify Teacher roles.",
      403,
    );
  }

  if (isRequesterLeadershipOnly && newRole === "TEACHER") {
    throw new AppError(
      "Class Representatives and TAs cannot assign Teacher roles.",
      403,
    );
  }

  const updated = await membersRepo.updateRole(memberId, newRole);

  appCache.delPattern(new RegExp(`^hub:${hubId}`));

  return updated;
};

export const removeMemberService = async (
  requesterUserId: string,
  hubId: string,
  memberId: string,
) => {
  const targetMember = await membersRepo.findMemberByHubAndId(hubId, memberId);
  if (!targetMember) {
    throw new AppError("Member not found in this course hub.", 404);
  }

  const isSelf = targetMember.userId === requesterUserId;
  if (!isSelf) {
    const requester = await verifyMembershipRole(requesterUserId, hubId, [
      "TEACHER",
      "CR",
      "TA",
    ]);

    const isRequesterLeadershipOnly =
      requester.role === "CR" || requester.role === "TA";

    if (isRequesterLeadershipOnly && targetMember.role === "TEACHER") {
      throw new AppError(
        "Class Representatives and TAs cannot remove Teachers from the hub.",
        403,
      );
    }
  }

  await membersRepo.deleteMember(memberId);

  appCache.delPattern(new RegExp(`^hub:${hubId}`));
};
