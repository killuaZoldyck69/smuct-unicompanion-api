import { verifyHubRole } from "../hub.service";
import { AppError } from "../../../utils/AppError";
import * as reviewsRepository from "./reviews.repository";
import {
  SubmitReviewPayload,
  UpdateReviewSettingsPayload,
  EditReviewPayload,
} from "./reviews.schema";

export const updateReviewSettings = async (
  userId: string,
  hubId: string,
  data: UpdateReviewSettingsPayload,
) => {
  // Only TEACHER can active reviews and add optional questions
  await verifyHubRole(userId, hubId, ["TEACHER"]);
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

export const editReview = async (
  userId: string,
  hubId: string,
  data: EditReviewPayload,
) => {
  await verifyHubRole(userId, hubId, ["STUDENT", "CR", "TA"]);

  const existingReview = await reviewsRepository.findExistingReview(
    hubId,
    userId,
  );

  if (!existingReview) {
    throw new AppError("Review not found or you have not submitted a review yet.", 404);
  }

  return await reviewsRepository.updateCourseReview(hubId, userId, data);
};

export const deleteReview = async (
  userId: string,
  hubId: string,
) => {
  await verifyHubRole(userId, hubId, ["STUDENT", "CR", "TA"]);

  const existingReview = await reviewsRepository.findExistingReview(
    hubId,
    userId,
  );

  if (!existingReview) {
    throw new AppError("Review not found.", 404);
  }

  await reviewsRepository.deleteCourseReview(hubId, userId);
  return { success: true, message: "Review deleted successfully." };
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

  // Sanitize all reviews to be completely Anonymous for both teachers and peers
  const sanitizedReviews = reviews.map((review) => {
    return {
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      isAnonymous: true,
      answers: review.answers,
      createdAt: review.createdAt,
      studentId: undefined,
      student: {
        id: undefined,
        name: "Anonymous Student",
        email: undefined,
        image: null,
        studentProfile: null,
      },
    };
  });

  // Randomize reviews order (Fisher-Yates shuffle) so order is completely anonymous
  const shuffledReviews = [...sanitizedReviews];
  for (let i = shuffledReviews.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledReviews[i], shuffledReviews[j]] = [shuffledReviews[j], shuffledReviews[i]];
  }

  return {
    reviews: shuffledReviews,
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
          updatedAt: myReview.updatedAt,
        }
      : null,
  };
};

