import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import {
  ListingStatus,
  ListingType,
  MarketplaceCategory,
} from "../../constants/enums";
import {
  CreateMarketplaceCommentPayload,
  CreateMarketplacePayload,
} from "./marketplace.schema";

// ---------------------------------------------------------------------------
// Shared selector — defined once, reused everywhere to keep the query surface
// minimal and consistent.
// ---------------------------------------------------------------------------
const authorSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
  role: true,
  phoneNumber: true,
  bloodGroup: true,
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
} satisfies Prisma.UserSelect;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------
export interface MarketplaceFeedFilters {
  type?: ListingType;
  status?: ListingStatus;
  category?: MarketplaceCategory;
  search?: string;
}

export interface PaginationParams {
  /** cursor is the `id` of the last item returned on the previous page */
  cursor?: string;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  total: number;
}

// ---------------------------------------------------------------------------
// Feed — cursor-based pagination
// ---------------------------------------------------------------------------
export const findMarketplaceFeedInDb = async (
  filters: MarketplaceFeedFilters,
  pagination: PaginationParams
): Promise<PaginatedResult<Prisma.MarketplacePostGetPayload<typeof feedQuery>>> => {
  const { cursor, limit } = pagination;

  const where: Prisma.MarketplacePostWhereInput = {
    ...(filters.type && { type: filters.type }),
    ...(filters.status && { status: filters.status }),
    ...(filters.category && { category: filters.category }),
    ...(filters.search && {
      OR: [
        { title: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ],
    }),
  };

  // Fetch one extra item to determine if there is a next page
  const take = limit + 1;

  const [items, total] = await Promise.all([
    prisma.marketplacePost.findMany({
      where,
      take,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1, // skip the cursor item itself
      }),
      include: feedQuery.include,
      orderBy: { createdAt: "desc" },
    }),
    prisma.marketplacePost.count({ where }),
  ]);

  const hasNextPage = items.length > limit;
  if (hasNextPage) items.pop(); // remove the extra lookahead item

  const nextCursor =
    hasNextPage && items.length > 0 ? items[items.length - 1].id : null;

  return { items, nextCursor, total };
};

// The `include` shape used for feed queries (extracted so it can be reused
// in the `Prisma.MarketplacePostGetPayload` generic above).
const feedQuery = {
  include: {
    author: { select: authorSelect },
    _count: { select: { comments: true } },
  },
} as const;

// ---------------------------------------------------------------------------
// Single post
// ---------------------------------------------------------------------------
export const findMarketplacePostByIdInDb = async (id: string) => {
  return prisma.marketplacePost.findUnique({
    where: { id },
    include: {
      author: { select: authorSelect },
      comments: {
        where: { parentId: null },
        include: {
          author: { select: authorSelect },
          replies: {
            include: { author: { select: authorSelect } },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { comments: true } },
    },
  });
};

// ---------------------------------------------------------------------------
// Create / Update / Delete posts
// ---------------------------------------------------------------------------
export const createMarketplacePostInDb = async (
  authorId: string,
  payload: CreateMarketplacePayload
) => {
  return prisma.marketplacePost.create({
    data: {
      authorId,
      type: payload.type,
      title: payload.title,
      description: payload.description,
      price: payload.price ?? null,
      category: payload.category,
      condition: payload.condition ?? null,
      images: payload.images,
      contactPhone: payload.contactPhone ?? null,
    },
    include: { author: { select: authorSelect } },
  });
};

export const updateMarketplacePostInDb = async (
  id: string,
  data: Partial<CreateMarketplacePayload>
) => {
  return prisma.marketplacePost.update({
    where: { id },
    data,
    include: {
      author: { select: authorSelect },
      _count: { select: { comments: true } },
    },
  });
};

export const updateMarketplaceStatusInDb = async (
  id: string,
  status: ListingStatus
) => {
  return prisma.marketplacePost.update({
    where: { id },
    data: { status },
    include: { author: { select: authorSelect } },
  });
};

export const deleteMarketplacePostFromDb = async (id: string) => {
  return prisma.marketplacePost.delete({ where: { id } });
};

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------
export const createMarketplaceCommentInDb = async (
  postId: string,
  authorId: string,
  payload: CreateMarketplaceCommentPayload
) => {
  return prisma.marketplaceComment.create({
    data: {
      postId,
      authorId,
      content: payload.content,
      parentId: payload.parentId ?? null,
    },
    include: { author: { select: authorSelect } },
  });
};

export const findMarketplaceCommentByIdInDb = async (commentId: string) => {
  return prisma.marketplaceComment.findUnique({
    where: { id: commentId },
    select: { id: true, authorId: true, postId: true },
  });
};

export const deleteMarketplaceCommentFromDb = async (commentId: string) => {
  return prisma.marketplaceComment.delete({ where: { id: commentId } });
};
