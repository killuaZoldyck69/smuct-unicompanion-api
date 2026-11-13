import { Prisma } from "../../../generated/prisma/client";
import {
  LostFoundCategory,
  LostFoundStatus,
  LostFoundType,
} from "../../constants/enums";
import type { UpdateLostFoundPayload } from "./lost-found.schema";

export const MAX_PENDING_CLAIMS_PER_USER = 5;
export const MAX_CLAIM_ATTEMPTS_PER_POST = 2;

export interface LostFoundViewerContext {
  userId: string;
  role?: string;
  reportedPostIds: ReadonlySet<string>;
}

export interface LostFoundStudentProfileData {
  studentId?: string | null;
  department: string;
  batch: string | null;
  currentSemester: string | number | null;
  section: string | null;
}

export interface LostFoundTeacherProfileData {
  department: string;
  designation: string;
  officeRoom: string | null;
  consultationSlots: Prisma.JsonValue | null;
}

export interface LostFoundHandoverCounterpart {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  image: string;
  studentProfile: LostFoundStudentProfileData | null;
  teacherProfile: LostFoundTeacherProfileData | null;
}

export interface LostFoundDetailPostInput {
  id: string;
  authorId: string;
  status: string;
  resolvedClaimId: string | null;
  verificationAnswer?: string | null;
  author: LostFoundHandoverCounterpart & Record<string, unknown>;
  claims?: Array<{
    id: string;
    claimantId: string;
    claimant: LostFoundHandoverCounterpart;
  }>;
  _count?: { claims: number };
  [key: string]: unknown;
}

export interface LostFoundHandoverData {
  role: "AUTHOR" | "CLAIMANT";
  counterpart: LostFoundHandoverCounterpart;
}

export function isLostFoundPostVisibleToViewer(
  post: {
    id: string;
    authorId: string;
    isHiddenByModeration: boolean;
  },
  viewer: LostFoundViewerContext,
  options?: { includeOwnHidden?: boolean },
): boolean {
  if (viewer.reportedPostIds.has(post.id)) {
    return false;
  }

  const isOwnPost = Boolean(viewer.userId) && post.authorId === viewer.userId;
  if (
    post.isHiddenByModeration &&
    viewer.role !== "ADMIN" &&
    !(options?.includeOwnHidden && isOwnPost)
  ) {
    return false;
  }

  return true;
}

/**
 * Non-author administrators cannot inspect or overwrite verification Q&A fields.
 */
export function buildLostFoundUpdateData(
  payload: UpdateLostFoundPayload & { category?: LostFoundCategory },
  existingType: LostFoundType,
  isAuthor: boolean,
): Prisma.LostFoundPostUncheckedUpdateInput {
  const updateData: Prisma.LostFoundPostUncheckedUpdateInput = {};

  if (payload.type !== undefined) updateData.type = payload.type;
  if (payload.title !== undefined) updateData.title = payload.title.trim();
  if (payload.description !== undefined) {
    updateData.description = payload.description?.trim() || null;
  }
  if (payload.category !== undefined) updateData.category = payload.category;
  if (payload.location !== undefined) {
    updateData.location = payload.location?.trim() || null;
  }
  if (payload.images !== undefined) updateData.images = payload.images;

  const effectiveType = payload.type ?? existingType;
  if (effectiveType === LostFoundType.LOST) {
    updateData.verificationQuestion = null;
    updateData.verificationAnswer = null;
  } else if (isAuthor) {
    if (payload.verificationQuestion !== undefined) {
      updateData.verificationQuestion =
        payload.verificationQuestion?.trim() || null;
    }
    if (payload.verificationAnswer !== undefined) {
      updateData.verificationAnswer =
        payload.verificationAnswer?.trim() || null;
    }
  }

  return updateData;
}

/**
 * Redacts private verification answers, contact details, and constructs handover
 * details strictly for active RESOLVED handovers between author and resolved claimant.
 */
export function sanitizeLostFoundPostDetail<TClaim = unknown>(params: {
  post: LostFoundDetailPostInput;
  viewerId: string;
  viewerRole?: string;
  myClaim: TClaim | null;
}) {
  const { post, viewerId, viewerRole, myClaim } = params;
  const isAuthor = post.authorId === viewerId;
  const isAdmin = viewerRole === "ADMIN";
  const acceptedClaim = post.claims?.find(
    (claim) => claim.id === post.resolvedClaimId,
  );
  const isActiveResolvedHandover =
    post.status === LostFoundStatus.RESOLVED && Boolean(acceptedClaim);
  const isAcceptedClaimant =
    isActiveResolvedHandover && acceptedClaim?.claimantId === viewerId;

  const {
    verificationAnswer,
    claims,
    _count,
    resolvedClaimId,
    author,
    ...basePost
  } = post;

  const sanitizedAuthor: Record<string, unknown> = { ...author };
  if (!isAuthor && !isAcceptedClaimant && !isAdmin) {
    delete sanitizedAuthor.email;
    delete sanitizedAuthor.phoneNumber;
    if (author.studentProfile) {
      const { studentId: _omitStudentId, ...safeStudentProfile } =
        author.studentProfile;
      sanitizedAuthor.studentProfile = safeStudentProfile;
    }
  }

  let handoverData: LostFoundHandoverData | null = null;
  if (isActiveResolvedHandover && acceptedClaim) {
    if (isAuthor) {
      handoverData = {
        role: "AUTHOR",
        counterpart: pickHandoverCounterpart(acceptedClaim.claimant),
      };
    } else if (isAcceptedClaimant) {
      handoverData = {
        role: "CLAIMANT",
        counterpart: pickHandoverCounterpart(post.author),
      };
    }
  }

  return {
    ...basePost,
    ...(isAuthor ? { verificationAnswer } : {}),
    ...(isAuthor || isAcceptedClaimant || isAdmin
      ? { claims, _count, resolvedClaimId }
      : {}),
    author: sanitizedAuthor as typeof post.author,
    myClaim,
    handoverData,
  };
}

function pickHandoverCounterpart(
  person: LostFoundHandoverCounterpart,
): LostFoundHandoverCounterpart {
  return {
    id: person.id,
    name: person.name,
    email: person.email,
    phoneNumber: person.phoneNumber,
    image: person.image,
    studentProfile: person.studentProfile,
    teacherProfile: person.teacherProfile,
  };
}

export function extractMatchTokens(input?: string | null): string[] {
  if (!input) return [];
  const rawTokens = input
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);

  return [...new Set(rawTokens)].slice(0, 4);
}

// Preserved alias for existing test imports.
export const extractLocationTokens = extractMatchTokens;
