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

export const getReviews = async (hubId: string) => {
  const reviews = await reviewsRepository.findReviewsByHubId(hubId);

  const totalReviews = reviews.length;
  const averageRating =
    totalReviews > 0
      ? (
          reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews
        ).toFixed(1)
      : 0;

  // Sanitize identifying information if anonymous
  const sanitizedReviews = reviews.map((review) => {
    if (review.isAnonymous) {
      return {
        ...review,
        student: {
          id: "HIDDEN",
          name: "Anonymous Student",
          email: "HIDDEN",
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
  };
};
