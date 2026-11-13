import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import {
  shouldAutoHideByReportCount,
  UGC_AUTO_HIDE_REPORT_THRESHOLD,
} from "../forum/forum.domain";
import { extractPlainText } from "../forum/forum.sanitizer";
import { CreateMarketplaceReportPayload } from "./marketplace.schema";

export const createMarketplaceReportAndEvaluateAutoHideInDb = async (params: {
  reporterId: string;
  targetType: CreateMarketplaceReportPayload["targetType"];
  targetId: string;
  reason: CreateMarketplaceReportPayload["reason"];
  details?: string;
}) => {
  try {
    return await prisma.$transaction(async (tx) => {
      let targetAuthorId: string;
      let targetUpdatedAt: Date;
      let targetSnapshot: Prisma.InputJsonObject;

      if (params.targetType === "MARKETPLACE_POST") {
        const post = await tx.marketplacePost.findUnique({
          where: { id: params.targetId },
          select: {
            id: true,
            authorId: true,
            type: true,
            category: true,
            title: true,
            description: true,
            isHiddenByModeration: true,
            updatedAt: true,
          },
        });

        if (!post || post.isHiddenByModeration) {
          throw new AppError("Marketplace listing not found", 404);
        }
        if (post.authorId === params.reporterId) {
          throw new AppError("You cannot report your own listing.", 400);
        }

        targetAuthorId = post.authorId;
        targetUpdatedAt = post.updatedAt;
        targetSnapshot = {
          postId: post.id,
          type: post.type,
          category: post.category,
          title: post.title,
          contentPreview: extractPlainText(post.description).slice(0, 400),
        };
      } else {
        const comment = await tx.marketplaceComment.findUnique({
          where: { id: params.targetId },
          select: {
            id: true,
            postId: true,
            authorId: true,
            content: true,
            isHiddenByModeration: true,
            updatedAt: true,
            post: {
              select: {
                id: true,
                title: true,
                isHiddenByModeration: true,
              },
            },
          },
        });

        if (
          !comment ||
          comment.isHiddenByModeration ||
          comment.post.isHiddenByModeration
        ) {
          throw new AppError("Marketplace comment not found", 404);
        }
        if (comment.authorId === params.reporterId) {
          throw new AppError("You cannot report your own comment.", 400);
        }

        targetAuthorId = comment.authorId;
        targetUpdatedAt = comment.updatedAt;
        targetSnapshot = {
          postId: comment.postId,
          commentId: comment.id,
          title: comment.post.title,
          contentPreview: extractPlainText(comment.content).slice(0, 400),
        };
      }

      const existing = await tx.contentReport.findUnique({
        where: {
          reporterId_targetType_targetId: {
            reporterId: params.reporterId,
            targetType: params.targetType,
            targetId: params.targetId,
          },
        },
        select: {
          id: true,
          status: true,
          reviewedAt: true,
          createdAt: true,
        },
      });

      let reopenReportId: string | undefined;
      if (existing) {
        if (existing.status !== "DISMISSED") {
          throw new AppError(
            params.targetType === "MARKETPLACE_POST"
              ? "You have already reported this listing."
              : "You have already reported this comment.",
            409,
          );
        }
        const reviewedBoundary = existing.reviewedAt ?? existing.createdAt;
        if (targetUpdatedAt <= reviewedBoundary) {
          throw new AppError(
            params.targetType === "MARKETPLACE_POST"
              ? "A moderator has already reviewed this listing."
              : "A moderator has already reviewed this comment.",
            409,
          );
        }
        reopenReportId = existing.id;
      }

      const report = reopenReportId
        ? await tx.contentReport.update({
            where: { id: reopenReportId },
            data: {
              reason: params.reason,
              details: params.details ?? null,
              targetSnapshot,
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
              targetAuthorId,
              reason: params.reason,
              details: params.details ?? null,
              targetSnapshot,
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
        if (params.targetType === "MARKETPLACE_POST") {
          await tx.marketplacePost.updateMany({
            where: { id: params.targetId, isHiddenByModeration: false },
            data: { isHiddenByModeration: true, hiddenAt: now },
          });
        } else {
          await tx.marketplaceComment.updateMany({
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
      throw new AppError(
        params.targetType === "MARKETPLACE_POST"
          ? "You have already reported this listing."
          : "You have already reported this comment.",
        409,
      );
    }
    throw err;
  }
};
