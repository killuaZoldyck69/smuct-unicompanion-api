import { AppError } from "../../../utils/AppError";
import { HubRole } from "../../../constants/enums";
import * as membersRepo from "./members.repository";
import { appCache } from "../../../lib/cache";
import { prisma } from "../../../lib/prisma";

export const verifyMembershipRole = async (
  userId: string,
  hubId: string,
  allowedRoles: (HubRole | "ADMIN")[],
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (user?.role === "ADMIN") {
    if (allowedRoles.includes("ADMIN" as any)) {
      return {
        id: `admin-${hubId}`,
        userId,
        hubId,
        role: "ADMIN" as any,
        joinedAt: new Date(),
      };
    }
    throw new AppError(
      "Administrators have read-only access and cannot modify course hub members.",
      403,
    );
  }

  const membership = await membersRepo.findHubMembership(userId, hubId);
  if (!membership) {
    throw new AppError("Access denied: You are not a member of this hub.", 403);
  }

  if (!allowedRoles.includes(membership.role as HubRole)) {
    if (membership.role === "TA" && allowedRoles.includes("STUDENT" as any)) {
      return membership;
    }
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
    "ADMIN" as any,
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
  ]);

  const targetMember = await membersRepo.findMemberByHubAndId(hubId, memberId);
  if (!targetMember) {
    throw new AppError("Member not found in this course hub.", 404);
  }

  const isRequesterLeadershipOnly = requester.role === "CR";

  if (isRequesterLeadershipOnly && targetMember.role === "TEACHER") {
    throw new AppError(
      "Class Representatives cannot modify Teacher roles.",
      403,
    );
  }

  if (isRequesterLeadershipOnly && newRole === "TEACHER") {
    throw new AppError(
      "Class Representatives cannot assign Teacher roles.",
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
    ]);

    const isRequesterLeadershipOnly = requester.role === "CR";

    if (isRequesterLeadershipOnly && targetMember.role === "TEACHER") {
      throw new AppError(
        "Class Representatives cannot remove Teachers from the hub.",
        403,
      );
    }
  }

  await membersRepo.deleteMember(memberId);

  appCache.delPattern(new RegExp(`^hub:${hubId}`));
};
