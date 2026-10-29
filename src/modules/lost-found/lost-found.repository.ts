import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import {
  LostFoundCategory,
  LostFoundClaimStatus,
  LostFoundStatus,
  LostFoundType,
} from "../../constants/enums";
import {
  CreateClaimPayload,
  CreateLostFoundPayload,
} from "./lost-found.schema";

export const publicAuthorSelection = {
  id: true,
  name: true,
  image: true,
  role: true,
  studentProfile: {
    select: {
      studentId: true,
      department: true,
      batch: true,
      currentSemester: true,
      section: true,
    },
  },
  teacherProfile: {
    select: {
      department: true,
      designation: true,
      officeRoom: true,
      consultationSlots: true,
    },
  },
};

export const privateContactSelection = {
  id: true,
  name: true,
  email: true,
  phoneNumber: true,
  image: true,
  role: true,
  studentProfile: {
    select: {
      studentId: true,
      department: true,
      batch: true,
      currentSemester: true,
      section: true,
    },
  },
  teacherProfile: {
    select: {
      department: true,
      designation: true,
      officeRoom: true,
      consultationSlots: true,
    },
  },
};

export interface LostFoundFeedFilters {
  type?: LostFoundType;
  status?: LostFoundStatus;
  category?: LostFoundCategory;
  search?: string;
  myPosts?: boolean;
  viewerId?: string;
  viewerRole?: string;
  page?: number;
  limit?: number;
}

export const createLostFoundPostInDb = async (
  authorId: string,
  payload: CreateLostFoundPayload
) => {
  return prisma.lostFoundPost.create({
    data: {
      authorId,
      type: payload.type,
      title: payload.title,
      description: payload.description || null,
      category: payload.category,
      location: payload.location || null,
      images: payload.images || [],
      verificationQuestion: payload.verificationQuestion || null,
      verificationAnswer: payload.verificationAnswer || null,
    },
    include: {
      author: { select: publicAuthorSelection },
      _count: { select: { claims: true } },
    },
  });
};

export const updateLostFoundPostInDb = async (
  id: string,
  data: Partial<CreateLostFoundPayload>
) => {
  const updateData: any = { ...data };

  if (updateData.title !== undefined) {
    updateData.title = updateData.title.trim();
  }
  if (updateData.description !== undefined) {
    updateData.description = updateData.description?.trim() || null;
  }
  if (updateData.location !== undefined) {
    updateData.location = updateData.location?.trim() || null;
  }
  if (updateData.type === "LOST") {
    updateData.verificationQuestion = null;
    updateData.verificationAnswer = null;
  } else if (updateData.type === "FOUND") {
    if (updateData.verificationQuestion !== undefined) {
      updateData.verificationQuestion =
        updateData.verificationQuestion?.trim() || null;
    }
    if (updateData.verificationAnswer !== undefined) {
      updateData.verificationAnswer =
        updateData.verificationAnswer?.trim() || null;
    }
  }

  return prisma.lostFoundPost.update({
    where: { id },
    data: updateData,
    include: {
      author: { select: publicAuthorSelection },
      _count: { select: { claims: true } },
    },
  });
};

export const findLostFoundFeedInDb = async (filters: LostFoundFeedFilters) => {
  const where: any = {};

  if (filters.myPosts && filters.viewerId) {
    where.authorId = filters.viewerId;
  }
  if (filters.type) {
    where.type = filters.type;
  }
  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.category) {
    where.category = filters.category;
  }
  if (filters.search) {
    const term = filters.search.trim();
    if (term.length > 0) {
      where.OR = [
        { title: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
        { location: { contains: term, mode: "insensitive" } },
      ];
    }
  }

  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 20));
  const skip = (page - 1) * limit;

  const [posts, total, activeLost, activeFound, resolved] = await Promise.all([
    prisma.lostFoundPost.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true,
        authorId: true,
        type: true,
        title: true,
        description: true,
        category: true,
        location: true,
        status: true,
        images: true,
        verificationQuestion: true,
        resolvedClaimId: true,
        createdAt: true,
        updatedAt: true,
        author: { select: publicAuthorSelection },
        _count: { select: { claims: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.lostFoundPost.count({ where }),
    prisma.lostFoundPost.count({
      where: { type: LostFoundType.LOST, status: LostFoundStatus.ACTIVE },
    }),
    prisma.lostFoundPost.count({
      where: { type: LostFoundType.FOUND, status: LostFoundStatus.ACTIVE },
    }),
    prisma.lostFoundPost.count({
      where: {
        status: { in: [LostFoundStatus.RESOLVED, LostFoundStatus.CLAIMED] },
      },
    }),
  ]);

  const sanitizedPosts = posts.map((post) => {
    if (post.authorId !== filters.viewerId && filters.viewerRole !== "ADMIN") {
      const { _count, ...rest } = post;
      return rest;
    }
    return post;
  });

  return {
    data: sanitizedPosts,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
      counts: {
        activeLost,
        activeFound,
        resolved,
      },
    },
  };
};

export const findPossibleMatchesInDb = async (
  postId: string,
  category: LostFoundCategory,
  location: string | null | undefined,
  type: LostFoundType
) => {
  const counterpartType =
    type === LostFoundType.LOST ? LostFoundType.FOUND : LostFoundType.LOST;

  return prisma.lostFoundPost.findMany({
    where: {
      id: { not: postId },
      type: counterpartType,
      status: LostFoundStatus.ACTIVE,
      category,
    },
    select: {
      id: true,
      authorId: true,
      type: true,
      title: true,
      description: true,
      category: true,
      location: true,
      status: true,
      images: true,
      createdAt: true,
      author: { select: publicAuthorSelection },
    },
    orderBy: { createdAt: "desc" },
    take: 4,
  });
};

