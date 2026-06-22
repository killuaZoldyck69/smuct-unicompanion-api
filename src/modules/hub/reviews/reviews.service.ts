import { prisma } from "../../../lib/prisma";
import { verifyHubRole } from "../hub.service";
import { AppError } from "../../../utils/AppError";

export const updateReviewSettings = async (
  userId: string,
  hubId: string,
  data: any,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "TA"]);
  return await prisma.courseHub.update({
    where: { id: hubId },
    data: {
      isReviewOpen: data.isReviewOpen,
      reviewQuestions: data.reviewQuestions,
    },
  });
};

export const submitReview = async (
  userId: string,
  hubId: string,
  data: any,
) => {
  // 👈 FIX: Added role verification for reviews
  await verifyHubRole(userId, hubId, ["STUDENT", "CR", "TA"]);

  const hub = await prisma.courseHub.findUnique({ where: { id: hubId } });

  // Checking either flag based on your schema migration
  if (!hub || (!hub.isReviewOpen && !hub.isReviewOpen)) {
    throw new AppError(
      "Review submission is currently closed for this hub.",
      403,
    );
  }

  const existingReview = await prisma.courseReview.findUnique({
    where: { hubId_studentId: { hubId, studentId: userId } },
  });

  if (existingReview) {
    throw new AppError(
      "You have already submitted a review for this course.",
      409,
    );
  }

  return await prisma.courseReview.create({
    data: { hubId, studentId: userId, ...data },
  });
};

export const getReviews = async (hubId: string) => {
  const reviews = await prisma.courseReview.findMany({
    where: { hubId },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          image: true,
          email: true,
          studentProfile: { select: { studentId: true } }, // 👈 ADDED THIS
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

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
          studentProfile: null, // 👈 ADDED THIS
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
