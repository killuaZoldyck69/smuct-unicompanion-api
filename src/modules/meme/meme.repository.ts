import { prisma } from "../../lib/prisma";
import { MemeReactionType } from "../../constants/enums";
import { CreateMemePayload } from "./meme.schema";

const authorSelection = {
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
};

export const createMemeInDb = async (
  authorId: string,
  payload: CreateMemePayload
) => {
  const meme = await prisma.meme.create({
    data: {
      authorId,
      imageUrl: payload.imageUrl,
      caption: payload.caption || null,
    },
    include: {
      author: { select: authorSelection },
    },
  });

  return {
    ...meme,
    likesCount: 0,
    dislikesCount: 0,
    userReaction: null,
  };
};

export const updateMemeInDb = async (
  id: string,
  payload: { caption?: string | null; imageUrl?: string }
) => {
  const meme = await prisma.meme.update({
    where: { id },
    data: {
      ...(payload.caption !== undefined ? { caption: payload.caption } : {}),
      ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
    },
    include: {
      author: { select: authorSelection },
      reactions: {
        select: {
          type: true,
          userId: true,
        },
      },
    },
  });

  let likesCount = 0;
  let dislikesCount = 0;
  for (const r of meme.reactions) {
    if (r.type === "LIKE") likesCount++;
    else if (r.type === "DISLIKE") dislikesCount++;
  }

  const { reactions, ...rest } = meme;
  return {
    ...rest,
    likesCount,
    dislikesCount,
  };
};

export const findMemesFeedInDb = async (
  currentUserId: string,
  filter: "latest" | "popular" | "mine",
  skip: number,
  take: number
) => {
  const where: any = {};
  if (filter === "mine") {
    where.authorId = currentUserId;
  }

  const [totalCount, rawMemes] = await Promise.all([
    prisma.meme.count({ where }),
    prisma.meme.findMany({
      where,
      skip: filter === "popular" ? undefined : skip,
      take: filter === "popular" ? undefined : take,
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: authorSelection },
        reactions: {
          select: {
            type: true,
            userId: true,
          },
        },
      },
    }),
  ]);

  const formattedMemes = rawMemes.map((meme) => {
    let likesCount = 0;
    let dislikesCount = 0;
    let userReaction: MemeReactionType | null = null;

    for (const r of meme.reactions) {
      if (r.type === "LIKE") {
        likesCount++;
      } else if (r.type === "DISLIKE") {
        dislikesCount++;
      }
      if (r.userId === currentUserId) {
        userReaction = r.type;
      }
    }

    const { reactions, ...rest } = meme;
    return {
      ...rest,
      likesCount,
      dislikesCount,
      userReaction,
    };
  });

  if (filter === "popular") {
    // Sort by net likes (likes - dislikes) or total likes, then slice pagination
    formattedMemes.sort((a, b) => {
      const scoreB = b.likesCount * 2 - b.dislikesCount;
      const scoreA = a.likesCount * 2 - a.dislikesCount;
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const paginated = formattedMemes.slice(skip, skip + take);
    return {
      total: totalCount,
      memes: paginated,
    };
  }

  return {
    total: totalCount,
    memes: formattedMemes,
  };
};

export const findMemeByIdInDb = async (id: string, currentUserId?: string) => {
  const meme = await prisma.meme.findUnique({
    where: { id },
    include: {
      author: { select: authorSelection },
      reactions: {
        select: {
          type: true,
          userId: true,
        },
      },
    },
  });

  if (!meme) return null;

  let likesCount = 0;
  let dislikesCount = 0;
  let userReaction: MemeReactionType | null = null;

  for (const r of meme.reactions) {
    if (r.type === "LIKE") {
      likesCount++;
    } else if (r.type === "DISLIKE") {
      dislikesCount++;
    }
    if (currentUserId && r.userId === currentUserId) {
      userReaction = r.type;
    }
  }

  const { reactions, ...rest } = meme;
  return {
    ...rest,
    likesCount,
    dislikesCount,
    userReaction,
  };
};

export const toggleMemeReactionInDb = async (
  memeId: string,
  userId: string,
  type: MemeReactionType
) => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.memeReaction.findUnique({
      where: {
        memeId_userId: {
          memeId,
          userId,
        },
      },
    });

    let finalReaction: MemeReactionType | null = type;

    if (existing) {
      if (existing.type === type) {
        // Toggle off (unreact)
        await tx.memeReaction.delete({
          where: { id: existing.id },
        });
        finalReaction = null;
      } else {
        // Switch reaction (e.g. from LIKE to DISLIKE or vice-versa)
        await tx.memeReaction.update({
          where: { id: existing.id },
          data: { type },
        });
        finalReaction = type;
      }
    } else {
      // New reaction
      await tx.memeReaction.create({
        data: {
          memeId,
          userId,
          type,
        },
      });
      finalReaction = type;
    }

    const [likesCount, dislikesCount] = await Promise.all([
      tx.memeReaction.count({
        where: { memeId, type: "LIKE" },
      }),
      tx.memeReaction.count({
        where: { memeId, type: "DISLIKE" },
      }),
    ]);

    return {
      memeId,
      userReaction: finalReaction,
      likesCount,
      dislikesCount,
    };
  });
};

export const deleteMemeFromDb = async (id: string) => {
  return prisma.meme.delete({
    where: { id },
  });
};