export const findLostFoundPostByIdInDb = async (id: string) => {
  return prisma.lostFoundPost.findUnique({
    where: { id },
    include: {
      author: { select: privateContactSelection },
      claims: {
        where: { status: LostFoundClaimStatus.ACCEPTED },
        include: {
          claimant: { select: privateContactSelection },
        },
      },
      _count: { select: { claims: true } },
    },
  });
};

export const updateLostFoundStatusInDb = async (
  id: string,
  status: LostFoundStatus
) => {
  return prisma.$transaction(async (tx) => {
    // If status is changed to CLOSED or RESOLVED directly (offline resolution):
    if (status === LostFoundStatus.CLOSED || status === LostFoundStatus.RESOLVED) {
      await tx.lostFoundClaim.updateMany({
        where: {
          postId: id,
          status: LostFoundClaimStatus.PENDING,
        },
        data: { status: LostFoundClaimStatus.REJECTED },
      });
    }

    const data: any = { status };
    if (status === LostFoundStatus.ACTIVE) {
      data.resolvedClaimId = null;
    }

    return tx.lostFoundPost.update({
      where: { id },
      data,
      include: {
        author: { select: publicAuthorSelection },
        _count: { select: { claims: true } },
      },
    });
  });
};

export const deleteLostFoundPostFromDb = async (id: string) => {
  return prisma.lostFoundPost.delete({
    where: { id },
  });
};

// ==============================
// CLAIMS REPOSITORY
// ==============================

export const createClaimInDb = async (
  postId: string,
  claimantId: string,
  payload: CreateClaimPayload
) => {
  return prisma.lostFoundClaim.create({
    data: {
      postId,
      claimantId,
      message: payload.message,
      answer: payload.answer || null,
      proofImage: payload.proofImage || null,
    },
    include: {
      claimant: { select: publicAuthorSelection },
    },
  });
};

export const findClaimByPostAndClaimantInDb = async (
  postId: string,
  claimantId: string
) => {
  return prisma.lostFoundClaim.findUnique({
    where: {
      postId_claimantId: { postId, claimantId },
    },
    include: {
      claimant: { select: privateContactSelection },
    },
  });
};

export const findClaimByIdInDb = async (claimId: string) => {
  return prisma.lostFoundClaim.findUnique({
    where: { id: claimId },
    include: {
      claimant: { select: privateContactSelection },
      post: {
        include: {
          author: { select: privateContactSelection },
        },
      },
    },
  });
};

export const findClaimsByPostIdInDb = async (postId: string) => {
  const claims = await prisma.lostFoundClaim.findMany({
    where: { postId },
    include: {
      claimant: { select: privateContactSelection },
    },
    orderBy: { createdAt: "desc" },
  });

  return claims.map((claim) => {
    // Only expose private contact information (phone, email) for ACCEPTED claims
    if (claim.status !== LostFoundClaimStatus.ACCEPTED) {
      const { email, phoneNumber, ...safeClaimant } = claim.claimant;
      return {
        ...claim,
        claimant: safeClaimant as any,
      };
    }
    return claim;
  });
};

export const countPendingClaimsByClaimantInDb = async (claimantId: string) => {
  return prisma.lostFoundClaim.count({
    where: {
      claimantId,
      status: LostFoundClaimStatus.PENDING,
    },
  });
};

export const acceptClaimAtomicInDb = async (
  postId: string,
  claimId: string
) => {
  return prisma.$transaction(async (tx) => {
    // 0. Verify post exists and is still ACTIVE to prevent concurrent double-acceptance
    const currentPost = await tx.lostFoundPost.findUnique({
      where: { id: postId },
      select: { id: true, status: true, authorId: true },
    });

    if (!currentPost) {
      throw new AppError("Lost & Found post not found", 404);
    }

    if (currentPost.status !== LostFoundStatus.ACTIVE) {
      throw new AppError("This post has already been resolved or closed", 400);
    }

    // 1. Mark accepted claim
    const acceptedClaim = await tx.lostFoundClaim.update({
      where: { id: claimId },
      data: { status: LostFoundClaimStatus.ACCEPTED },
      include: {
        claimant: { select: privateContactSelection },
      },
    });

    // 2. Mark other pending claims for this post as REJECTED
    await tx.lostFoundClaim.updateMany({
      where: {
        postId,
        id: { not: claimId },
        status: LostFoundClaimStatus.PENDING,
      },
      data: { status: LostFoundClaimStatus.REJECTED },
    });

    // 3. Mark post as RESOLVED with resolvedClaimId
    const updatedPost = await tx.lostFoundPost.update({
      where: { id: postId },
      data: {
        status: LostFoundStatus.RESOLVED,
        resolvedClaimId: claimId,
      },
      include: {
        author: { select: privateContactSelection },
      },
    });

    return { post: updatedPost, acceptedClaim };
  });
};

export const rejectClaimInDb = async (claimId: string) => {
  return prisma.lostFoundClaim.update({
    where: { id: claimId },
    data: { status: LostFoundClaimStatus.REJECTED },
    include: {
      claimant: { select: publicAuthorSelection },
    },
  });
};

export const withdrawClaimInDb = async (claimId: string) => {
  return prisma.lostFoundClaim.delete({
    where: { id: claimId },
  });
};

