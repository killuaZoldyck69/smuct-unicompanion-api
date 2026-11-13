import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import {
  ListingStatus,
  ListingType,
  MarketplaceCategory,
} from "../../constants/enums";
import { AppError } from "../../utils/AppError";
import { publicUserSelect } from "../forum/forum.domain";
import {
  assertOwnership,
  MarketplaceViewerContext,
  normalizeMarketplaceConditionAndPrice,
} from "./marketplace.domain";
import { assertNoForeignMarketplaceMediaReferencesInTx } from "./marketplace.media";
import {
  CreateMarketplacePayload,
  UpdateMarketplacePayload,
} from "./marketplace.schema";

export { publicUserSelect };

export interface MarketplaceFeedFilters {
  type?: ListingType;
  status?: ListingStatus;
  category?: MarketplaceCategory;
  search?: string;
  myPosts?: boolean;
  viewerId?: string;
  viewerRole?: string;
}

export interface PaginationParams {
  cursor?: string;
  limit: number;
}

export interface MarketplaceFeedCounts {
  selling: number;
  buying: number;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  total: number;
  counts: MarketplaceFeedCounts;
}

function buildFeedItemInclude(isAdmin: boolean) {
  return {
    author: { select: publicUserSelect },
    _count: {
      select: {
        comments: isAdmin ? true : { where: { isHiddenByModeration: false } },
      },
    },
  } satisfies Prisma.MarketplacePostInclude;
}

