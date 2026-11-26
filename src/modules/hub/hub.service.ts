import crypto from "node:crypto";
import { Prisma } from "../../../generated/prisma/client";
import { AppError } from "../../utils/AppError";
import { HubRole } from "../../constants/enums";
import * as hubRepository from "./hub.repository";
import {
  CreateHubPayload,
  UpdateHubPayload,
  CreateClassNoticePayload,
  type MyHubsView,
} from "./hub.schema";
import {
  formatDhakaNoticeDayPhrase,
  getDhakaDayBoundsUtc,
  getDhakaWeekdayFromBounds,
  isEffectiveDateWithinAllowedWindow,
  resolveEffectiveHubRole,
  sanitizeClassNoticeFields,
} from "./class-routine.domain";
import { resolveTermExamUpdateSummary } from "./exam-schedule.domain";
import { appCache } from "../../lib/cache";
import { createHubNotifications } from "../notification/notification.service";

export type AllowedHubRole = HubRole | "ADMIN";

export interface VerifiedHubAccess {
  userId: string;
  hubId: string;
  role: AllowedHubRole;
}

export const assertActiveHub = async (hubId: string, archivedMessage: string) => {
  const hub = await hubRepository.findHubStatusById(hubId);
  if (!hub) {
    throw new AppError("Course Hub not found.", 404);
  }
  if (hub.isArchived) {
    throw new AppError(archivedMessage, 400);
  }
  return hub;
};

export const verifyHubRole = async (
  userId: string,
  hubId: string,
  allowedRoles: ReadonlyArray<AllowedHubRole>,
): Promise<VerifiedHubAccess> => {
  const user = await hubRepository.findUserWithStudentProfile(userId);
  if (user?.role === "ADMIN") {
    if (allowedRoles.includes("ADMIN")) {
      return { userId, hubId, role: "ADMIN" };
    }
    throw new AppError(
      "Administrators have read-only audit access and cannot modify course hubs.",
      403,
    );
  }

  const member = await hubRepository.findHubMember(userId, hubId);
  if (!member || !member.isActive) {
    throw new AppError(
      "You do not have permission to perform this action in this hub.",
      403,
    );
  }

  const effectiveRole = resolveEffectiveHubRole(member.role, user) as HubRole;

  if (!allowedRoles.includes(effectiveRole)) {
    throw new AppError(
      "You do not have permission to perform this action in this hub.",
      403,
    );
  }

  return { userId, hubId, role: effectiveRole };
};

export const getUserHubRole = async (
  userId: string,
  hubId: string,
): Promise<AllowedHubRole | null> => {
  const user = await hubRepository.findUserWithStudentProfile(userId);
  if (user?.role === "ADMIN") return "ADMIN";
  const member = await hubRepository.findHubMember(userId, hubId);
  if (!member || !member.isActive) return null;
  return resolveEffectiveHubRole(member.role, user) as HubRole;
};

export const getAvailableTeachersService = (
  query?: hubRepository.FindAvailableTeachersQuery,
) => hubRepository.findAvailableTeachers(query);

export const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const JOIN_CODE_LENGTH = 6;
const MAX_JOIN_CODE_ATTEMPTS = 5;

export const generateJoinCode = (): string => {
  let code = "";
  for (let i = 0; i < JOIN_CODE_LENGTH; i += 1) {
    code += JOIN_CODE_ALPHABET[crypto.randomInt(JOIN_CODE_ALPHABET.length)];
  }
  return code;
};

const isJoinCodeCollisionError = (error: unknown): boolean => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2002") return false;
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.includes("joinCode");
  }
  return typeof target === "string" && target.includes("joinCode");
};

export const invalidateHubCaches = (hubId?: string) => {
  if (hubId) {
    appCache.delPattern(new RegExp(`^hub:${hubId}`));
  }
  appCache.delPattern(/^admin:course-hubs:/);
};

