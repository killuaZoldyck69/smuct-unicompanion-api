import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import {
  ListingStatus,
  ListingType,
  MarketplaceCategory,
} from "../../constants/enums";
import { AppError } from "../../utils/AppError";
import { feedAuthorSelect, publicUserSelect } from "../forum/forum.domain";
import {
  assertOwnership,
  canCommentOnMarketplacePost,
  isMarketplaceItemVisibleToViewer,
  MarketplaceViewerContext,
  normalizeMarketplaceConditionAndPrice,
  resolveTopLevelParentCommentId,
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

function buildCommentCountSelect(
  isAdmin: boolean,
  reportedCommentIds?: ReadonlySet<string>,
) {
  if (isAdmin) return true;
  return {
    where: {
      isHiddenByModeration: false,
      ...(reportedCommentIds?.size
        ? { id: { notIn: [...reportedCommentIds] } }
        : {}),
    },
  };
}

const commentNodeSelect = {
  id: true,
  postId: true,
  authorId: true,
  parentId: true,
  content: true,
  isHiddenByModeration: true,
  createdAt: true,
  updatedAt: true,
  author: { select: publicUserSelect },
} satisfies Prisma.MarketplaceCommentSelect;

function buildPostMutationSelect(isAdmin: boolean) {
  return {
    id: true,
    type: true,
    title: true,
    description: true,
    price: true,
    category: true,
    condition: true,
    status: true,
    images: true,
    contactPhone: true,
    authorId: true,
    isHiddenByModeration: true,
    createdAt: true,
    updatedAt: true,
    author: { select: publicUserSelect },
    _count: { select: { comments: buildCommentCountSelect(isAdmin) } },
  } satisfies Prisma.MarketplacePostSelect;
}

function mapPrismaNotFound(
  err: unknown,
  message: string,
  codes: readonly string[] = ["P2025"],
): never {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    codes.includes(err.code)
  ) {
    throw new AppError(message, 404);
  }
  throw err;
}

