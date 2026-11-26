import { Prisma } from "../../../../generated/prisma/client";
import { AppError } from "../../../utils/AppError";
import { createHubNotifications } from "../../notification/notification.service";
import {
  assertActiveHub,
  dispatchHubNotification,
  invalidateHubCaches,
  verifyHubRole,
} from "../hub.service";
import {
  computeReviewStats,
  sanitizeReviewAnswers,
  sanitizeReviewQuestions,
  shuffleArray,
  toAnonymousReviewPublicItem,
} from "./reviews.domain";
import * as reviewsRepository from "./reviews.repository";
import {
  EditReviewPayload,
  SubmitReviewPayload,
  UpdateReviewSettingsPayload,
} from "./reviews.schema";

export const updateReviewSettings = async (
  userId: string,
  hubId: string,
  data: UpdateReviewSettingsPayload,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER"]);
  await assertActiveHub(
    hubId,
    "Archived Course Hubs are read-only and review settings cannot be changed.",
  );

  const existingHub = await reviewsRepository.findHubById(hubId);
  if (!existingHub) throw new AppError("Course hub not found", 404);

  const cleanQuestions = sanitizeReviewQuestions(data.reviewQuestions);
  const updatedHub = await reviewsRepository.updateHubReviewSettings(hubId, {
    isReviewOpen: data.isReviewOpen,
    reviewQuestions: cleanQuestions,
  });
  invalidateHubCaches(hubId);

  if (!existingHub.isReviewOpen && updatedHub.isReviewOpen) {
    const hourBucket = Math.floor(Date.now() / (60 * 60 * 1000));
    dispatchHubNotification(
      createHubNotifications(
        hubId,
        userId,
        {
          type: "REVIEW_OPEN",
          title: "Course review is open",
          body: "The review period is open. Share your feedback for this course.",
          route: `/hub/${hubId}?tab=review`,
          dedupeKey: `review-open:${hubId}:${hourBucket}`,
        },
        ["STUDENT", "CR"],
      ),
      "hub.review_open_notification_failed",
      hubId,
    );
  }
  return updatedHub;
};

export const submitReview = async (
  userId: string,
  hubId: string,
  data: SubmitReviewPayload,
) => {
  await verifyHubRole(userId, hubId, ["STUDENT", "CR"]);
  await assertActiveHub(
    hubId,
    "Archived Course Hubs are read-only and cannot accept reviews.",
  );

  const hub = await reviewsRepository.findHubById(hubId);
  if (!hub) throw new AppError("Course hub not found", 404);
  if (!hub.isReviewOpen) {
    throw new AppError(
      "Review submission is currently closed for this hub.",
      403,
    );
  }

  const existingReview = await reviewsRepository.findExistingReview(
    hubId,
    userId,
  );
  if (existingReview) {
    throw new AppError(
      "You have already submitted a review for this course.",
      409,
    );
  }

  const comment = data.comment?.trim() || null;
  const answers = sanitizeReviewAnswers(data.answers);

  try {
    const created = await reviewsRepository.createCourseReview(hubId, userId, {
      rating: data.rating,
      comment,
      answers,
    });
    invalidateHubCaches(hubId);
    return created;
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(
        "You have already submitted a review for this course.",
        409,
      );
    }
    throw error;
  }
};

export const editReview = async (
  userId: string,
  hubId: string,
  data: EditReviewPayload,
) => {
  await verifyHubRole(userId, hubId, ["STUDENT", "CR"]);
  await assertActiveHub(
    hubId,
    "Archived Course Hubs are read-only and reviews cannot be edited.",
  );

  const hub = await reviewsRepository.findHubById(hubId);
  if (!hub) throw new AppError("Course hub not found", 404);
  if (!hub.isReviewOpen) {
    throw new AppError(
      "Review editing is closed because evaluations are no longer open for this hub.",
      403,
    );
  }

  const existingReview = await reviewsRepository.findExistingReview(
    hubId,
    userId,
  );
  if (!existingReview) {
    throw new AppError(
      "Review not found or you have not submitted a review yet.",
      404,
    );
  }

  const updated = await reviewsRepository.updateCourseReview(hubId, userId, {
    ...(data.rating !== undefined ? { rating: data.rating } : {}),
    ...(data.comment !== undefined
      ? { comment: data.comment?.trim() || null }
      : {}),
    ...(data.answers !== undefined
      ? { answers: sanitizeReviewAnswers(data.answers) }
      : {}),
  });
  invalidateHubCaches(hubId);
  return updated;
};

export const deleteReview = async (userId: string, hubId: string) => {
  await verifyHubRole(userId, hubId, ["STUDENT", "CR"]);
  await assertActiveHub(
    hubId,
    "Archived Course Hubs are read-only and reviews cannot be deleted.",
  );

  const existingReview = await reviewsRepository.findExistingReview(
    hubId,
    userId,
  );
  if (!existingReview) {
    throw new AppError("Review not found.", 404);
  }

  await reviewsRepository.deleteCourseReview(hubId, userId);
  invalidateHubCaches(hubId);
  return { success: true, message: "Review deleted successfully." };
};

export const getReviews = async (userId: string, hubId: string) => {
  const member = await verifyHubRole(userId, hubId, [
    "TEACHER",
    "CR",
    "STUDENT",
    "ADMIN",
  ]);

  const hub = await reviewsRepository.findHubById(hubId);
  if (!hub) throw new AppError("Course hub not found", 404);

  const reviews = await reviewsRepository.findReviewsByHubId(hubId);
  const { totalReviews, averageRating, ratingDistribution } = computeReviewStats(
    reviews.map((r) => r.rating),
  );

  const isStudentMember = member.role === "STUDENT" || member.role === "CR";
  const myReview = isStudentMember
    ? await reviewsRepository.findExistingReview(hubId, userId)
    : null;
  const hasSubmitted = Boolean(myReview);

  const sanitizedReviews = reviews.map(toAnonymousReviewPublicItem);
  const shuffledReviews = shuffleArray(sanitizedReviews);

  return {
    reviews: shuffledReviews,
    totalReviews,
    averageRating,
    ratingDistribution,
    isReviewOpen: Boolean(hub.isReviewOpen),
    reviewQuestions: Array.isArray(hub.reviewQuestions)
      ? (hub.reviewQuestions as string[])
      : [],
    hasSubmitted,
    myReview: myReview
      ? {
          id: myReview.id,
          rating: myReview.rating,
          comment: myReview.comment,
          isAnonymous: true,
          answers: myReview.answers,
          createdAt: myReview.createdAt,
          updatedAt: myReview.updatedAt,
        }
      : null,
  };
};
