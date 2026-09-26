import { verifyHubRole } from "../hub.service";
import { AppError } from "../../../utils/AppError";
import * as reviewsRepository from "./reviews.repository";
import {
  SubmitReviewPayload,
  UpdateReviewSettingsPayload,
} from "./reviews.schema";

export const updateReviewSettings = async (
  userId: string,
  hubId: string,
  data: UpdateReviewSettingsPayload,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "TA"]);
  return await reviewsRepository.updateHubReviewSettings(hubId, data);
};

export const submitReview = async (
  userId: string,
  hubId: string,
  data: SubmitReviewPayload,
) => {
  await verifyHubRole(userId, hubId, ["STUDENT", "CR", "TA"]);

  const hub = await reviewsRepository.findHubById(hubId);

  // Validate that reviews are enabled for this hub
  if (!hub || !hub.isReviewOpen) {
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

  return await reviewsRepository.createCourseReview(hubId, userId, data);
};

export const getReviews = async (hubId: string, currentUserId?: string) => {
  const hub = await reviewsRepository.findHubById(hubId);
  const reviews = await reviewsRepository.findReviewsByHubId(hubId);

  const totalReviews = reviews.length;
  const averageRating =
    totalReviews > 0
      ? Number((reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews).toFixed(1))
      : 0;

  const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  reviews.forEach((r) => {
    if (r.rating >= 1 && r.rating <= 5) {
      ratingDistribution[r.rating] = (ratingDistribution[r.rating] || 0) + 1;
    }
  });

  const myReview = currentUserId
    ? reviews.find((r) => r.studentId === currentUserId)
    : null;
  const hasSubmitted = !!myReview;

  // Sanitize identifying information if anonymous
  const sanitizedReviews = reviews.map((review) => {
    if (review.isAnonymous) {
      return {
        ...review,
        studentId: undefined,
        student: {
          id: undefined,
          name: "Anonymous Student",
          email: undefined,
          image: null,
          studentProfile: null,
        },
      };
    }
    return review;
  });

  return {
    reviews: sanitizedReviews,
    totalReviews,
    averageRating,
    ratingDistribution,
    isReviewOpen: hub?.isReviewOpen || false,
    reviewQuestions: (hub?.reviewQuestions as string[]) || [],
    hasSubmitted,
    myReview: myReview
      ? {
          id: myReview.id,
          rating: myReview.rating,
          comment: myReview.comment,
          isAnonymous: myReview.isAnonymous,
          answers: myReview.answers,
          createdAt: myReview.createdAt,
        }
      : null,
  };
};
