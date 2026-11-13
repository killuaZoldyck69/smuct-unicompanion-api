import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import {
  attachReactionSummariesToResponses,
  feedAuthorSelect,
  publicUserSelect,
  ReactionType,
  shouldAutoHideByReportCount,
  UGC_AUTO_HIDE_REPORT_THRESHOLD,
  ViewerModerationContext,
} from "./forum.domain";
import {
  CreateForumReportPayload,
  CreatePostPayload,
  CreateResponsePayload,
  UpdatePostPayload,
  UpdateResponsePayload,
} from "./forum.schema";

export { publicUserSelect, feedAuthorSelect };

export const findUserUgcTermsStatus = async (userId: string) => {
  return await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      ugcTermsAcceptedAt: true,
    },
  });
};

export const getViewerModerationContext = async (
  userId?: string,
  role?: string,
): Promise<ViewerModerationContext> => {
  if (!userId) {
    return {
      userId: "",
      role,
      reportedPostIds: new Set<string>(),
      reportedResponseIds: new Set<string>(),
    };
  }

  const reports = await prisma.contentReport.findMany({
    where: {
      reporterId: userId,
      status: "PENDING",
      targetType: { in: ["FORUM_POST", "FORUM_RESPONSE"] },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      targetType: true,
      targetId: true,
    },
  });

  const reportedPostIds = new Set<string>();
  const reportedResponseIds = new Set<string>();

  for (const r of reports) {
    if (r.targetType === "FORUM_POST") {
      reportedPostIds.add(r.targetId);
    } else if (r.targetType === "FORUM_RESPONSE") {
      reportedResponseIds.add(r.targetId);
    }
  }

  return {
    userId,
    role,
    reportedPostIds,
    reportedResponseIds,
  };
};

export const buildVisibilityConditions = (
  viewer: ViewerModerationContext,
  options?: { includeOwnHidden?: boolean },
): Record<string, any> => {
  const where: Record<string, any> =
    options?.includeOwnHidden && viewer.userId
      ? {}
      : { isHiddenByModeration: false };

  if (viewer.reportedPostIds.size > 0 && !options?.includeOwnHidden) {
    where.id = { notIn: [...viewer.reportedPostIds] };
  }

  return where;
};

const buildResponseCountFilter = (viewer: ViewerModerationContext) => {
  const reportedIds = [...viewer.reportedResponseIds];
  const visibleResponseWhere: Record<string, any> = {
    isHiddenByModeration: false,
    ...(reportedIds.length > 0 ? { id: { notIn: reportedIds } } : {}),
  };

  return {
    ...visibleResponseWhere,
    OR: [{ parentId: null }, { parent: visibleResponseWhere }],
  };
};

export const createHelpPost = async (
  authorId: string,
  data: CreatePostPayload,
) => {
  return await prisma.helpPost.create({
    data: {
      title: data.title,
      description: data.description,
      authorId,
    },
    include: {
      author: {
        select: publicUserSelect,
      },
    },
  });
};

export const findHelpPosts = async (
  where: Record<string, any>,
  skip: number,
  take: number,
  viewer: ViewerModerationContext,
) => {
  const responseFilter = buildResponseCountFilter(viewer);

  return await prisma.helpPost.findMany({
    where,
    skip,
    take,
    orderBy: {
      createdAt: "desc",
    },
    include: {
      author: {
        select: feedAuthorSelect,
      },
      _count: {
        select: {
          responses: {
            where: responseFilter,
          },
        },
      },
    },
  });
};

export const countHelpPosts = async (where: Record<string, any>) => {
  return await prisma.helpPost.count({ where });
};

export const getForumCounts = async (
  viewer: ViewerModerationContext,
  userId?: string,
) => {
  const baseWhere = buildVisibilityConditions(viewer);
  const myPostsWhere: Record<string, any> = {
    ...buildVisibilityConditions(viewer, { includeOwnHidden: true }),
    authorId: userId,
  };

  const [groupedByResolution, myPosts] = await Promise.all([
    prisma.helpPost.groupBy({
      by: ["isResolved"],
      where: baseWhere,
      _count: { _all: true },
    }),
    userId ? prisma.helpPost.count({ where: myPostsWhere }) : 0,
  ]);

  let open = 0;
  let resolved = 0;
  for (const row of groupedByResolution) {
    if (row.isResolved) {
      resolved = row._count._all;
    } else {
      open = row._count._all;
    }
  }

  return {
    total: open + resolved,
    open,
    resolved,
    myPosts,
  };
};

