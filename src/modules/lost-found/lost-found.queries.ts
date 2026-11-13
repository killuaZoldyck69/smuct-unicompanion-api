import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import {
  LostFoundCategory,
  LostFoundClaimStatus,
  LostFoundStatus,
  LostFoundType,
} from "../../constants/enums";
import {
  extractMatchTokens,
  LostFoundViewerContext,
} from "./lost-found.domain";
import {
  lostFoundFeedSelect,
  privateContactSelection,
  publicAuthorSelection,
} from "./lost-found.projections";

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

export const getLostFoundViewerContextInDb = async (
  userId?: string,
  role?: string,
): Promise<LostFoundViewerContext> => {
  if (!userId) {
    return { userId: "", role, reportedPostIds: new Set<string>() };
  }

  const reports = await prisma.contentReport.findMany({
    where: {
      reporterId: userId,
      status: "PENDING",
      targetType: "LOST_FOUND_POST",
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { targetId: true },
  });

  return {
    userId,
    role,
    reportedPostIds: new Set(reports.map((r) => r.targetId)),
  };
};

export const findLostFoundFeedInDb = async (
  filters: LostFoundFeedFilters,
  viewer: LostFoundViewerContext,
) => {
  const isMyPosts = Boolean(filters.myPosts && filters.viewerId);
  const where: Prisma.LostFoundPostWhereInput = {};

  if (isMyPosts) {
    where.authorId = filters.viewerId;
  } else if (filters.viewerRole !== "ADMIN") {
    where.isHiddenByModeration = false;
  }

  if (viewer.reportedPostIds.size > 0 && !isMyPosts) {
    where.id = { notIn: [...viewer.reportedPostIds] };
  }

  if (filters.type) {
    where.type = filters.type;
  }

  if (filters.status) {
    where.status = filters.status;
  } else if (!isMyPosts) {
    where.status = {
      in: [
        LostFoundStatus.ACTIVE,
        LostFoundStatus.CLAIMED,
        LostFoundStatus.RESOLVED,
      ],
    };
  }

  if (filters.category) {
    where.category = filters.category;
  }

  const term = filters.search?.trim();
  if (term) {
    where.OR = [
      { title: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
      { location: { contains: term, mode: "insensitive" } },
    ];
  }

  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 20));
  const skip = (page - 1) * limit;

  const publicVisibilityFilter: Prisma.LostFoundPostWhereInput =
    viewer.reportedPostIds.size > 0
      ? {
          isHiddenByModeration: false,
          id: { notIn: [...viewer.reportedPostIds] },
        }
      : { isHiddenByModeration: false };

  const shouldFetchGlobalCounts =
    page === 1 &&
    !filters.type &&
    !filters.status &&
    !filters.category &&
    !filters.myPosts &&
    !term;

  const [posts, total, groupedCounts] = await Promise.all([
    prisma.lostFoundPost.findMany({
      where,
      skip,
      take: limit,
      select: lostFoundFeedSelect,
      orderBy: { createdAt: "desc" },
    }),
    prisma.lostFoundPost.count({ where }),
    shouldFetchGlobalCounts
      ? prisma.lostFoundPost.groupBy({
          by: ["type", "status"],
          where: {
            ...publicVisibilityFilter,
            status: { in: [LostFoundStatus.ACTIVE, LostFoundStatus.RESOLVED] },
          },
          _count: { _all: true },
        })
      : Promise.resolve(null),
  ]);

  let counts:
    | { activeLost: number; activeFound: number; resolved: number }
    | undefined;
  if (groupedCounts) {
    let activeLost = 0;
    let activeFound = 0;
    let resolved = 0;
    for (const row of groupedCounts) {
      if (
        row.status === LostFoundStatus.ACTIVE &&
        row.type === LostFoundType.LOST
      ) {
        activeLost += row._count._all;
      } else if (
        row.status === LostFoundStatus.ACTIVE &&
        row.type === LostFoundType.FOUND
      ) {
        activeFound += row._count._all;
      } else if (row.status === LostFoundStatus.RESOLVED) {
        resolved += row._count._all;
      }
    }
    counts = { activeLost, activeFound, resolved };
  }

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
      ...(counts ? { counts } : {}),
    },
  };
};

export const findPossibleMatchesInDb = async (
  postId: string,
  category: LostFoundCategory,
  title: string,
  location: string | null | undefined,
  type: LostFoundType,
  viewer: LostFoundViewerContext,
) => {
  const counterpartType =
    type === LostFoundType.LOST ? LostFoundType.FOUND : LostFoundType.LOST;

  const excludedIds = [postId, ...viewer.reportedPostIds];

  const candidates = await prisma.lostFoundPost.findMany({
    where: {
      id: { notIn: excludedIds },
      type: counterpartType,
      status: LostFoundStatus.ACTIVE,
      isHiddenByModeration: false,
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
    take: 16,
  });

  const locationTokens = extractMatchTokens(location);
  const titleTokens = extractMatchTokens(title);

  if (locationTokens.length === 0 && titleTokens.length === 0) {
    return candidates.slice(0, 4);
  }

  return candidates
    .map((candidate) => {
      const locText = (candidate.location ?? "").toLowerCase();
      const titleText =
        `${candidate.title} ${candidate.description ?? ""}`.toLowerCase();
      let score = 0;
      for (const token of locationTokens) {
        if (locText.includes(token)) score += 3;
        else if (titleText.includes(token)) score += 1;
      }
      for (const token of titleTokens) {
        if (titleText.includes(token)) score += 2;
      }
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((entry) => entry.candidate);
};

export const findLostFoundPostSummaryInDb = async (id: string) => {
  return prisma.lostFoundPost.findUnique({
    where: { id },
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
      resolvedClaimId: true,
      isHiddenByModeration: true,
      updatedAt: true,
    },
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
      _count: {
        select: {
          claims: {
            where: { status: LostFoundClaimStatus.PENDING },
          },
        },
      },
    },
  });
};

export const findClaimByPostAndClaimantInDb = async (
  postId: string,
  claimantId: string,
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

export const findClaimProofImagesByPostIdInDb = async (postId: string) => {
  const claims = await prisma.lostFoundClaim.findMany({
    where: {
      postId,
      proofImage: { not: null },
    },
    select: { proofImage: true },
    take: 500,
  });

  return claims
    .map((claim) => claim.proofImage)
    .filter((image): image is string => Boolean(image));
};

export const findClaimsByPostIdInDb = async (postId: string) => {
  const [publicClaims, acceptedClaims] = await Promise.all([
    prisma.lostFoundClaim.findMany({
      where: {
        postId,
        status: { not: LostFoundClaimStatus.WITHDRAWN },
      },
      include: {
        claimant: { select: publicAuthorSelection },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.lostFoundClaim.findMany({
      where: {
        postId,
        status: LostFoundClaimStatus.ACCEPTED,
      },
      include: {
        claimant: { select: privateContactSelection },
      },
    }),
  ]);

  if (acceptedClaims.length === 0) {
    return publicClaims;
  }

  const acceptedById = new Map(acceptedClaims.map((claim) => [claim.id, claim]));
  return publicClaims.map((claim) => acceptedById.get(claim.id) ?? claim);
};
