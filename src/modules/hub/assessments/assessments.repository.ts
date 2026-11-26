import { Prisma } from "../../../../generated/prisma/client";
import { AssessmentType } from "../../../constants/enums";
import { prisma } from "../../../lib/prisma";
import {
  MAX_ASSESSMENT_SUBMISSIONS_LIST,
  MAX_HUB_ASSESSMENTS_LIST,
} from "./assessments.domain";
import {
  CreateAssessmentPayload,
  UpdateAssessmentPayload,
} from "./assessments.schema";

const submissionInclude = {
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
} satisfies Prisma.SubmissionInclude;

export const createAssessment = (
  userId: string,
  hubId: string,
  data: CreateAssessmentPayload,
) =>
  prisma.assessment.create({
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
      allowLateSubmission: data.allowLateSubmission ?? false,
      attachments:
        data.attachments !== undefined
          ? data.attachments === null
            ? Prisma.JsonNull
            : (data.attachments as Prisma.InputJsonValue)
          : undefined,
      links:
        data.links !== undefined
          ? data.links === null
            ? Prisma.JsonNull
            : (data.links as Prisma.InputJsonValue)
          : undefined,
    },
    include: {
      creator: { select: { id: true, name: true, image: true, role: true } },
    },
  });

export const findAssessmentsByHubId = async (
  hubId: string,
  filters?: { type?: string; status?: string },
  studentIdForFilter?: string | null,
) => {
  const where: Prisma.AssessmentWhereInput = { hubId };
  if (filters?.type) {
    where.type = filters.type as AssessmentType;
  }
  if (filters?.status) {
    where.status = filters.status;
  }

  const items = await prisma.assessment.findMany({
    where,
    orderBy: { deadline: "asc" },
    take: MAX_HUB_ASSESSMENTS_LIST,
    include: {
      creator: { select: { id: true, name: true, image: true, role: true } },
      submissions: studentIdForFilter
        ? {
            where: { studentId: studentIdForFilter },
            include: submissionInclude,
          }
        : {
            include: submissionInclude,
            take: MAX_ASSESSMENT_SUBMISSIONS_LIST,
          },
      _count: {
        select: { submissions: true },
      },
    },
  });

  return items.map((item) => {
    const totalSubmissions = item._count.submissions;
    const gradedCount = item.submissions.filter(
      (s) => s.marks !== null && s.marks !== undefined,
    ).length;
    const pendingCount = studentIdForFilter
      ? item.submissions.filter(
          (s) => s.marks === null || s.marks === undefined,
        ).length
      : Math.max(0, totalSubmissions - gradedCount);

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

export const findAssessmentMetaById = (assessmentId: string) =>
  prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: {
      id: true,
      hubId: true,
      creatorId: true,
      title: true,
      status: true,
      submissionType: true,
      deadline: true,
      startDate: true,
      totalMarks: true,
      allowLateSubmission: true,
      attachments: true,
    },
  });

export const findAssessmentById = (
  assessmentId: string,
  studentIdForFilter?: string | null,
) =>
  prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      creator: { select: { id: true, name: true, image: true, role: true } },
      submissions: studentIdForFilter
        ? {
            where: { studentId: studentIdForFilter },
            include: submissionInclude,
          }
        : {
            include: submissionInclude,
            take: MAX_ASSESSMENT_SUBMISSIONS_LIST,
          },
      _count: {
        select: { submissions: true },
      },
    },
  });

export const findMaxGradedMarksForAssessment = async (
  assessmentId: string,
): Promise<number | null> => {
  const aggregate = await prisma.submission.aggregate({
    where: { assessmentId, marks: { not: null } },
    _max: { marks: true },
  });
  return aggregate._max.marks ?? null;
};

export const findSubmissionSnapshotsForAssessment = (assessmentId: string) =>
  prisma.submission.findMany({
    where: { assessmentId },
    select: {
      id: true,
      studentId: true,
      marks: true,
      feedback: true,
    },
  });