export const getMarketplaceViewerContextInDb = async (
  userId?: string,
  role?: string,
): Promise<MarketplaceViewerContext> => {
  if (!userId) {
    return {
      userId: "",
      role,
      reportedPostIds: new Set<string>(),
      reportedCommentIds: new Set<string>(),
    };
  }

  const reports = await prisma.contentReport.findMany({
    where: {
      reporterId: userId,
      status: { in: ["PENDING", "ACTIONED"] },
      targetType: { in: ["MARKETPLACE_POST", "MARKETPLACE_COMMENT"] },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { targetType: true, targetId: true },
  });

  const reportedPostIds = new Set<string>();
  const reportedCommentIds = new Set<string>();
  for (const r of reports) {
    if (r.targetType === "MARKETPLACE_POST") {
      reportedPostIds.add(r.targetId);
    } else if (r.targetType === "MARKETPLACE_COMMENT") {
      reportedCommentIds.add(r.targetId);
    }
  }

  return {
    userId,
    role,
    reportedPostIds,
    reportedCommentIds,
  };
};

// ---------------------------------------------------------------------------
// Feed — deterministic cursor pagination
// ---------------------------------------------------------------------------
export const findMarketplaceFeedInDb = async (
  filters: MarketplaceFeedFilters,
  pagination: PaginationParams,
  viewer: MarketplaceViewerContext,
): Promise<PaginatedResult<Record<string, unknown>>> => {
  const { cursor, limit } = pagination;
  const isAdmin = viewer.role === "ADMIN";
  const isMyPosts = Boolean(filters.myPosts && viewer.userId);

  const baseWhere: Prisma.MarketplacePostWhereInput = {};

  if (isMyPosts) {
    baseWhere.authorId = viewer.userId;
  } else if (!isAdmin) {
    baseWhere.isHiddenByModeration = false;
  }

  if (!isMyPosts && !isAdmin && viewer.reportedPostIds.size > 0) {
    baseWhere.id = { notIn: [...viewer.reportedPostIds] };
  }

  if (filters.status) {
    baseWhere.status = filters.status;
  } else if (!isMyPosts) {
    baseWhere.status = { in: [ListingStatus.ACTIVE, ListingStatus.SOLD] };
  }

  if (filters.category) {
    baseWhere.category = filters.category;
  }

  const term = filters.search?.trim();
  if (term) {
    baseWhere.OR = [
      { title: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
    ];
  }

  const where: Prisma.MarketplacePostWhereInput = {
    ...baseWhere,
    ...(filters.type && { type: filters.type }),
  };

  const take = limit + 1;

  const [items, total, groupedCounts] = await Promise.all([
    prisma.marketplacePost.findMany({
      where,
      take,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      include: buildFeedItemInclude(isAdmin),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }),
    cursor ? Promise.resolve(0) : prisma.marketplacePost.count({ where }),
    cursor
      ? Promise.resolve([])
      : prisma.marketplacePost.groupBy({
          by: ["type"],
          where: baseWhere,
          _count: { _all: true },
        }),
  ]);

  const hasNextPage = items.length > limit;
  if (hasNextPage) items.pop();

  const nextCursor =
    hasNextPage && items.length > 0 ? items[items.length - 1].id : null;

  const counts: MarketplaceFeedCounts = { selling: 0, buying: 0 };
  for (const row of groupedCounts) {
    if (row.type === ListingType.SELLING) counts.selling = row._count._all;
    else if (row.type === ListingType.BUYING) counts.buying = row._count._all;
  }

  return { items, nextCursor, total, counts };
};

// ---------------------------------------------------------------------------
// Single post (bounded comments & replies)
// ---------------------------------------------------------------------------
export const findMarketplacePostByIdInDb = async (
  id: string,
  viewer: MarketplaceViewerContext,
) => {
  const isAdmin = viewer.role === "ADMIN";
  const commentVisibilityWhere: Prisma.MarketplaceCommentWhereInput = isAdmin
    ? {}
    : {
        isHiddenByModeration: false,
        ...(viewer.reportedCommentIds.size > 0
          ? { id: { notIn: [...viewer.reportedCommentIds] } }
          : {}),
      };

  return prisma.marketplacePost.findUnique({
    where: { id },
    include: {
      author: { select: publicUserSelect },
      comments: {
        where: {
          parentId: null,
          ...commentVisibilityWhere,
        },
        take: 100,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: {
          author: { select: publicUserSelect },
          replies: {
            where: commentVisibilityWhere,
            take: 50,
            include: { author: { select: publicUserSelect } },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
        },
      },
      _count: {
        select: {
          comments: isAdmin
            ? true
            : { where: { isHiddenByModeration: false } },
        },
      },
    },
  });
};

export const findMarketplacePostSummaryInDb = async (id: string) => {
  return prisma.marketplacePost.findUnique({
    where: { id },
    select: {
      id: true,
      authorId: true,
      title: true,
      status: true,
      isHiddenByModeration: true,
    },
  });
};

// ---------------------------------------------------------------------------
// Create / Update / Status / Delete posts (atomic + IDOR guarded)
// ---------------------------------------------------------------------------
export const createMarketplacePostInDb = async (
  authorId: string,
  payload: CreateMarketplacePayload,
) => {
  return prisma.$transaction(async (tx) => {
    await assertNoForeignMarketplaceMediaReferencesInTx(
      tx,
      [authorId],
      payload.images,
    );

    return tx.marketplacePost.create({
      data: {
        authorId,
        type: payload.type,
        title: payload.title,
        description: payload.description,
        price: payload.price ?? 0,
        category: payload.category,
        condition: payload.condition ?? null,
        images: payload.images ?? [],
        contactPhone: payload.contactPhone ?? null,
      },
      include: {
        author: { select: publicUserSelect },
        _count: { select: { comments: true } },
      },
    });
  });
};

export const updateMarketplacePostAtomicInDb = async (
  id: string,
  userId: string,
  userRole: string | undefined,
  data: UpdateMarketplacePayload,
) => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.marketplacePost.findUnique({
      where: { id },
      select: {
        id: true,
        authorId: true,
        type: true,
        images: true,
      },
    });

    if (!existing) {
      throw new AppError("Marketplace listing not found", 404);
    }

    assertOwnership(
      existing.authorId === userId,
      userRole === "ADMIN",
      "edit this listing",
    );

    let removedImages: string[] = [];
    if (data.images !== undefined) {
      await assertNoForeignMarketplaceMediaReferencesInTx(
        tx,
        [existing.authorId, userId],
        data.images,
      );
      const nextSet = new Set(data.images);
      removedImages = existing.images.filter((url) => !nextSet.has(url));
    }

    const effectiveType = data.type ?? existing.type;
    const normalized = normalizeMarketplaceConditionAndPrice({
      effectiveType,
      condition: data.condition,
      price: data.price,
    });

    const updateData: Prisma.MarketplacePostUpdateInput = {
      ...(data.type !== undefined && { type: data.type }),
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(normalized.price !== undefined && { price: normalized.price }),
      ...(data.category !== undefined && { category: data.category }),
      ...(normalized.condition !== undefined && {
        condition: normalized.condition as any,
      }),
      ...(data.images !== undefined && { images: data.images }),
      ...(data.contactPhone !== undefined && {
        contactPhone: data.contactPhone,
      }),
    };

    const updated = await tx.marketplacePost.update({
      where: { id },
      data: updateData,
      include: {
        author: { select: publicUserSelect },
        _count: { select: { comments: true } },
      },
    });

    return { updated, removedImages };
  });
};

