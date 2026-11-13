import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import {
  shouldAutoHideByReportCount,
  UGC_AUTO_HIDE_REPORT_THRESHOLD,
} from "../forum/forum.domain";
import { CreateLostFoundReportPayload } from "./lost-found.schema";

export const createLostFoundReportAndEvaluateAutoHideInDb = async (params: {
  reporterId: string;
  postId: string;
  reason: CreateLostFoundReportPayload["reason"];
  details?: string;
}) => {
  try {
    return await prisma.$transaction(async (tx) => {
      const post = await tx.lostFoundPost.findUnique({
        where: { id: params.postId },
        select: {
          id: true,
          authorId: true,
          type: true,
          category: true,
          title: true,
          description: true,
          location: true,
          isHiddenByModeration: true,
          updatedAt: true,
        },
      });

      if (!post || post.isHiddenByModeration) {
        throw new AppError("Lost & Found post not found", 404);
      }
      if (post.authorId === params.reporterId) {
        throw new AppError("You cannot report your own listing.", 400);
      }

      const existing = await tx.contentReport.findUnique({
        where: {
          reporterId_targetType_targetId: {
            reporterId: params.reporterId,
            targetType: "LOST_FOUND_POST",
            targetId: params.postId,
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
          throw new AppError("You have already reported this listing.", 409);
        }
        const reviewedBoundary = existing.reviewedAt ?? existing.createdAt;
        if (post.updatedAt <= reviewedBoundary) {
          throw new AppError(
            "A moderator has already reviewed this listing.",
            409,
          );
        }
        reopenReportId = existing.id;
      }

      const targetSnapshot: Prisma.InputJsonObject = {
        postId: post.id,
        type: post.type,
        category: post.category,
        title: post.title,
        contentPreview: (post.description || post.location || "").slice(0, 400),
      };

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
              targetType: "LOST_FOUND_POST",
              targetId: params.postId,
              targetAuthorId: post.authorId,
              reason: params.reason,
              details: params.details ?? null,
              targetSnapshot,
            },
          });

      const uniquePendingCount = await tx.contentReport.count({
        where: {
          targetType: "LOST_FOUND_POST",
          targetId: params.postId,
          status: "PENDING",
        },
      });

      const autoHidden = shouldAutoHideByReportCount(
        uniquePendingCount,
        UGC_AUTO_HIDE_REPORT_THRESHOLD,
      );

      if (autoHidden) {
        await tx.lostFoundPost.updateMany({
          where: { id: params.postId, isHiddenByModeration: false },
          data: { isHiddenByModeration: true, hiddenAt: new Date() },
        });
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
      throw new AppError("You have already reported this listing.", 409);
    }
    throw err;
  }
};
