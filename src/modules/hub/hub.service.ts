import { AppError } from "../../utils/AppError";
import { HubRole } from "../../constants/enums";
import * as hubRepository from "./hub.repository";
import {
  CreateHubPayload,
  UpdateHubPayload,
  UpdateMemberRolePayload,
  CreateClassNoticePayload,
} from "./hub.schema";
import { appCache } from "../../lib/cache";
import {
  updateMemberRoleService as memberUpdateRoleService,
  removeMemberService as memberRemoveService,
} from "./members/members.service";

// 🛡️ Centralized Authorization Helper
export const verifyHubRole = async (
  userId: string,
  hubId: string,
  allowedRoles: string[],
) => {
  const member = await hubRepository.findHubMember(userId, hubId);
  if (!member) {
    throw new AppError(
      "You do not have permission to perform this action in this hub.",
      403,
    );
  }

  let effectiveRole: string = member.role;
  if (effectiveRole === "STUDENT") {
    const user = await hubRepository.findUserWithStudentProfile(userId);
    if (user?.role === "TEACHER") {
      effectiveRole = "TEACHER";
    } else if (user?.studentProfile?.isCR) {
      effectiveRole = "CR";
    }
  }

  if (!allowedRoles.includes(effectiveRole)) {
    throw new AppError(
      "You do not have permission to perform this action in this hub.",
      403,
    );
  }
  return { ...member, role: effectiveRole as any };
};

export const getUserHubRole = async (userId: string, hubId: string) => {
  const member = await hubRepository.findHubMember(userId, hubId);
  return member?.role || null;
};

export const getAvailableTeachersService = async (
  query?: hubRepository.FindAvailableTeachersQuery,
) => {
  return await hubRepository.findAvailableTeachers(query);
};

const generateJoinCode = () =>
  Math.random().toString(36).substring(2, 8).toUpperCase();

export const createHubService = async (
  userId: string,
  data: CreateHubPayload,
) => {
  const user = await hubRepository.findUserWithStudentProfile(userId);

  if (!user) throw new AppError("User not found", 404);

  const isCR = user.studentProfile?.isCR === true;
  const isTeacher = user.role === "TEACHER";

  if (!isCR && !isTeacher) {
    throw new AppError(
      "Only Teachers and Class Representatives can create a Hub.",
      403,
    );
  }

  if (isCR && !data.teacherId) {
    throw new AppError(
      "CR must assign a teacher (teacherId) when creating a hub.",
      400,
    );
  }

  const joinCode = generateJoinCode();

  return await hubRepository.createHubWithMembers(
    userId,
    data,
    isTeacher,
    isCR,
    joinCode,
  );
};

export const joinHubService = async (userId: string, joinCode: string) => {
  const hub = await hubRepository.findHubByJoinCode(joinCode);
  if (!hub) throw new AppError("Invalid join code.", 404);

  const user = await hubRepository.findUserWithStudentProfile(userId);
  let role: HubRole = "STUDENT";
  if (user?.role === "TEACHER") {
    role = "TEACHER";
  } else if (user?.studentProfile?.isCR) {
    role = "CR";
  }

  const membership = await hubRepository.createHubMember(userId, hub.id, role);
  appCache.delPattern(new RegExp(`^hub:${hub.id}`));
  return membership;
};

export const getMyHubsService = async (userId: string) => {
  return await hubRepository.findMyHubMemberships(userId);
};

export const getHubDetailsService = async (hubId: string) => {
  return await appCache.getOrSet(
    `hub:${hubId}:details`,
    async () => {
      const hub = await hubRepository.findHubWithMembersAndDetails(hubId);
      if (!hub) throw new AppError("Hub not found", 404);
      return hub;
    },
    60,
  );
};

export const updateMemberRoleService = async (
  userId: string,
  hubId: string,
  memberId: string,
  newRole: UpdateMemberRolePayload["role"],
) => {
  return await memberUpdateRoleService(userId, hubId, memberId, newRole);
};

export const removeMemberService = async (
  userId: string,
  hubId: string,
  memberId: string,
) => {
  return await memberRemoveService(userId, hubId, memberId);
};

export const updateHubService = async (
  userId: string,
  hubId: string,
  data: UpdateHubPayload,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR"]);
  const updated = await hubRepository.updateHub(hubId, data);
  appCache.delPattern(new RegExp(`^hub:${hubId}`));
  return updated;
};

export const archiveHubService = async (
  userId: string,
  hubId: string,
  isArchived: boolean,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "TA"]);
  const updated = await hubRepository.updateHubArchiveStatus(hubId, isArchived);
  appCache.delPattern(new RegExp(`^hub:${hubId}`));
  return updated;
};

export const toggleLiveClassService = async (
  userId: string,
  hubId: string,
  isClassLive: boolean,
  meetUrl?: string | null,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "TA"]);
  const updated = await hubRepository.updateHubLiveClass(hubId, isClassLive, meetUrl);
  appCache.delPattern(new RegExp(`^hub:${hubId}`));
  return updated;
};

export const deleteHubService = async (userId: string, hubId: string) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR"]);
  const deleted = await hubRepository.deleteHubById(hubId);
  appCache.delPattern(new RegExp(`^hub:${hubId}`));
  return deleted;
};

export const createClassNoticeService = async (
  userId: string,
  hubId: string,
  data: CreateClassNoticePayload,
) => {
  // Only Teachers and CRs can post a notice for a class
  await verifyHubRole(userId, hubId, ["TEACHER", "CR"]);

  const effectiveDate = new Date(data.effectiveDate);
  if (isNaN(effectiveDate.getTime())) {
    throw new AppError("Invalid effective date provided.", 400);
  }

  // Deactivate any existing active notice for this day & date
  await hubRepository.deactivatePreviousNotices(
    hubId,
    data.targetDay,
    effectiveDate,
  );

  let resolvedMessage = data.message?.trim();
  if (!resolvedMessage) {
    if (data.type === "CANCELLED") {
      resolvedMessage = "Class is cancelled for today.";
    } else if (data.type === "ROOM_CHANGE") {
      resolvedMessage = data.newRoom
        ? `Class will be held in Room ${data.newRoom}.`
        : "Classroom has been changed for today.";
    } else if (data.type === "ONLINE_CLASS") {
      resolvedMessage = "Class will be held online today.";
    } else if (data.type === "TIME_CHANGE") {
      resolvedMessage = data.newTime
        ? `Class rescheduled to ${data.newTime}.`
        : "Class time has been rescheduled.";
    } else {
      resolvedMessage = "Class notice.";
    }
  }

  return await hubRepository.createClassNotice(hubId, userId, {
    ...data,
    message: resolvedMessage,
    effectiveDate,
  });
};

export const deleteClassNoticeService = async (
  userId: string,
  hubId: string,
  noticeId: string,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR"]);

  const notice = await hubRepository.findClassNoticeById(noticeId);
  if (!notice) {
    throw new AppError("Class notice not found.", 404);
  }

  return await hubRepository.deleteClassNoticeById(noticeId);
};

