import { AppError } from "../../utils/AppError";
import * as hubRepository from "./hub.repository";
import {
  CreateHubPayload,
  UpdateHubPayload,
  UpdateMemberRolePayload,
  CreateClassNoticePayload,
} from "./hub.schema";

// 🛡️ Centralized Authorization Helper
export const verifyHubRole = async (
  userId: string,
  hubId: string,
  allowedRoles: string[],
) => {
  const member = await hubRepository.findHubMember(userId, hubId);
  if (!member || !allowedRoles.includes(member.role)) {
    throw new AppError(
      "You do not have permission to perform this action in this hub.",
      403,
    );
  }
  return member;
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

  // Prisma will throw a unique constraint error if they are already a member
  return await hubRepository.createHubMember(userId, hub.id, "STUDENT");
};

export const getMyHubsService = async (userId: string) => {
  return await hubRepository.findMyHubMemberships(userId);
};

export const getHubDetailsService = async (hubId: string) => {
  const hub = await hubRepository.findHubWithMembersAndDetails(hubId);
  if (!hub) throw new AppError("Hub not found", 404);
  return hub;
};

export const updateMemberRoleService = async (
  userId: string,
  hubId: string,
  memberId: string,
  newRole: UpdateMemberRolePayload["role"],
) => {
  const requesterMember = await verifyHubRole(userId, hubId, [
    "TEACHER",
    "CR",
    "TA",
  ]);

  const targetMember = await hubRepository.findHubMemberById(memberId);

  if (!targetMember) throw new AppError("Member not found.", 404);

  // Prevent both CRs AND TAs from modifying Teacher roles
  if (
    (requesterMember.role === "CR" || requesterMember.role === "TA") &&
    targetMember.role === "TEACHER"
  ) {
    throw new AppError(
      "Class Representatives and TAs cannot modify Teacher roles.",
      403,
    );
  }

  if (
    (requesterMember.role === "CR" || requesterMember.role === "TA") &&
    newRole === "TEACHER"
  ) {
    throw new AppError(
      "Class Representatives and TAs cannot assign Teacher roles.",
      403,
    );
  }

  return await hubRepository.updateHubMemberRole(memberId, newRole);
};

export const removeMemberService = async (
  userId: string,
  hubId: string,
  memberId: string,
) => {
  const targetMember = await hubRepository.findHubMemberById(memberId);

  if (!targetMember) throw new AppError("Member not found.", 404);

  // Allow users to remove themselves ("Leave Hub")
  if (targetMember.userId === userId) {
    return await hubRepository.deleteHubMemberById(memberId);
  }

  // Allow TAs to kick students, but verify their role first
  const requesterMember = await verifyHubRole(userId, hubId, [
    "TEACHER",
    "CR",
    "TA",
  ]);

  // Security Check - CR and TA cannot kick a TEACHER
  if (
    (requesterMember.role === "CR" || requesterMember.role === "TA") &&
    targetMember.role === "TEACHER"
  ) {
    throw new AppError(
      "Class Representatives and TAs cannot remove Teachers from the hub.",
      403,
    );
  }

  return await hubRepository.deleteHubMemberById(memberId);
};

export const updateHubService = async (
  userId: string,
  hubId: string,
  data: UpdateHubPayload,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR"]);

  return await hubRepository.updateHub(hubId, data);
};

export const archiveHubService = async (
  userId: string,
  hubId: string,
  isArchived: boolean,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "TA"]);
  return await hubRepository.updateHubArchiveStatus(hubId, isArchived);
};

export const toggleLiveClassService = async (
  userId: string,
  hubId: string,
  isClassLive: boolean,
  meetUrl?: string | null,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "TA"]);
  return await hubRepository.updateHubLiveClass(hubId, isClassLive, meetUrl);
};

export const deleteHubService = async (userId: string, hubId: string) => {
  // Only Teachers and CRs can delete a hub
  await verifyHubRole(userId, hubId, ["TEACHER", "CR"]);

  return await hubRepository.deleteHubById(hubId);
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