export const updateMarketplaceStatusAtomicInDb = async (
  id: string,
  userId: string,
  userRole: string | undefined,
  status: ListingStatus,
) => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.marketplacePost.findUnique({
      where: { id },
      select: { id: true, authorId: true, status: true },
    });

    if (!existing) {
      throw new AppError("Marketplace listing not found", 404);
    }

    assertOwnership(
      existing.authorId === userId,
      userRole === "ADMIN",
      "modify this listing",
    );

    if (existing.status === status) {
      return tx.marketplacePost.findUnique({
        where: { id },
        include: {
          author: { select: publicUserSelect },
          _count: { select: { comments: true } },
        },
      });
    }

    return tx.marketplacePost.update({
      where: { id },
      data: { status },
      include: {
        author: { select: publicUserSelect },
        _count: { select: { comments: true } },
      },
    });
  });
};

export const deleteMarketplacePostAtomicInDb = async (
  id: string,
  userId: string,
  userRole: string | undefined,
) => {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.marketplacePost.findUnique({
        where: { id },
        select: { id: true, authorId: true, images: true },
      });

      if (!existing) {
        throw new AppError("Marketplace listing not found", 404);
      }

      assertOwnership(
        existing.authorId === userId,
        userRole === "ADMIN",
        "delete this listing",
      );

      await tx.marketplacePost.delete({ where: { id } });

      return { images: existing.images };
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      throw new AppError("Marketplace listing not found", 404);
    }
    throw err;
  }
};

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------
export const createMarketplaceCommentInDb = async (
  postId: string,
  authorId: string,
  content: string,
  parentId: string | null,
) => {
  return prisma.marketplaceComment.create({
    data: {
      postId,
      authorId,
      content,
      parentId,
    },
    include: { author: { select: publicUserSelect } },
  });
};

export const findMarketplaceCommentByIdInDb = async (commentId: string) => {
  return prisma.marketplaceComment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      authorId: true,
      postId: true,
      parentId: true,
      isHiddenByModeration: true,
    },
  });
};

export const updateMarketplaceCommentInDb = async (
  commentId: string,
  content: string,
) => {
  try {
    return await prisma.marketplaceComment.update({
      where: { id: commentId },
      data: { content },
      include: { author: { select: publicUserSelect } },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      throw new AppError("Comment not found", 404);
    }
    throw err;
  }
};

export const deleteMarketplaceCommentFromDb = async (commentId: string) => {
  try {
    return await prisma.marketplaceComment.delete({ where: { id: commentId } });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      throw new AppError("Comment not found", 404);
    }
    throw err;
  }
};