function buildFeedItemSelect(
  isAdmin: boolean,
  reportedCommentIds?: ReadonlySet<string>,
) {
  return {
    id: true,
    type: true,
    title: true,
    description: true,
    price: true,
    category: true,
    condition: true,
    status: true,
    images: true,
    authorId: true,
    isHiddenByModeration: true,
    createdAt: true,
    updatedAt: true,
    author: { select: feedAuthorSelect },
    _count: {
      select: {
        comments: buildCommentCountSelect(isAdmin, reportedCommentIds),
      },
    },
  } satisfies Prisma.MarketplacePostSelect;
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

export type MarketplaceFeedItem = Prisma.MarketplacePostGetPayload<{
  select: ReturnType<typeof buildFeedItemSelect>;
}>;

export const findMarketplaceFeedInDb = async (
  filters: MarketplaceFeedFilters,
  pagination: PaginationParams,
  viewer: MarketplaceViewerContext,
): Promise<PaginatedResult<MarketplaceFeedItem>> => {
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
      select: buildFeedItemSelect(isAdmin, viewer.reportedCommentIds),
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
    select: {
      id: true,
      type: true,
      title: true,
      description: true,
      price: true,
      category: true,
      condition: true,
      status: true,
      images: true,
      contactPhone: true,
      authorId: true,
      isHiddenByModeration: true,
      createdAt: true,
      updatedAt: true,
      author: { select: publicUserSelect },
      comments: {
        where: {
          parentId: null,
          ...commentVisibilityWhere,
        },
        take: 100,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          ...commentNodeSelect,
          replies: {
            where: commentVisibilityWhere,
            take: 50,
            select: commentNodeSelect,
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
        },
      },
      _count: {
        select: {
          comments: buildCommentCountSelect(isAdmin, viewer.reportedCommentIds),
        },
      },
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
  const idempotencyKey = payload.idempotencyKey?.trim() || null;

  try {
    return await prisma.$transaction(async (tx) => {
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
          idempotencyKey,
        },
        select: buildPostMutationSelect(false),
      });
    });
  } catch (err) {
    if (
      idempotencyKey &&
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const existing = await prisma.marketplacePost.findUnique({
        where: {
          authorId_idempotencyKey: { authorId, idempotencyKey },
        },
        select: buildPostMutationSelect(false),
      });
      if (existing) {
        return existing;
      }
    }
    throw err;
  }
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
        condition: normalized.condition,
      }),
      ...(data.images !== undefined && { images: data.images }),
      ...(data.contactPhone !== undefined && {
        contactPhone: data.contactPhone,
      }),
    };

    const isAdmin = userRole === "ADMIN";
    const updated = await tx.marketplacePost.update({
      where: { id },
      data: updateData,
      select: buildPostMutationSelect(isAdmin),
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
  const isAdmin = userRole === "ADMIN";
  return prisma.$transaction(async (tx) => {
    const existing = await tx.marketplacePost.findUnique({
      where: { id },
      select: buildPostMutationSelect(isAdmin),
    });

    if (!existing) {
      throw new AppError("Marketplace listing not found", 404);
    }

    assertOwnership(
      existing.authorId === userId,
      isAdmin,
      "modify this listing",
    );

    if (existing.status === status) {
      return existing;
    }

    return tx.marketplacePost.update({
      where: { id },
      data: { status },
      select: buildPostMutationSelect(isAdmin),
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
    mapPrismaNotFound(err, "Marketplace listing not found");
  }
};

// ---------------------------------------------------------------------------
// Comments (atomic visibility + status guards)
// ---------------------------------------------------------------------------
export const createMarketplaceCommentAtomicInDb = async (params: {
  postId: string;
  authorId: string;
  content: string;
  parentId?: string | null;
  viewer: MarketplaceViewerContext;
}) => {
  try {
    return await prisma.$transaction(async (tx) => {
      const post = await tx.marketplacePost.findUnique({
        where: { id: params.postId },
        select: {
          id: true,
          authorId: true,
          title: true,
          status: true,
          isHiddenByModeration: true,
        },
      });

      if (
        !post ||
        !isMarketplaceItemVisibleToViewer(post, "MARKETPLACE_POST", params.viewer, {
          includeOwnHidden: false,
        })
      ) {
        throw new AppError("Marketplace listing not found", 404);
      }

      if (!canCommentOnMarketplacePost(post.status)) {
        throw new AppError(
          "Comments are closed for sold or closed listings.",
          400,
        );
      }

      let resolvedParentId: string | null = null;
      let parentAuthorId: string | null = null;
      if (params.parentId) {
        const parent = await tx.marketplaceComment.findUnique({
          where: { id: params.parentId },
          select: {
            id: true,
            authorId: true,
            postId: true,
            parentId: true,
            isHiddenByModeration: true,
          },
        });
        if (
          !parent ||
          parent.postId !== params.postId ||
          !isMarketplaceItemVisibleToViewer(
            parent,
            "MARKETPLACE_COMMENT",
            params.viewer,
          )
        ) {
          throw new AppError("Parent comment not found on this listing", 404);
        }
        resolvedParentId = resolveTopLevelParentCommentId(parent);
        parentAuthorId = parent.authorId;
      }

      const comment = await tx.marketplaceComment.create({
        data: {
          postId: params.postId,
          authorId: params.authorId,
          content: params.content,
          parentId: resolvedParentId,
        },
        select: commentNodeSelect,
      });

      return {
        comment,
        postAuthorId: post.authorId,
        postTitle: post.title,
        parentAuthorId,
      };
    });
  } catch (err) {
    mapPrismaNotFound(err, "Marketplace listing not found", ["P2003", "P2025"]);
  }
};

export const updateMarketplaceCommentAtomicInDb = async (
  postId: string,
  commentId: string,
  userId: string,
  content: string,
) => {
  try {
    return await prisma.$transaction(async (tx) => {
      const comment = await tx.marketplaceComment.findUnique({
        where: { id: commentId },
        select: {
          id: true,
          authorId: true,
          postId: true,
          isHiddenByModeration: true,
          post: { select: { isHiddenByModeration: true } },
        },
      });

      if (
        !comment ||
        comment.postId !== postId ||
        comment.isHiddenByModeration ||
        comment.post.isHiddenByModeration
      ) {
        throw new AppError("Comment not found", 404);
      }

      assertOwnership(comment.authorId === userId, false, "edit this comment");

      return tx.marketplaceComment.update({
        where: { id: commentId },
        data: { content },
        select: commentNodeSelect,
      });
    });
  } catch (err) {
    mapPrismaNotFound(err, "Comment not found");
  }
};

export const deleteMarketplaceCommentAtomicInDb = async (
  postId: string,
  commentId: string,
  userId: string,
  userRole: string | undefined,
) => {
  try {
    return await prisma.$transaction(async (tx) => {
      const comment = await tx.marketplaceComment.findUnique({
        where: { id: commentId },
        select: {
          id: true,
          authorId: true,
          postId: true,
          isHiddenByModeration: true,
          post: { select: { isHiddenByModeration: true } },
        },
      });

      const isAdmin = userRole === "ADMIN";
      if (
        !comment ||
        comment.postId !== postId ||
        (!isAdmin &&
          (comment.isHiddenByModeration || comment.post.isHiddenByModeration))
      ) {
        throw new AppError("Comment not found", 404);
      }

      assertOwnership(
        comment.authorId === userId,
        isAdmin,
        "delete this comment",
      );

      await tx.marketplaceComment.delete({ where: { id: commentId } });
      return { id: comment.id };
    });
  } catch (err) {
    mapPrismaNotFound(err, "Comment not found");
  }
};
