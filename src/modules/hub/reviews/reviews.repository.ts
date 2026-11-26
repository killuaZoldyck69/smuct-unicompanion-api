import { Prisma } from "../../../../generated/prisma/client";
import { prisma } from "../../../lib/prisma";
import { MAX_HUB_REVIEWS_LIST } from "./reviews.domain";

export const updateHubReviewSettings = (
  hubId: string,
  data: { isReviewOpen: boolean; reviewQuestions: string[] },
) =>
  prisma.courseHub.update({
    where: { id: hubId },
    data: {
      isReviewOpen: data.isReviewOpen,
      reviewQuestions: data.reviewQuestions,
    },
    select: {
      id: true,
      isReviewOpen: true,
      reviewQuestions: true,
      isArchived: true,
    },
  });

export const findHubById = (hubId: string) =>
  prisma.courseHub.findUnique({
    where: { id: hubId },
    select: {
      id: true,
      isReviewOpen: true,
      reviewQuestions: true,
      isArchived: true,
    },
  });

export const findExistingReview = (hubId: string, studentId: string) =>
  prisma.courseReview.findUnique({
    where: { hubId_studentId: { hubId, studentId } },
    select: {
      id: true,
      rating: true,
      comment: true,
      isAnonymous: true,
      answers: true,
      createdAt: true,
      updatedAt: true,
    },
  });

export const createCourseReview = (
  hubId: string,
  studentId: string,
  data: {
    rating: number;
    comment: string | null;
    answers: Record<string, string> | null;
  },
) =>
  prisma.courseReview.create({
    data: {
      hubId,
      studentId,
      rating: data.rating,
      comment: data.comment,
      isAnonymous: true,
      answers: data.answers === null ? Prisma.JsonNull : (data.answers as Prisma.InputJsonValue),
    },
    select: {
      id: true,
      rating: true,
      comment: true,
      isAnonymous: true,
      answers: true,
      createdAt: true,
      updatedAt: true,
    },
  });

export const updateCourseReview = (
  hubId: string,
  studentId: string,
  data: {
    rating?: number;
    comment?: string | null;
    answers?: Record<string, string> | null;
  },
) =>
  prisma.courseReview.update({
    where: { hubId_studentId: { hubId, studentId } },
    data: {
      ...(data.rating !== undefined ? { rating: data.rating } : {}),
      ...(data.comment !== undefined ? { comment: data.comment } : {}),
      ...(data.answers !== undefined
        ? {
            answers:
              data.answers === null
                ? Prisma.JsonNull
                : (data.answers as Prisma.InputJsonValue),
          }
        : {}),
      isAnonymous: true,
    },
    select: {
      id: true,
      rating: true,
      comment: true,
      isAnonymous: true,
      answers: true,
      createdAt: true,
      updatedAt: true,
    },
  });

export const deleteCourseReview = (hubId: string, studentId: string) =>
  prisma.courseReview.delete({
    where: { hubId_studentId: { hubId, studentId } },
  });

// Strictly omit student/author PII so identity never leaves Postgres on public review reads.
export const findReviewsByHubId = (hubId: string) =>
  prisma.courseReview.findMany({
    where: { hubId },
    select: {
      id: true,
      rating: true,
      comment: true,
      isAnonymous: true,
      answers: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: MAX_HUB_REVIEWS_LIST,
  });
