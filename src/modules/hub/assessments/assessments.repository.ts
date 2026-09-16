import { prisma } from "../../../lib/prisma";
import {
  CreateAssessmentPayload,
  UpdateAssessmentPayload,
} from "./assessments.schema";

export const createAssessment = async (
  userId: string,
  hubId: string,
  data: CreateAssessmentPayload,
) => {
  return await prisma.assessment.create({
    data: {
      hubId,
      creatorId: userId,
      title: data.title,
      description: data.description,
      type: data.type,
      submissionType: data.submissionType,
      deadline: data.deadline,
      totalMarks: data.totalMarks,
    },
  });
};

export const findAssessmentsByHubId = async (hubId: string) => {
  return await prisma.assessment.findMany({
    where: { hubId },
    orderBy: { createdAt: "desc" },
    include: {
      submissions: {
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              studentProfile: true,
            },
          },
          gradedBy: {
            select: { id: true, name: true },
          },
        },
      },
      _count: {
        select: { submissions: true },
      },
    },
  });
};

export const findAssessmentById = async (assessmentId: string) => {
  return await prisma.assessment.findUnique({
    where: { id: assessmentId },
  });
};

export const findAssessmentSubmissions = async (assessmentId: string) => {
  return await prisma.submission.findMany({
    where: { assessmentId },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          studentProfile: true,
        },
      },
      gradedBy: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const upsertSubmission = async (
  assessmentId: string,
  studentId: string,
  submittedUrl: string,
) => {
  return await prisma.submission.upsert({
    where: { assessmentId_studentId: { assessmentId, studentId } },
    update: { submittedUrl },
    create: { assessmentId, studentId, submittedUrl },
  });
};

export const findSubmissionById = async (submissionId: string) => {
  return await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { assessment: true },
  });
};

export const updateSubmissionGrade = async (
  submissionId: string,
  marks: number,
  gradedById: string,
) => {
  return await prisma.submission.update({
    where: { id: submissionId },
    data: { marks, gradedById },
  });
};

export const bulkUpsertGrades = async (
  assessmentId: string,
  gradedById: string,
  grades: { studentId: string; marks: number }[],
) => {
  return await prisma.$transaction(
    grades.map((grade) =>
      prisma.submission.upsert({
        where: {
          assessmentId_studentId: { assessmentId, studentId: grade.studentId },
        },
        update: { marks: grade.marks, gradedById },
        create: {
          assessmentId,
          studentId: grade.studentId,
          marks: grade.marks,
          gradedById,
        },
      }),
    ),
  );
};

export const updateAssessment = async (
  assessmentId: string,
  data: UpdateAssessmentPayload,
) => {
  return await prisma.assessment.update({
    where: { id: assessmentId },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.submissionType !== undefined && {
        submissionType: data.submissionType,
      }),
      ...(data.deadline !== undefined && { deadline: data.deadline }),
      ...(data.totalMarks !== undefined && { totalMarks: data.totalMarks }),
    },
  });
};

export const deleteAssessment = async (assessmentId: string) => {
  return await prisma.assessment.delete({
    where: { id: assessmentId },
  });
};
