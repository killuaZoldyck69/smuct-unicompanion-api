import { Prisma } from "../../../generated/prisma/client";
import { MemeReactionType } from "../../constants/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { publicUserSelect } from "../forum/forum.domain";
import {
  computeMemePopularityScore,
  isMemeVisibleToViewer,
  MemeFilter,
  MemeViewerContext,
} from "./meme.domain";
import { assertNoForeignMemeMediaReferencesInTx } from "./meme.media";
import { CreateMemePayload, UpdateMemePayload } from "./meme.schema";

function buildMemeSelect(viewerId?: string) {
  return {
    id: true,
    authorId: true,
    caption: true,
    imageUrl: true,
    likesCount: true,
    dislikesCount: true,
    isHiddenByModeration: true,
    createdAt: true,
    updatedAt: true,
    author: { select: publicUserSelect },
    reactions: viewerId
      ? {
          where: { userId: viewerId },
          select: { type: true },
          take: 1,
        }
      : false,
  } satisfies Prisma.MemeSelect;
}

type MemeRowWithViewerReaction = Prisma.MemeGetPayload<{
  select: ReturnType<typeof buildMemeSelect>;
}>;

function formatMemeRow(row: MemeRowWithViewerReaction) {
  const { reactions, ...rest } = row;
  const userReaction = Array.isArray(reactions) && reactions.length > 0
    ? (reactions[0].type as MemeReactionType)
    : null;

  return {
    ...rest,
    userReaction,
  };
}

