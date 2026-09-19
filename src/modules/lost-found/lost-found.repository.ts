import { prisma } from "../../lib/prisma";
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
      consultationHours: true,
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
      consultationHours: true,
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
      description: payload.description,
      category: payload.category,
      location: payload.location,
      images: payload.images,
      verificationQuestion: payload.verificationQuestion || null,
      verificationAnswer: payload.verificationAnswer || null,
    },
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

  const [posts, total] = await Promise.all([
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
  ]);

  const sanitizedPosts = posts.map((post) => {
    if (post.authorId !== filters.viewerId) {
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
    },
  };
};

export const findPossibleMatchesInDb = async (
  postId: string,
  category: LostFoundCategory,
  location: string,
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
    take: 2,
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
  return prisma.lostFoundPost.update({
    where: { id },
    data: { status },
    include: {
      author: { select: publicAuthorSelection },
      _count: { select: { claims: true } },
    },
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
  return prisma.lostFoundClaim.findMany({
    where: { postId },
    include: {
      claimant: { select: privateContactSelection },
    },
    orderBy: { createdAt: "desc" },
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