export const findActiveHubStudentIds = async (
  hubId: string,
  studentIds: string[],
) => {
  const members = await prisma.hubMember.findMany({
    where: {
      hubId,
      userId: { in: studentIds },
      isActive: true,
      role: { in: ["STUDENT", "CR"] },
    },
    select: { userId: true },
  });
  return new Set(members.map((member) => member.userId));
};

export const findAssessmentSubmissions = (assessmentId: string) =>
  prisma.submission.findMany({
    where: { assessmentId },
    include: submissionInclude,
    orderBy: { createdAt: "desc" },
    take: MAX_ASSESSMENT_SUBMISSIONS_LIST,
  });

export const upsertSubmission = (
  assessmentId: string,
  studentId: string,
  payload: {
    submittedUrl?: string | null;
    content?: string | null;
    attachments?: Prisma.InputJsonValue | typeof Prisma.JsonNull | null;
    links?: Prisma.InputJsonValue | typeof Prisma.JsonNull | null;
    isLate?: boolean;
    status?: string;
  },
) => {
  const attachmentsValue =
    payload.attachments === undefined
      ? undefined
      : payload.attachments === null
        ? Prisma.JsonNull
        : payload.attachments;
  const linksValue =
    payload.links === undefined
      ? undefined
      : payload.links === null
        ? Prisma.JsonNull
        : payload.links;

  return prisma.submission.upsert({
    where: { assessmentId_studentId: { assessmentId, studentId } },
    update: {
      submittedUrl: payload.submittedUrl ?? null,
      content: payload.content ?? null,
      attachments: attachmentsValue ?? Prisma.JsonNull,
      links: linksValue ?? Prisma.JsonNull,
      isLate: payload.isLate ?? false,
      status: payload.status ?? "SUBMITTED",
    },
    create: {
      assessmentId,
      studentId,
      submittedUrl: payload.submittedUrl ?? null,
      content: payload.content ?? null,
      attachments: attachmentsValue ?? Prisma.JsonNull,
      links: linksValue ?? Prisma.JsonNull,
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

export const upsertOfflineOrMissingSubmissionGrade = (
  assessmentId: string,
  studentId: string,
  data: { marks: number; feedback?: string | null; gradedById: string },
) =>
  prisma.submission.upsert({
    where: { assessmentId_studentId: { assessmentId, studentId } },
    update: {
      marks: data.marks,
      feedback: data.feedback,
      gradedById: data.gradedById,
      status: "GRADED",
    },
    create: {
      assessmentId,
      studentId,
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

export const findSubmissionById = (submissionId: string) =>
  prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      assessment: true,
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
  });

export const findStudentSubmission = (
  assessmentId: string,
  studentId: string,
) =>
  prisma.submission.findUnique({
    where: { assessmentId_studentId: { assessmentId, studentId } },
  });

export const markSubmissionUnsubmitted = (submissionId: string) =>
  prisma.submission.update({
    where: { id: submissionId },
    data: { status: "UNSUBMITTED", isLate: false },
  });

export const updateSubmissionGrade = (
  submissionId: string,
  data: { marks: number; feedback?: string | null; gradedById: string },
) =>
  prisma.submission.update({
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

export const bulkUpsertGrades = (
  assessmentId: string,
  gradedById: string,
  grades: { studentId: string; marks: number; feedback?: string | null }[],
) =>
  prisma.$transaction(
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

export const updateAssessment = (
  assessmentId: string,
  data: UpdateAssessmentPayload,
) =>
  prisma.assessment.update({
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
      ...(data.allowLateSubmission !== undefined && {
        allowLateSubmission: data.allowLateSubmission,
      }),
      ...(data.attachments !== undefined && {
        attachments:
          data.attachments === null
            ? Prisma.JsonNull
            : (data.attachments as Prisma.InputJsonValue),
      }),
      ...(data.links !== undefined && {
        links:
          data.links === null
            ? Prisma.JsonNull
            : (data.links as Prisma.InputJsonValue),
      }),
    },
    include: {
      creator: { select: { id: true, name: true, image: true, role: true } },
    },
  });

export const deleteAssessment = (assessmentId: string) =>
  prisma.assessment.delete({
    where: { id: assessmentId },
  });
