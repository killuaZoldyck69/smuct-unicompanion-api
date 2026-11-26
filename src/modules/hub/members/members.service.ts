import { AppError } from "../../../utils/AppError";
import { HubRole } from "../../../constants/enums";
import { appCache } from "../../../lib/cache";
import {
  assertActiveHub,
  invalidateHubCaches,
  verifyHubRole,
} from "../hub.service";
import * as hubRepo from "../hub.repository";
import * as membersRepo from "./members.repository";

export const getHubMembersService = async (userId: string, hubId: string) => {
  const access = await verifyHubRole(userId, hubId, [
    "TEACHER",
    "CR",
    "STUDENT",
    "ADMIN",
  ]);
  if (access.role === "ADMIN") {
    const existingHub = await hubRepo.findHubStatusById(hubId);
    if (!existingHub) {
      throw new AppError("Course Hub not found.", 404);
    }
  }

  const cacheKey = `hub:${hubId}:members`;
  return appCache.getOrSet(
    cacheKey,
    () => membersRepo.findMembersByHubId(hubId),
    60,
  );
};

export const updateMemberRoleService = async (
  requesterUserId: string,
  hubId: string,
  memberId: string,
  newRole: HubRole,
) => {
  const requester = await verifyHubRole(requesterUserId, hubId, [
    "TEACHER",
    "CR",
  ]);
  await assertActiveHub(
    hubId,
    "Archived course hubs cannot modify member roles.",
  );

  const targetMember = await membersRepo.findActiveMemberByHubAndId(
    hubId,
    memberId,
  );
  if (!targetMember) {
    throw new AppError("Member not found in this course hub.", 404);
  }

  if (targetMember.userId === requesterUserId) {
    throw new AppError("You cannot change your own role in this hub.", 403);
  }

  if (newRole === "TEACHER" && targetMember.user.role !== "TEACHER") {
    throw new AppError(
      "Only users with a Teacher account can be course instructors.",
      403,
    );
  }

  if (targetMember.role === "TEACHER" || targetMember.user.role === "TEACHER") {
    throw new AppError(
      "A Teacher account must retain the course instructor role.",
      403,
    );
  }

  if (requester.role === "CR") {
    if (targetMember.role === "CR") {
      throw new AppError(
        "Class Representatives cannot modify another Class Representative.",
        403,
      );
    }
    if (newRole === "TEACHER") {
      throw new AppError(
        "Class Representatives cannot assign Teacher roles.",
        403,
      );
    }
  }

  const updated = await membersRepo.updateMemberRoleAtomic(
    hubId,
    memberId,
    newRole,
  );
  invalidateHubCaches(hubId);
  return updated;
};

export const removeMemberService = async (
  requesterUserId: string,
  hubId: string,
  memberId: string,
) => {
  const requester = await verifyHubRole(requesterUserId, hubId, [
    "TEACHER",
    "CR",
    "STUDENT",
  ]);

  const targetMember = await membersRepo.findActiveMemberByHubAndId(
    hubId,
    memberId,
  );
  if (!targetMember) {
    throw new AppError("Member not found in this course hub.", 404);
  }

  const isSelf = targetMember.userId === requesterUserId;

  if (isSelf) {
    await membersRepo.leaveHubMemberAtomic(
      hubId,
      memberId,
      targetMember.role === "TEACHER",
    );
    invalidateHubCaches(hubId);
    return;
  }

  if (requester.role !== "TEACHER" && requester.role !== "CR") {
    throw new AppError(
      "Access denied: You do not have permission to remove other members.",
      403,
    );
  }

  await assertActiveHub(hubId, "Archived course hubs cannot remove members.");

  if (targetMember.role === "TEACHER" || targetMember.user.role === "TEACHER") {
    throw new AppError(
      "Course instructors cannot be removed by others; instructors can only leave voluntarily.",
      403,
    );
  }

  if (requester.role === "CR" && targetMember.role === "CR") {
    throw new AppError(
      "Class Representatives cannot remove another Class Representative.",
      403,
    );
  }

  await membersRepo.deactivateMemberAtomic(hubId, memberId);
  invalidateHubCaches(hubId);
};