export const getMemeViewerContextInDb = async (
  userId?: string,
  role?: string,
): Promise<MemeViewerContext> => {
  if (!userId) {
    return {
      userId: "",
      role,
      reportedMemeIds: new Set<string>(),
    };
  }

  const reports = await prisma.contentReport.findMany({
    where: {
      reporterId: userId,
      targetType: "MEME_POST",
      status: { in: ["PENDING", "ACTIONED"] },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { targetId: true },
  });

  return {
    userId,
    role,
    reportedMemeIds: new Set(reports.map((r) => r.targetId)),
  };
};

export const createMemeInDb = async (
  authorId: string,
  payload: CreateMemePayload,
) => {
  const idempotencyKey = payload.idempotencyKey?.trim() || null;

  try {
    return await prisma.$transaction(async (tx) => {
      if (idempotencyKey) {
        const existing = await tx.meme.findUnique({
          where: {
            authorId_idempotencyKey: { authorId, idempotencyKey },
          },
          select: buildMemeSelect(authorId),
        });
        if (existing) {
          return formatMemeRow(existing);
        }
      }

      await assertNoForeignMemeMediaReferencesInTx(
        tx,
        [authorId],
        payload.imageUrl,
      );

      const created = await tx.meme.create({
        data: {
          authorId,
          imageUrl: payload.imageUrl,
          caption: payload.caption ?? null,
          idempotencyKey,
        },
        select: buildMemeSelect(authorId),
      });

      return formatMemeRow(created);
    });
  } catch (err) {
    if (
      idempotencyKey &&
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const existing = await prisma.meme.findUnique({
        where: {
          authorId_idempotencyKey: { authorId, idempotencyKey },
        },
        select: buildMemeSelect(authorId),
      });
      if (existing) {
        return formatMemeRow(existing);
      }
    }
    throw err;
  }
};

export const findMemesFeedInDb = async (
  viewer: MemeViewerContext,
  filter: MemeFilter,
  skip: number,
  take: number,
) => {
  const isAdmin = viewer.role === "ADMIN";
  const where: Prisma.MemeWhereInput = {};

  if (filter === "mine") {
    where.authorId = viewer.userId;
    where.isHiddenByModeration = false;
  } else if (!isAdmin) {
    where.isHiddenByModeration = false;
  }

  if (!isAdmin && viewer.reportedMemeIds.size > 0) {
    where.id = { notIn: [...viewer.reportedMemeIds] };
  }

  const orderBy: Prisma.MemeOrderByWithRelationInput[] =
    filter === "popular"
      ? [
          { popularityScore: "desc" },
          { createdAt: "desc" },
          { id: "desc" },
        ]
      : [{ createdAt: "desc" }, { id: "desc" }];

  const [total, rawMemes] = await Promise.all([
    prisma.meme.count({ where }),
    prisma.meme.findMany({
      where,
      skip,
      take,
      orderBy,
      select: buildMemeSelect(viewer.userId),
    }),
  ]);

  return {
    total,
    memes: rawMemes.map(formatMemeRow),
  };
};

export const findMemeByIdInDb = async (
  id: string,
  viewer: MemeViewerContext,
) => {
  const meme = await prisma.meme.findUnique({
    where: { id },
    select: buildMemeSelect(viewer.userId),
  });

  if (!meme || !isMemeVisibleToViewer(meme, viewer)) {
    return null;
  }

  return formatMemeRow(meme);
};

export const updateMemeInDb = async (
  id: string,
  userId: string,
  payload: UpdateMemePayload,
) => {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "meme" WHERE id = ${id} FOR UPDATE
    `;
    if (locked.length === 0) {
      throw new AppError("Meme not found", 404);
    }

    const existing = await tx.meme.findUnique({
      where: { id },
      select: {
        id: true,
        authorId: true,
        isHiddenByModeration: true,
      },
    });

    if (!existing || existing.isHiddenByModeration) {
      throw new AppError("Meme not found", 404);
    }

    if (existing.authorId !== userId) {
      throw new AppError("You do not have permission to edit this meme", 403);
    }

    const updated = await tx.meme.update({
      where: { id },
      data: {
        caption: payload.caption ?? null,
      },
      select: buildMemeSelect(userId),
    });

    return formatMemeRow(updated);
  });
};

export const toggleMemeReactionInDb = async (
  memeId: string,
  userId: string,
  type: MemeReactionType,
  viewer: MemeViewerContext,
) => {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "meme" WHERE id = ${memeId} FOR UPDATE
    `;
    if (locked.length === 0) {
      throw new AppError("Meme not found", 404);
    }

    const meme = await tx.meme.findUnique({
      where: { id: memeId },
      select: {
        id: true,
        authorId: true,
        caption: true,
        likesCount: true,
        dislikesCount: true,
        isHiddenByModeration: true,
      },
    });

    if (!meme || !isMemeVisibleToViewer(meme, viewer)) {
      throw new AppError("Meme not found", 404);
    }

    const existing = await tx.memeReaction.findUnique({
      where: {
        memeId_userId: { memeId, userId },
      },
      select: { type: true },
    });

    let action: "ADDED" | "REMOVED" | "SWITCHED";
    let finalReaction: MemeReactionType | null = type;

    if (existing) {
      if (existing.type === type) {
        await tx.memeReaction.deleteMany({
          where: { memeId, userId },
        });
        action = "REMOVED";
        finalReaction = null;
      } else {
        await tx.memeReaction.updateMany({
          where: { memeId, userId },
          data: { type },
        });
        action = "SWITCHED";
        finalReaction = type;
      }
    } else {
      await tx.memeReaction.create({
        data: { memeId, userId, type },
      });
      action = "ADDED";
      finalReaction = type;
    }

    const [likesCount, dislikesCount] = await Promise.all([
      tx.memeReaction.count({ where: { memeId, type: "LIKE" } }),
      tx.memeReaction.count({ where: { memeId, type: "DISLIKE" } }),
    ]);

    await tx.meme.update({
      where: { id: memeId },
      data: {
        likesCount,
        dislikesCount,
        popularityScore: computeMemePopularityScore(likesCount, dislikesCount),
      },
    });

    return {
      memeId,
      authorId: meme.authorId,
      caption: meme.caption,
      action,
      type,
      userReaction: finalReaction,
      likesCount,
      dislikesCount,
      previousLikesCount: meme.likesCount,
      previousDislikesCount: meme.dislikesCount,
    };
  });
};

export const deleteMemeAtomicInDb = async (
  memeId: string,
  userId: string,
  userRole?: string,
) => {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "meme" WHERE id = ${memeId} FOR UPDATE
    `;
    if (locked.length === 0) {
      throw new AppError("Meme not found", 404);
    }

    const meme = await tx.meme.findUnique({
      where: { id: memeId },
      select: {
        id: true,
        authorId: true,
        imageUrl: true,
        isHiddenByModeration: true,
      },
    });

    const isAdmin = userRole === "ADMIN";
    if (!meme || (meme.isHiddenByModeration && !isAdmin)) {
      throw new AppError("Meme not found", 404);
    }

    const isAuthor = meme.authorId === userId;
    if (!isAuthor && !isAdmin) {
      throw new AppError("You do not have permission to delete this meme", 403);
    }

    await tx.meme.delete({ where: { id: memeId } });

    return {
      id: meme.id,
      imageUrl: meme.imageUrl,
    };
  });
};
