import { prisma } from "../../../lib/prisma";
import { SubmitReviewPayload, UpdateReviewSettingsPayload } from "./reviews.schema";

export const updateHubReviewSettings = async (
  hubId: string,
  data: UpdateReviewSettingsPayload,
) => {
  return await prisma.courseHub.update({
    where: { id: hubId },
    data: {
      isReviewOpen: data.isReviewOpen,
      reviewQuestions: data.reviewQuestions,
    },
  });
};

export const findHubById = async (hubId: string) => {
  return await prisma.courseHub.findUnique({
    where: { id: hubId },
  });
};

export const findExistingReview = async (
  hubId: string,
  studentId: string,
) => {
  return await prisma.courseReview.findUnique({
    where: { hubId_studentId: { hubId, studentId } },
  });
};

export const createCourseReview = async (
  hubId: string,
  studentId: string,
  data: SubmitReviewPayload,
) => {
  return await prisma.courseReview.create({
    data: {
      hubId,
      studentId,
      rating: data.rating,
      comment: data.comment,
      isAnonymous: data.isAnonymous,
      answers: data.answers,
    },
  });
};

export const findReviewsByHubId = async (hubId: string) => {
  return await prisma.courseReview.findMany({
    where: { hubId },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          image: true,
          email: true,
          studentProfile: { select: { studentId: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};
