import { prisma } from "../../lib/prisma";
import { appCache } from "../../lib/cache";
import { AppError } from "../../utils/AppError";
import { deleteUnreferencedLostFoundImages } from "../lost-found/lost-found.media";
import { deleteUnreferencedMarketplaceImages } from "../marketplace/marketplace.media";
import { publicUserSelect } from "../forum/forum.repository";
import { extractPlainText } from "../forum/forum.sanitizer";
import {
  AdminForumReportsQuery,
  AdminResolveReportPayload,
} from "./admin.schema";

const FORUM_TARGET_TYPES = [
  "FORUM_POST",
  "FORUM_RESPONSE",
  "LOST_FOUND_POST",
  "MARKETPLACE_POST",
  "MARKETPLACE_COMMENT",
] as const;

const safeModerationActorSelect = {
  id: true,
  name: true,
  image: true,
  role: true,
} as const;

const safeTargetAuthorSelect = {
  ...publicUserSelect,
  isRestricted: true,
} as const;

export const getForumReportsQueueService = async (
  query: AdminForumReportsQuery,
) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Math.min(50, Number(query.limit) || 20));
  const skip = (page - 1) * limit;

  const where: Record<string, any> = {
    targetType:
      query.targetType === "ALL"
        ? { in: [...FORUM_TARGET_TYPES] }
        : query.targetType,
  };

  if (query.status !== "ALL") {
    where.status = query.status;
  }

  const [reports, total, pendingCount] = await Promise.all([
    prisma.contentReport.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ createdAt: "desc" }],
      include: {
        reporter: { select: safeModerationActorSelect },
        targetAuthor: { select: safeTargetAuthorSelect },
        reviewedBy: { select: safeModerationActorSelect },
      },
    }),
    prisma.contentReport.count({ where }),
    prisma.contentReport.count({
      where: {
        status: "PENDING",
        targetType: { in: [...FORUM_TARGET_TYPES] },
      },
    }),
  ]);

  const targetPairs = reports.map((r) => ({
    targetType: r.targetType,
    targetId: r.targetId,
  }));

  const uniquePostIds = [
    ...new Set(
      reports
        .filter((r) => r.targetType === "FORUM_POST")
        .map((r) => r.targetId),
    ),
  ];
  const uniqueResponseIds = [
    ...new Set(
      reports
        .filter((r) => r.targetType === "FORUM_RESPONSE")
        .map((r) => r.targetId),
    ),
  ];
  const uniqueLostFoundIds = [
    ...new Set(
      reports
        .filter((r) => r.targetType === "LOST_FOUND_POST")
        .map((r) => r.targetId),
    ),
  ];
  const uniqueMarketplacePostIds = [
    ...new Set(
      reports
        .filter((r) => r.targetType === "MARKETPLACE_POST")
        .map((r) => r.targetId),
    ),
  ];
  const uniqueMarketplaceCommentIds = [
    ...new Set(
      reports
        .filter((r) => r.targetType === "MARKETPLACE_COMMENT")
        .map((r) => r.targetId),
    ),
  ];
  const uniqueTargetIds = [...new Set(targetPairs.map((p) => p.targetId))];

  const groupedTargetTypeFilter =
    query.targetType === "ALL"
      ? { in: [...FORUM_TARGET_TYPES] }
      : query.targetType;

  const [
    groupedTargetCounts,
    livePosts,
    liveResponses,
    liveLostFoundPosts,
    liveMarketplacePosts,
    liveMarketplaceComments,
  ] = await Promise.all([
    uniqueTargetIds.length
      ? prisma.contentReport.groupBy({
          by: ["targetType", "targetId"],
          where: {
            targetType: groupedTargetTypeFilter,
            targetId: { in: uniqueTargetIds },
            status: "PENDING",
          },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    uniquePostIds.length
      ? prisma.helpPost.findMany({
          where: { id: { in: uniquePostIds } },
          select: {
            id: true,
            title: true,
            description: true,
            isResolved: true,
            isHiddenByModeration: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
    uniqueResponseIds.length
      ? prisma.helpResponse.findMany({
          where: { id: { in: uniqueResponseIds } },
          select: {
            id: true,
            postId: true,
            content: true,
            isHiddenByModeration: true,
            createdAt: true,
            post: {
              select: {
                id: true,
                title: true,
                isHiddenByModeration: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    uniqueLostFoundIds.length
      ? prisma.lostFoundPost.findMany({
          where: { id: { in: uniqueLostFoundIds } },
          select: {
            id: true,
            title: true,
            description: true,
            location: true,
            status: true,
            isHiddenByModeration: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
    uniqueMarketplacePostIds.length
      ? prisma.marketplacePost.findMany({
          where: { id: { in: uniqueMarketplacePostIds } },
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            isHiddenByModeration: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
    uniqueMarketplaceCommentIds.length
      ? prisma.marketplaceComment.findMany({
          where: { id: { in: uniqueMarketplaceCommentIds } },
          select: {
            id: true,
            postId: true,
            content: true,
            isHiddenByModeration: true,
            createdAt: true,
            post: {
              select: {
                id: true,
                title: true,
                isHiddenByModeration: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const pendingByTarget = new Map<string, number>();
  for (const row of groupedTargetCounts) {
    pendingByTarget.set(`${row.targetType}:${row.targetId}`, row._count._all);
  }

  const postById = new Map(livePosts.map((p) => [p.id, p]));
  const responseById = new Map(liveResponses.map((resp) => [resp.id, resp]));
  const lostFoundById = new Map(liveLostFoundPosts.map((lf) => [lf.id, lf]));
  const marketplacePostById = new Map(
    liveMarketplacePosts.map((mp) => [mp.id, mp]),
  );
  const marketplaceCommentById = new Map(
    liveMarketplaceComments.map((mc) => [mc.id, mc]),
  );

  const enriched = reports.map((report) => {
    const snapshot =
      report.targetSnapshot && typeof report.targetSnapshot === "object"
        ? (report.targetSnapshot as Record<string, any>)
        : null;
    const uniquePendingReportCount =
      pendingByTarget.get(`${report.targetType}:${report.targetId}`) ?? 0;

    if (report.targetType === "FORUM_POST") {
      const livePost = postById.get(report.targetId);
      const resolvedPostId =
        livePost?.id ?? snapshot?.postId ?? report.targetId;
      return {
        ...report,
        postId: resolvedPostId,
        responseId: null,
        targetExists: Boolean(livePost),
        targetLive: livePost
          ? {
              id: livePost.id,
              postId: livePost.id,
              title: livePost.title,
              postTitle: livePost.title,
              contentPreview: extractPlainText(livePost.description).slice(
                0,
                800,
              ),
              isResolved: livePost.isResolved,
              isHiddenByModeration: livePost.isHiddenByModeration,
              createdAt: livePost.createdAt,
            }
          : null,
        uniquePendingReportCount,
      };
    }

    if (report.targetType === "LOST_FOUND_POST") {
      const liveLf = lostFoundById.get(report.targetId);
      const resolvedPostId = liveLf?.id ?? snapshot?.postId ?? report.targetId;
      return {
        ...report,
        postId: resolvedPostId,
        responseId: null,
        targetExists: Boolean(liveLf),
        targetLive: liveLf
          ? {
              id: liveLf.id,
              postId: liveLf.id,
              title: liveLf.title,
              postTitle: liveLf.title,
              contentPreview: (
                liveLf.description ||
                liveLf.location ||
                ""
              ).slice(0, 800),
              isResolved: liveLf.status === "RESOLVED",
              isHiddenByModeration: liveLf.isHiddenByModeration,
              createdAt: liveLf.createdAt,
            }
          : null,
        uniquePendingReportCount,
      };
    }

    if (report.targetType === "MARKETPLACE_POST") {
      const liveMp = marketplacePostById.get(report.targetId);
      const resolvedPostId = liveMp?.id ?? snapshot?.postId ?? report.targetId;
      return {
        ...report,
        postId: resolvedPostId,
        responseId: null,
        targetExists: Boolean(liveMp),
        targetLive: liveMp
          ? {
              id: liveMp.id,
              postId: liveMp.id,
              title: liveMp.title,
              postTitle: liveMp.title,
              contentPreview: extractPlainText(liveMp.description).slice(
                0,
                800,
              ),
              isResolved: liveMp.status !== "ACTIVE",
              isHiddenByModeration: liveMp.isHiddenByModeration,
              createdAt: liveMp.createdAt,
            }
          : null,
        uniquePendingReportCount,
      };
    }

    if (report.targetType === "MARKETPLACE_COMMENT") {
      const liveComment = marketplaceCommentById.get(report.targetId);
      const resolvedPostId =
        liveComment?.postId ??
        (typeof snapshot?.postId === "string" ? snapshot.postId : null);
      return {
        ...report,
        postId: resolvedPostId,
        responseId: report.targetId,
        targetExists: Boolean(liveComment),
        targetLive: liveComment
          ? {
              id: liveComment.id,
              postId: liveComment.postId,
              title: null,
              postTitle: liveComment.post?.title ?? null,
              contentPreview: extractPlainText(liveComment.content).slice(
                0,
                800,
              ),
              isResolved: null,
              isHiddenByModeration: liveComment.isHiddenByModeration,
              createdAt: liveComment.createdAt,
            }
          : null,
        uniquePendingReportCount,
      };
    }

    const liveResponse = responseById.get(report.targetId);
    const resolvedPostId =
      liveResponse?.postId ??
      (typeof snapshot?.postId === "string" ? snapshot.postId : null);

    return {
      ...report,
      postId: resolvedPostId,
      responseId: report.targetId,
      targetExists: Boolean(liveResponse),
      targetLive: liveResponse
        ? {
            id: liveResponse.id,
            postId: liveResponse.postId,
            title: null,
            postTitle: liveResponse.post?.title ?? null,
            contentPreview: extractPlainText(liveResponse.content).slice(
              0,
              800,
            ),
            isResolved: null,
            isHiddenByModeration: liveResponse.isHiddenByModeration,
            createdAt: liveResponse.createdAt,
          }
        : null,
      uniquePendingReportCount,
    };
  });

  const totalPages = Math.ceil(total / limit);

  return {
    data: enriched,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
      pendingCount,
    },
  };
};

async function setTargetModerationVisibilityInTx(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  targetType: string,
  targetId: string,
  isHiddenByModeration: boolean,
  hiddenAt: Date | null,
) {
  const data = { isHiddenByModeration, hiddenAt };
  switch (targetType) {
    case "FORUM_POST":
      await tx.helpPost.updateMany({ where: { id: targetId }, data });
      break;
    case "LOST_FOUND_POST":
      await tx.lostFoundPost.updateMany({ where: { id: targetId }, data });
      break;
    case "MARKETPLACE_POST":
      await tx.marketplacePost.updateMany({ where: { id: targetId }, data });
      break;
    case "MARKETPLACE_COMMENT":
      await tx.marketplaceComment.updateMany({ where: { id: targetId }, data });
      break;
    default:
      await tx.helpResponse.updateMany({ where: { id: targetId }, data });
      break;
  }
}

export const resolveForumReportService = async (
  reportId: string,
  adminId: string,
  payload: AdminResolveReportPayload,
) => {
  const now = new Date();
  const nextStatus = payload.action === "DISMISS" ? "DISMISSED" : "ACTIONED";
  const adminNote = payload.adminNote ?? null;
  let shouldInvalidateUserCaches = false;
  const lostFoundImagesToDelete: string[] = [];
  const marketplaceImagesToDelete: string[] = [];

  await prisma.$transaction(async (tx) => {
    // Lock report row so concurrent moderation actions serialize and cannot double-resolve or flip state
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "content_report" WHERE id = ${reportId} FOR UPDATE
    `;

    if (locked.length === 0) {
      throw new AppError("Content report not found.", 404);
    }

    const report = await tx.contentReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new AppError("Content report not found.", 404);
    }

    if (report.status !== "PENDING") {
      throw new AppError("This content report has already been reviewed.", 409);
    }

    if (payload.action === "RESTRICT_USER") {
      if (!report.targetAuthorId) {
        throw new AppError(
          "The author of this content no longer exists; use HIDE_CONTENT or DELETE_CONTENT instead.",
          400,
        );
      }
      if (report.targetAuthorId === adminId) {
        throw new AppError(
          "Administrators cannot restrict their own account.",
          400,
        );
      }

      const targetUser = await tx.user.findUnique({
        where: { id: report.targetAuthorId },
        select: { id: true, role: true },
      });

      if (!targetUser) {
        throw new AppError("User not found.", 404);
      }

      if (targetUser.role === "ADMIN") {
        throw new AppError("Administrator accounts cannot be restricted.", 403);
      }

      await tx.user.update({
        where: { id: targetUser.id },
        data: { isRestricted: true },
      });
      await tx.session.deleteMany({
        where: { userId: targetUser.id },
      });
      shouldInvalidateUserCaches = true;
    }

    let childResponseIds: string[] = [];
    let childMarketplaceCommentIds: string[] = [];
    if (payload.action === "DELETE_CONTENT") {
      if (report.targetType === "FORUM_POST") {
        const childResponses = await tx.helpResponse.findMany({
          where: { postId: report.targetId },
          select: { id: true },
        });
        childResponseIds = childResponses.map((r) => r.id);
      } else if (report.targetType === "MARKETPLACE_POST") {
        const childComments = await tx.marketplaceComment.findMany({
          where: { postId: report.targetId },
          select: { id: true },
        });
        childMarketplaceCommentIds = childComments.map((c) => c.id);
      }
    }

    // Resolve target report, sibling reports on same target, and pending child-comment reports if deleting parent post
    await tx.contentReport.updateMany({
      where: {
        OR: [
          { id: report.id },
          {
            targetType: report.targetType,
            targetId: report.targetId,
            status: "PENDING",
          },
          ...(childResponseIds.length
            ? [
                {
                  targetType: "FORUM_RESPONSE" as const,
                  targetId: { in: childResponseIds },
                  status: "PENDING" as const,
                },
              ]
            : []),
          ...(childMarketplaceCommentIds.length
            ? [
                {
                  targetType: "MARKETPLACE_COMMENT" as const,
                  targetId: { in: childMarketplaceCommentIds },
                  status: "PENDING" as const,
                },
              ]
            : []),
        ],
      },
      data: {
        status: nextStatus,
        reviewedById: adminId,
        reviewedAt: now,
        adminNote,
      },
    });

    if (payload.action === "DISMISS") {
      const remainingActioned = await tx.contentReport.count({
        where: {
          targetType: report.targetType,
          targetId: report.targetId,
          status: "ACTIONED",
        },
      });

      if (remainingActioned === 0) {
        await setTargetModerationVisibilityInTx(
          tx,
          report.targetType,
          report.targetId,
          false,
          null,
        );
      }
    } else if (
      payload.action === "HIDE_CONTENT" ||
      payload.action === "RESTRICT_USER"
    ) {
      await setTargetModerationVisibilityInTx(
        tx,
        report.targetType,
        report.targetId,
        true,
        now,
      );
    } else if (payload.action === "DELETE_CONTENT") {
      if (report.targetType === "FORUM_POST") {
        await tx.helpPost.deleteMany({ where: { id: report.targetId } });
      } else if (report.targetType === "LOST_FOUND_POST") {
        const lfPost = await tx.lostFoundPost.findUnique({
          where: { id: report.targetId },
          select: {
            images: true,
            claims: {
              where: { proofImage: { not: null } },
              select: { proofImage: true },
              take: 500,
            },
          },
        });
        if (lfPost) {
          lostFoundImagesToDelete.push(...(lfPost.images || []));
          for (const c of lfPost.claims) {
            if (c.proofImage) lostFoundImagesToDelete.push(c.proofImage);
          }
          await tx.lostFoundPost.deleteMany({ where: { id: report.targetId } });
        }
      } else if (report.targetType === "MARKETPLACE_POST") {
        const mpPost = await tx.marketplacePost.findUnique({
          where: { id: report.targetId },
          select: { images: true },
        });
        if (mpPost) {
          marketplaceImagesToDelete.push(...(mpPost.images || []));
          await tx.marketplacePost.deleteMany({ where: { id: report.targetId } });
        }
      } else if (report.targetType === "MARKETPLACE_COMMENT") {
        await tx.marketplaceComment.deleteMany({
          where: { id: report.targetId },
        });
      } else {
        await tx.helpResponse.deleteMany({ where: { id: report.targetId } });
      }
    }
  });

  if (lostFoundImagesToDelete.length > 0) {
    void deleteUnreferencedLostFoundImages(
      lostFoundImagesToDelete,
      "deleted Lost & Found moderation images",
    );
  }

  if (marketplaceImagesToDelete.length > 0) {
    void deleteUnreferencedMarketplaceImages(
      marketplaceImagesToDelete,
      "deleted Marketplace moderation images",
    );
  }

  if (shouldInvalidateUserCaches) {
    appCache.delPattern(/^users:list/);
    appCache.delPattern(/^directory:students/);
    appCache.delPattern(/^directory:teachers/);
  }

  const updated = await prisma.contentReport.findUnique({
    where: { id: reportId },
    include: {
      reporter: { select: safeModerationActorSelect },
      targetAuthor: {
        select: {
          ...safeModerationActorSelect,
          isRestricted: true,
        },
      },
      reviewedBy: { select: safeModerationActorSelect },
    },
  });

  return updated;
};