export const createHubService = async (
  userId: string,
  data: CreateHubPayload,
) => {
  const user = await hubRepository.findUserWithStudentProfile(userId);

  if (!user) throw new AppError("User not found", 404);

  if (user.role === "ADMIN") {
    throw new AppError(
      "Administrators cannot create course hubs directly.",
      403,
    );
  }

  const isTeacher = user.role === "TEACHER";
  const isCR = !isTeacher && user.studentProfile?.isCR === true;

  if (!isCR && !isTeacher) {
    throw new AppError(
      "Only Teachers and Class Representatives can create a Hub.",
      403,
    );
  }

  if (isCR) {
    if (!data.teacherId) {
      throw new AppError(
        "CR must assign a teacher (teacherId) when creating a hub.",
        400,
      );
    }

    const assignedTeacher = await hubRepository.findActiveTeacherById(
      data.teacherId,
    );
    if (!assignedTeacher) {
      throw new AppError("Assigned instructor not found.", 404);
    }
    if (assignedTeacher.role !== "TEACHER" || assignedTeacher.isRestricted) {
      throw new AppError(
        "Assigned instructor must be an active faculty member.",
        400,
      );
    }
  }

  let created: Awaited<ReturnType<typeof hubRepository.createHubWithMembers>> | null = null;
  for (let attempt = 0; attempt < MAX_JOIN_CODE_ATTEMPTS; attempt += 1) {
    try {
      created = await hubRepository.createHubWithMembers(
        userId,
        data,
        isTeacher,
        isCR,
        generateJoinCode(),
      );
      break;
    } catch (error) {
      if (isJoinCodeCollisionError(error) && attempt < MAX_JOIN_CODE_ATTEMPTS - 1) {
        continue;
      }
      throw error;
    }
  }

  if (!created) {
    throw new AppError("Could not generate a unique join code. Please retry.", 500);
  }

  invalidateHubCaches();
  return created;
};

export const joinHubService = async (userId: string, joinCode: string) => {
  const user = await hubRepository.findUserWithStudentProfile(userId);

  if (user?.role === "ADMIN") {
    throw new AppError(
      "Administrators have universal access to all course hubs and do not need to join with a code.",
      400,
    );
  }

  const normalizedCode = joinCode.trim().toUpperCase();
  const hub = await hubRepository.findHubByJoinCode(normalizedCode);
  if (!hub) throw new AppError("Invalid join code.", 404);

  if (hub.isArchived) {
    throw new AppError(
      "This course hub is archived and no longer accepting new members.",
      400,
    );
  }

  const existingMember = await hubRepository.findHubMember(userId, hub.id);
  if (existingMember) {
    if (existingMember.isActive) {
      throw new AppError(
        "You are already a member of this course hub.",
        409,
      );
    }
    throw new AppError(
      "Your membership in this course hub has been deactivated.",
      403,
    );
  }

  let role: HubRole = "STUDENT";
  if (user?.role === "TEACHER") {
    role = "TEACHER";
  } else if (user?.studentProfile?.isCR) {
    role = "CR";
  }

  const membership = await hubRepository.createHubMember(userId, hub.id, role);
  invalidateHubCaches(hub.id);
  return membership;
};

export type { MyHubsView };

export const getMyHubsService = async (
  userId: string,
  view: MyHubsView = "default",
) => {
  const user = await hubRepository.findUserRoleAndCrStatus(userId);
  if (view === "exams" && (user?.role === "ADMIN" || user?.role === "TEACHER")) {
    return [];
  }
  if (view === "cgpa" && user?.role !== "STUDENT") {
    return [];
  }
  if (user?.role === "ADMIN") {
    if (view === "schedule") {
      return [];
    }
    if (view === "list") {
      return [];
    }
    return hubRepository.findAllHubsForAdmin(userId, view);
  }

  const memberships = await hubRepository.findMyHubMemberships(userId, view);
  return memberships.map((membership) => ({
    ...membership,
    role: resolveEffectiveHubRole(membership.role, user) as HubRole,
  }));
};

export const getHubDetailsService = async (userId: string, hubId: string) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "STUDENT", "ADMIN"]);
  return appCache.getOrSet(
    `hub:${hubId}:details`,
    async () => {
      const hub = await hubRepository.findHubWithMembersAndDetails(hubId);
      if (!hub) throw new AppError("Hub not found", 404);
      return hub;
    },
    60,
  );
};

