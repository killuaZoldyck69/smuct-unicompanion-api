import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import {
  shouldAutoHideByReportCount,
  UGC_AUTO_HIDE_REPORT_THRESHOLD,
} from "../forum/forum.domain";
import { CreateLostFoundReportPayload } from "./lost-found.schema";

export const findExistingLostFoundReportInDb = async (
  reporterId: string,
  postId: string,
) => {
  return prisma.contentReport.findUnique({
    where: {
      reporterId_targetType_targetId: {
        reporterId,
        targetType: "LOST_FOUND_POST",
        targetId: postId,
      },
    },
  });
};

export const createLostFoundReportAndEvaluateAutoHideInDb = async (params: {
  reporterId: string;
  postId: string;
  targetAuthorId: string | null;
  reason: CreateLostFoundReportPayload["reason"];
  details?: string;
  targetSnapshot: Prisma.InputJsonObject;
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
              targetType: "LOST_FOUND_POST",
              targetId: params.postId,
              targetAuthorId: params.targetAuthorId,
              reason: params.reason,
              details: params.details ?? null,
              targetSnapshot: params.targetSnapshot,
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