export const findHelpPostById = async (
  id: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) => {
  return await db.helpPost.findUnique({
    where: { id },
  });
};

export const getResponseReactionSummaries = async (
  responseIds: string[],
  viewerUserId?: string,
) => {
  const countsByResponseId = new Map<
    string,
    { likesCount: number; dislikesCount: number }
  >();
  const userReactionByResponseId = new Map<string, ReactionType>();

  if (!responseIds.length) {
    return { countsByResponseId, userReactionByResponseId };
  }

  const [groupedCounts, viewerReactions] = await Promise.all([
    prisma.helpResponseReaction.groupBy({
      by: ["responseId", "type"],
      where: { responseId: { in: responseIds } },
      _count: { _all: true },
    }),
    viewerUserId
      ? prisma.helpResponseReaction.findMany({
          where: {
            responseId: { in: responseIds },
            userId: viewerUserId,
          },
          select: {
            responseId: true,
            type: true,
          },
        })
      : Promise.resolve([]),
  ]);

  for (const row of groupedCounts) {
    const current = countsByResponseId.get(row.responseId) ?? {
      likesCount: 0,
      dislikesCount: 0,
    };
    if (row.type === "LIKE") {
      current.likesCount = row._count._all;
    } else if (row.type === "DISLIKE") {
      current.dislikesCount = row._count._all;
    }
    countsByResponseId.set(row.responseId, current);
  }

  for (const r of viewerReactions) {
    userReactionByResponseId.set(r.responseId, r.type);
  }

  return { countsByResponseId, userReactionByResponseId };
};

export const findHelpPostWithDetails = async (
  id: string,
  viewer: ViewerModerationContext,
) => {
  const reportedResponseIds = [...viewer.reportedResponseIds];

  const responseVisibilityWhere: Record<string, any> = {
    ...(viewer.role === "ADMIN" ? {} : { isHiddenByModeration: false }),
    ...(reportedResponseIds.length ? { id: { notIn: reportedResponseIds } } : {}),
  };

  const post = await prisma.helpPost.findUnique({
    where: { id },
    include: {
      author: {
        select: publicUserSelect,
      },
      responses: {
        where: {
          parentId: null,
          ...responseVisibilityWhere,
        },
        orderBy: { createdAt: "asc" },
        take: 200,
        include: {
          responder: {
            select: publicUserSelect,
          },
          replies: {
            where: responseVisibilityWhere,
            orderBy: { createdAt: "asc" },
            take: 100,
            include: {
              responder: {
                select: publicUserSelect,
              },
            },
          },
        },
      },
    },
  });

  if (!post) return null;

  const allResponseIds: string[] = [];
  for (const response of post.responses) {
    allResponseIds.push(response.id);
    for (const reply of response.replies) {
      allResponseIds.push(reply.id);
    }
  }

  const { countsByResponseId, userReactionByResponseId } =
    await getResponseReactionSummaries(allResponseIds, viewer.userId);

  return {
    ...post,
    responses: attachReactionSummariesToResponses(
      post.responses,
      countsByResponseId,
      userReactionByResponseId,
    ),
  };
};

export const createHelpResponse = async (
  postId: string,
  responderId: string,
  data: CreateResponsePayload,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) => {
  const created = await db.helpResponse.create({
    data: {
      content: data.content,
      parentId: data.parentId ?? null,
      postId,
      responderId,
    },
    include: {
      responder: {
        select: publicUserSelect,
      },
    },
  });

  return {
    ...created,
    likesCount: 0,
    dislikesCount: 0,
    userReaction: null as ReactionType | null,
  };
};

export const updateHelpPost = async (
  id: string,
  data: UpdatePostPayload | { isResolved: boolean; updatedAt?: Date },
) => {
  return await prisma.helpPost.update({
    where: { id },
    data,
    include: {
      author: {
        select: publicUserSelect,
      },
    },
  });
};

export const deleteHelpPostById = async (id: string) => {
  return await prisma.helpPost.delete({
    where: { id },
  });
};

export const findHelpResponseById = async (
  id: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) => {
  return await db.helpResponse.findUnique({
    where: { id },
  });
};

