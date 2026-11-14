import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import {
  shouldAutoHideByReportCount,
  UGC_AUTO_HIDE_REPORT_THRESHOLD,
} from "../forum/forum.domain";
import { CreateMemeReportByIdPayload } from "./meme.schema";

export interface CreateMemeReportParams {
  reporterId: string;
  memeId: string;
  reason: CreateMemeReportByIdPayload["reason"];
  details?: string;
}

export const createMemeReportAndEvaluateAutoHideInDb = async (
  params: CreateMemeReportParams,
) => {
  try {
    return await prisma.$transaction(async (tx) => {
      const lockedRows = await tx.$queryRaw<
        Array<{
          id: string;
          authorId: string;
          caption: string | null;
          imageUrl: string;
          isHiddenByModeration: boolean;
          updatedAt: Date;
        }>
      >`
        SELECT id, "authorId", caption, "imageUrl", "isHiddenByModeration", "updatedAt"
        FROM "meme"
        WHERE id = ${params.memeId}
        FOR UPDATE
      `;
      const meme = lockedRows[0];

      if (!meme || meme.isHiddenByModeration) {
        throw new AppError("Meme not found", 404);
      }

      if (meme.authorId === params.reporterId) {
        throw new AppError("You cannot report your own meme.", 400);
      }

      const existing = await tx.contentReport.findUnique({
        where: {
          reporterId_targetType_targetId: {
            reporterId: params.reporterId,
            targetType: "MEME_POST",
            targetId: params.memeId,
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
          throw new AppError("You have already reported this meme.", 409);
        }
        const reviewedBoundary = existing.reviewedAt ?? existing.createdAt;
        if (meme.updatedAt <= reviewedBoundary) {
          throw new AppError(
            "A moderator has already reviewed this meme.",
            409,
          );
        }
        reopenReportId = existing.id;
      }

      const targetSnapshot: Prisma.InputJsonObject = {
        postId: meme.id,
        memeId: meme.id,
        imageUrl: meme.imageUrl,
        title: meme.caption ? meme.caption.slice(0, 80) : "Campus Meme",
        contentPreview: meme.caption ?? "",
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
              targetType: "MEME_POST",
              targetId: params.memeId,
              targetAuthorId: meme.authorId,
              reason: params.reason,
              details: params.details ?? null,
              targetSnapshot,
            },
          });

      const uniquePendingCount = await tx.contentReport.count({
        where: {
          targetType: "MEME_POST",
          targetId: params.memeId,
          status: "PENDING",
        },
      });

      const autoHidden = shouldAutoHideByReportCount(
        uniquePendingCount,
        UGC_AUTO_HIDE_REPORT_THRESHOLD,
      );

      if (autoHidden) {
        await tx.meme.updateMany({
          where: { id: params.memeId, isHiddenByModeration: false },
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
      throw new AppError("You have already reported this meme.", 409);
    }
    throw err;
  }
};