export const updateHubService = async (
  userId: string,
  hubId: string,
  data: UpdateHubPayload,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR"]);
  const { previousTermExams, updated } = await hubRepository.updateHubAtomic(
    hubId,
    data,
    "Cannot update an archived course hub.",
  );
  invalidateHubCaches(hubId);

  const examUpdate =
    data.termExams !== undefined
      ? resolveTermExamUpdateSummary(previousTermExams, data.termExams)
      : null;

  if (examUpdate) {
    const sigHash = crypto
      .createHash("sha256")
      .update(examUpdate.signature)
      .digest("hex")
      .slice(0, 16);

    void createHubNotifications(
      hubId,
      userId,
      {
        type: "EXAM_SCHEDULE_UPDATE",
        title: "Exam schedule updated",
        body: examUpdate.body,
        route: "/(tabs)/exams",
        dedupeKey: `exam-update:${hubId}:${Math.floor(Date.now() / 10_000)}:${sigHash}`,
      },
      ["STUDENT", "CR"],
    ).catch((error: unknown) => {
      console.error(
        JSON.stringify({
          level: "error",
          event: "hub.exam_schedule_notification_failed",
          hubId,
          errorType: error instanceof Error ? error.name : "UnknownError",
        }),
      );
    });
  }

  return updated;
};

export const archiveHubService = async (
  userId: string,
  hubId: string,
  isArchived: boolean,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "ADMIN"]);
  const updated = await hubRepository.updateHubArchiveStatus(hubId, isArchived);
  invalidateHubCaches(hubId);
  return updated;
};

export const toggleLiveClassService = async (
  userId: string,
  hubId: string,
  isClassLive: boolean,
  meetUrl?: string | null,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR"]);
  await assertActiveHub(
    hubId,
    "Cannot modify live status for an archived course hub.",
  );
  const updated = await hubRepository.updateHubLiveClassAtomic(
    hubId,
    isClassLive,
    meetUrl,
  );
  invalidateHubCaches(hubId);
  return updated;
};

export const deleteHubService = async (userId: string, hubId: string) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "ADMIN"]);
  const deleted = await hubRepository.deleteHubById(hubId);
  invalidateHubCaches(hubId);
  return deleted;
};

export const createClassNoticeService = async (
  userId: string,
  hubId: string,
  data: CreateClassNoticePayload,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR"]);

  const dhakaBounds = getDhakaDayBoundsUtc(data.effectiveDate);
  if (!dhakaBounds) {
    throw new AppError("Invalid effective date provided.", 400);
  }
  if (!isEffectiveDateWithinAllowedWindow(dhakaBounds.canonicalDate)) {
    throw new AppError(
      "Class notice date must be between today and the next 7 days.",
      400,
    );
  }

  const effectiveWeekday = getDhakaWeekdayFromBounds(dhakaBounds);
  if (effectiveWeekday !== data.targetDay) {
    throw new AppError(
      `Effective date falls on ${effectiveWeekday}, not ${data.targetDay}.`,
      400,
    );
  }

  const dayPhrase = formatDhakaNoticeDayPhrase(dhakaBounds, data.targetDay);
  const sanitized = sanitizeClassNoticeFields(data, dayPhrase);
  const notice = await hubRepository.replaceClassNoticeAtomic(
    hubId,
    userId,
    sanitized,
    dhakaBounds,
  );
  invalidateHubCaches(hubId);

  const notificationTitle =
    dayPhrase === "today"
      ? "Class schedule update"
      : `Class schedule update (${sanitized.targetDay})`;

  void createHubNotifications(hubId, userId, {
    type: "CLASS_NOTICE",
    title: notificationTitle,
    body: sanitized.message.slice(0, 180),
    route: "/(tabs)/my-schedule",
    dedupeKey: `class-notice:${notice.id}`,
  }).catch((error: unknown) => {
    console.error(
      JSON.stringify({
        level: "error",
        event: "hub.class_notice_notification_failed",
        hubId,
        noticeId: notice.id,
        errorType: error instanceof Error ? error.name : "UnknownError",
      }),
    );
  });

  return notice;
};

export const deleteClassNoticeService = async (
  userId: string,
  hubId: string,
  noticeId: string,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR"]);
  await assertActiveHub(
    hubId,
    "Cannot modify class notices for an archived course hub.",
  );

  const result = await hubRepository.deactivateClassNoticeInHub(
    hubId,
    noticeId,
  );
  if (result.count === 0) {
    throw new AppError("Class notice not found.", 404);
  }

  invalidateHubCaches(hubId);
  return { id: noticeId, isActive: false };
};