export const updateHelpResponse = async (
  id: string,
  data: UpdateResponsePayload,
  viewerUserId?: string,
) => {
  const updated = await prisma.helpResponse.update({
    where: { id },
    data,
    include: {
      responder: {
        select: publicUserSelect,
      },
    },
  });

  const { countsByResponseId, userReactionByResponseId } =
    await getResponseReactionSummaries([updated.id], viewerUserId);
  const counts = countsByResponseId.get(updated.id) ?? {
    likesCount: 0,
    dislikesCount: 0,
  };

  return {
    ...updated,
    likesCount: counts.likesCount,
    dislikesCount: counts.dislikesCount,
    userReaction: userReactionByResponseId.get(updated.id) ?? null,
  };
};

export const deleteHelpResponseById = async (id: string) => {
  return await prisma.helpResponse.delete({
    where: { id },
  });
};

export const toggleHelpResponseReaction = async (
  responseId: string,
  userId: string,
  type: ReactionType,
) => {
  const result = await prisma.$transaction(async (tx) => {
    // Lock parent response row so missing targets fail cleanly (404) and concurrent first-time reactions serialize
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "HelpResponse" WHERE id = ${responseId} FOR UPDATE
    `;
    if (locked.length === 0) {
      throw new AppError("Response not found.", 404);
    }

    const existing = await tx.helpResponseReaction.findUnique({
      where: {
        responseId_userId: {
          responseId,
          userId,
        },
      },
    });

    let userReaction: ReactionType | null;
    if (existing) {
      if (existing.type === type) {
        await tx.helpResponseReaction.delete({
          where: { id: existing.id },
        });
        userReaction = null;
      } else {
        await tx.helpResponseReaction.update({
          where: { id: existing.id },
          data: { type },
        });
        userReaction = type;
      }
    } else {
      await tx.helpResponseReaction.create({
        data: {
          responseId,
          userId,
          type,
        },
      });
      userReaction = type;
    }

    const grouped = await tx.helpResponseReaction.groupBy({
      by: ["type"],
      where: { responseId },
      _count: { _all: true },
    });

    let likesCount = 0;
    let dislikesCount = 0;
    for (const row of grouped) {
      if (row.type === "LIKE") likesCount = row._count._all;
      if (row.type === "DISLIKE") dislikesCount = row._count._all;
    }

    return {
      responseId,
      likesCount,
      dislikesCount,
      userReaction,
    };
  });

  return result;
};

export const findExistingUserReport = async (
  reporterId: string,
  targetType: "FORUM_POST" | "FORUM_RESPONSE",
  targetId: string,
) => {
  return await prisma.contentReport.findUnique({
    where: {
      reporterId_targetType_targetId: {
        reporterId,
        targetType,
        targetId,
      },
    },
  });
};

export const createContentReportAndEvaluateAutoHide = async (params: {
  reporterId: string;
  targetType: "FORUM_POST" | "FORUM_RESPONSE";
  targetId: string;
  targetAuthorId: string | null;
  reason: CreateForumReportPayload["reason"];
  details?: string;
  targetSnapshot: Record<string, any>;
  reopenReportId?: string;
}) => {
  try {
    return await prisma.$transaction(async (tx) => {
      const report = params.reopenReportId
        ? await tx.contentReport.update({
            where: { id: params.reopenReportId },
            data: {
              reason: params.reason,
              details: params.details ?? null,
              targetSnapshot: params.targetSnapshot,
              status: "PENDING",
              reviewedById: null,
              reviewedAt: null,
              adminNote: null,
              createdAt: new Date(),
            },
          })
        : await tx.contentReport.create({
            data: {
              reporterId: params.reporterId,
              targetType: params.targetType,
              targetId: params.targetId,
              targetAuthorId: params.targetAuthorId,
              reason: params.reason,
              details: params.details ?? null,
              targetSnapshot: params.targetSnapshot,
            },
          });

      const uniquePendingCount = await tx.contentReport.count({
        where: {
          targetType: params.targetType,
          targetId: params.targetId,
          status: "PENDING",
        },
      });

      const autoHidden = shouldAutoHideByReportCount(
        uniquePendingCount,
        UGC_AUTO_HIDE_REPORT_THRESHOLD,
      );

      if (autoHidden) {
        const now = new Date();
        if (params.targetType === "FORUM_POST") {
          await tx.helpPost.updateMany({
            where: { id: params.targetId, isHiddenByModeration: false },
            data: { isHiddenByModeration: true, hiddenAt: now },
          });
        } else {
          await tx.helpResponse.updateMany({
            where: { id: params.targetId, isHiddenByModeration: false },
            data: { isHiddenByModeration: true, hiddenAt: now },
          });
        }
      }

      return {
        reportId: report.id,
        autoHidden,
      };
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new AppError("You have already reported this content.", 409);
    }
    throw err;
  }
};
