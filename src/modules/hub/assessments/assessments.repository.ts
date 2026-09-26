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
      status: data.status || "PUBLISHED",
      deadline: data.deadline,
      startDate: data.startDate,
      totalMarks: data.totalMarks,
      attachments: data.attachments ? (data.attachments as any) : undefined,
      links: data.links ? (data.links as any) : undefined,
    },
    include: {
      creator: { select: { id: true, name: true, image: true, role: true } },
    },
  });
};

export const findAssessmentsByHubId = async (
  hubId: string,
  filters?: { type?: string; status?: string },
) => {
  const where: any = { hubId };
  if (filters?.type && filters.type !== "ALL") {
    where.type = filters.type;
  }
  if (filters?.status && filters.status !== "ALL") {
    where.status = filters.status;
  }

  const items = await prisma.assessment.findMany({
    where,
    orderBy: { deadline: "asc" },
    include: {
      creator: { select: { id: true, name: true, image: true, role: true } },
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

  return items.map((item) => {
    const totalSubmissions = item.submissions.length;
    const gradedCount = item.submissions.filter(
      (s) => s.marks !== null && s.marks !== undefined,
    ).length;
    const pendingCount = totalSubmissions - gradedCount;

    return {
      ...item,
      submissionStats: {
        total: totalSubmissions,
        graded: gradedCount,
        pending: pendingCount,
      },
    };
  });
};

export const findAssessmentById = async (assessmentId: string) => {
  return await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      creator: { select: { id: true, name: true, image: true, role: true } },
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
    },
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
  payload: {
    submittedUrl?: string | null;
    content?: string | null;
    attachments?: any;
    links?: any;
    isLate?: boolean;
    status?: string;
  },
) => {
  return await prisma.submission.upsert({
    where: { assessmentId_studentId: { assessmentId, studentId } },
    update: {
      submittedUrl: payload.submittedUrl,
      content: payload.content,
      attachments: payload.attachments,
      links: payload.links,
      isLate: payload.isLate ?? false,
      status: payload.status ?? "SUBMITTED",
    },
    create: {
      assessmentId,
      studentId,
      submittedUrl: payload.submittedUrl,
      content: payload.content,
      attachments: payload.attachments,
      links: payload.links,
      isLate: payload.isLate ?? false,
      status: payload.status ?? "SUBMITTED",
    },
    include: {
      student: {
        select: { id: true, name: true, image: true, studentProfile: true },
      },
    },
  });
};

export const findSubmissionById = async (submissionId: string) => {
  return await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      assessment: true,
      student: {
        select: { id: true, name: true, email: true, image: true, studentProfile: true },
      },
      gradedBy: {
        select: { id: true, name: true },
      },
    },
  });
};

export const updateSubmissionGrade = async (
  submissionId: string,
  data: { marks: number; feedback?: string | null; gradedById: string },
) => {
  return await prisma.submission.update({
    where: { id: submissionId },
    data: {
      marks: data.marks,
      feedback: data.feedback,
      gradedById: data.gradedById,
      status: "GRADED",
    },
    include: {
      student: { select: { id: true, name: true, image: true } },
      gradedBy: { select: { id: true, name: true } },
    },
  });
};

export const bulkUpsertGrades = async (
  assessmentId: string,
  gradedById: string,
  grades: { studentId: string; marks: number; feedback?: string | null }[],
) => {
  return await prisma.$transaction(
    grades.map((grade) =>
      prisma.submission.upsert({
        where: {
          assessmentId_studentId: { assessmentId, studentId: grade.studentId },
        },
        update: {
          marks: grade.marks,
          feedback: grade.feedback,
          gradedById,
          status: "GRADED",
        },
        create: {
          assessmentId,
          studentId: grade.studentId,
          marks: grade.marks,
          feedback: grade.feedback,
          gradedById,
          status: "GRADED",
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
      ...(data.status !== undefined && { status: data.status }),
      ...(data.deadline !== undefined && { deadline: data.deadline }),
      ...(data.startDate !== undefined && { startDate: data.startDate }),
      ...(data.totalMarks !== undefined && { totalMarks: data.totalMarks }),
      ...(data.attachments !== undefined && {
        attachments: data.attachments as any,
      }),
      ...(data.links !== undefined && { links: data.links as any }),
    },
    include: {
      creator: { select: { id: true, name: true, image: true, role: true } },
    },
  });
};

export const deleteAssessment = async (assessmentId: string) => {
  return await prisma.assessment.delete({
    where: { id: assessmentId },
  });
};
