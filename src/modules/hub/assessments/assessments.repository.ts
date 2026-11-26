import { Prisma } from "../../../../generated/prisma/client";
import { AssessmentType } from "../../../constants/enums";
import { prisma } from "../../../lib/prisma";
import { AppError } from "../../../utils/AppError";
import { assertNoNewCloudinaryAttachments } from "../hub-attachments";
import {
  MAX_ASSESSMENT_SUBMISSIONS_LIST,
  MAX_HUB_ASSESSMENTS_LIST,
  isSubmissionGraded,
  resolveStudentSubmissionOutcome,
  validateAssessmentDateWindow,
} from "./assessments.domain";
import {
  BulkGradePayload,
  CreateAssessmentPayload,
  GradeSubmissionPayload,
  SubmitAssessmentPayload,
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

  if (studentIdForFilter) {
    const items = await prisma.assessment.findMany({
      where,
      orderBy: { deadline: "asc" },
      take: MAX_HUB_ASSESSMENTS_LIST,
      include: {
        creator: { select: { id: true, name: true, image: true, role: true } },
        submissions: {
          where: { studentId: studentIdForFilter },
          include: submissionInclude,
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
      const pendingCount = item.submissions.filter(
        (s) => s.marks === null || s.marks === undefined,
      ).length;

      return {
        ...item,
        submissionStats: {
          total: totalSubmissions,
          graded: gradedCount,
          pending: pendingCount,
        },
      };
    });
  }

  // Teacher/Admin list view: omit full submission rows to prevent N*500 hydration/OOM; aggregate graded counts via groupBy.
  const items = await prisma.assessment.findMany({
    where,
    orderBy: { deadline: "asc" },
    take: MAX_HUB_ASSESSMENTS_LIST,
    include: {
      creator: { select: { id: true, name: true, image: true, role: true } },
      _count: {
        select: { submissions: true },
      },
    },
  });

  const assessmentIds = items.map((item) => item.id);
  const gradedCounts =
    assessmentIds.length > 0
      ? await prisma.submission.groupBy({
          by: ["assessmentId"],
          where: {
            assessmentId: { in: assessmentIds },
            marks: { not: null },
          },
          _count: { _all: true },
        })
      : [];

  const gradedByAssessment = new Map(
    gradedCounts.map((entry) => [entry.assessmentId, entry._count._all]),
  );

  return items.map((item) => {
    const totalSubmissions = item._count.submissions;
    const gradedCount = gradedByAssessment.get(item.id) ?? 0;

    return {
      ...item,
      submissions: [],
      submissionStats: {
        total: totalSubmissions,
        graded: gradedCount,
        pending: Math.max(0, totalSubmissions - gradedCount),
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

type LockedAssessmentRow = {
  id: string;
  hubId: string;
  creatorId: string | null;
  title: string;
  status: string;
  submissionType: "ONLINE" | "HAND" | null;
  deadline: Date;
  startDate: Date | null;
  totalMarks: number;
  allowLateSubmission: boolean;
  attachments: Prisma.JsonValue | null;
  hubArchived: boolean;
};

async function lockAssessmentWithHub(
  tx: Prisma.TransactionClient,
  hubId: string,
  assessmentId: string,
  archivedMessage: string,
  notFoundMessage: string = "Assessment not found",
): Promise<LockedAssessmentRow> {
  const [locked] = await tx.$queryRaw<Array<LockedAssessmentRow>>`
    SELECT a.id, a."hubId", a."creatorId", a.title, a.status,
           a."submissionType"::text AS "submissionType",
           a.deadline, a."startDate", a."totalMarks", a."allowLateSubmission",
           a.attachments, h."isArchived" AS "hubArchived"
    FROM "Assessment" a
    INNER JOIN "CourseHub" h ON h.id = a."hubId"
    WHERE a.id = ${assessmentId}
    FOR UPDATE OF a
  `;

  if (!locked || locked.hubId !== hubId) {
    throw new AppError(notFoundMessage, 404);
  }
  if (locked.hubArchived) {
    throw new AppError(archivedMessage, 400);
  }
  return locked;
}

export const submitAssessmentAtomic = (
  hubId: string,
  assessmentId: string,
  studentId: string,
  payload: SubmitAssessmentPayload,
) =>
  prisma.$transaction(async (tx) => {
    const locked = await lockAssessmentWithHub(
      tx,
      hubId,
      assessmentId,
      "Archived Course Hubs are read-only and do not accept submissions.",
    );

    const previousSubmission = await tx.submission.findUnique({
      where: { assessmentId_studentId: { assessmentId, studentId } },
    });

    const outcome = resolveStudentSubmissionOutcome({
      assessmentStatus: locked.status,
      submissionType: locked.submissionType,
      deadline: new Date(locked.deadline),
      allowLateSubmission: locked.allowLateSubmission,
      previousSubmission,
      requestedStatus: payload.status,
    });

    if (!outcome.ok) {
      throw new AppError(outcome.message, 400);
    }

    if (outcome.status !== "HAND_SUBMISSION") {
      const hasSubmittedUrl = Boolean(payload.submittedUrl?.trim());
      const hasContent = Boolean(payload.content?.trim());
      const hasAttachments =
        Array.isArray(payload.attachments) && payload.attachments.length > 0;
      const hasLinks = Array.isArray(payload.links) && payload.links.length > 0;

      if (!hasSubmittedUrl && !hasContent && !hasAttachments && !hasLinks) {
        throw new AppError(
          "Please attach a file, link, or note before submitting.",
          400,
        );
      }
    }

    assertNoNewCloudinaryAttachments(
      payload.attachments,
      previousSubmission?.attachments as { url?: string }[] | null,
    );

    const attachmentsValue =
      payload.attachments === undefined
        ? undefined
        : payload.attachments === null
          ? Prisma.JsonNull
          : (payload.attachments as Prisma.InputJsonValue);
    const linksValue =
      payload.links === undefined
        ? undefined
        : payload.links === null
          ? Prisma.JsonNull
          : (payload.links as Prisma.InputJsonValue);

    return tx.submission.upsert({
      where: { assessmentId_studentId: { assessmentId, studentId } },
      update: {
        submittedUrl: payload.submittedUrl || null,
        content: payload.content || null,
        attachments: attachmentsValue ?? Prisma.JsonNull,
        links: linksValue ?? Prisma.JsonNull,
        isLate: outcome.isLate,
        status: outcome.status,
      },
      create: {
        assessmentId,
        studentId,
        submittedUrl: payload.submittedUrl || null,
        content: payload.content || null,
        attachments: attachmentsValue ?? Prisma.JsonNull,
        links: linksValue ?? Prisma.JsonNull,
        isLate: outcome.isLate,
        status: outcome.status,
      },
      include: {
        student: {
          select: { id: true, name: true, image: true, studentProfile: true },
        },
      },
    });
  });

export const unsubmitAssessmentAtomic = (
  hubId: string,
  assessmentId: string,
  studentId: string,
) =>
  prisma.$transaction(async (tx) => {
    const locked = await lockAssessmentWithHub(
      tx,
      hubId,
      assessmentId,
      "Archived Course Hubs are read-only and submissions cannot be modified.",
    );

    if (locked.status !== "PUBLISHED") {
      throw new AppError("This assessment is no longer open for changes.", 400);
    }
    if (locked.submissionType === "HAND") {
      throw new AppError("Only online coursework can be unsubmitted.", 400);
    }
    const isOverdue = Date.now() >= new Date(locked.deadline).getTime();
    if (isOverdue && !locked.allowLateSubmission) {
      throw new AppError(
        "Coursework can only be unsubmitted before its deadline.",
        400,
      );
    }

    const submission = await tx.submission.findUnique({
      where: { assessmentId_studentId: { assessmentId, studentId } },
    });
    if (
      !submission ||
      ![
        "SUBMITTED",
        "LATE",
        "HAND_SUBMISSION",
        "LATE_HAND_SUBMISSION",
      ].includes(submission.status)
    ) {
      throw new AppError(
        "No submitted coursework is available to unsubmit.",
        400,
      );
    }
    if (isSubmissionGraded(submission)) {
      throw new AppError("Graded coursework cannot be unsubmitted.", 400);
    }

    const updatedRows = await tx.submission.updateMany({
      where: {
        assessmentId,
        studentId,
        marks: null,
        status: {
          in: ["SUBMITTED", "LATE", "HAND_SUBMISSION", "LATE_HAND_SUBMISSION"],
        },
      },
      data: { status: "UNSUBMITTED", isLate: false },
    });

    if (updatedRows.count === 0) {
      throw new AppError(
        "Coursework cannot be unsubmitted after it has been graded.",
        400,
      );
    }

    return tx.submission.findUniqueOrThrow({
      where: { assessmentId_studentId: { assessmentId, studentId } },
    });
  });

export const gradeSubmissionAtomic = (
  graderUserId: string,
  hubId: string,
  submissionId: string,
  data: GradeSubmissionPayload,
) =>
  prisma.$transaction(async (tx) => {
    const initialSub = await tx.submission.findUnique({
      where: { id: submissionId },
      select: { id: true, assessmentId: true, studentId: true },
    });

    const targetAssessmentId = initialSub
      ? initialSub.assessmentId
      : data.assessmentId;
    const targetStudentId = initialSub
      ? initialSub.studentId
      : data.studentId || submissionId;

    if (!targetAssessmentId || !targetStudentId) {
      throw new AppError("Submission not found", 404);
    }

    const locked = await lockAssessmentWithHub(
      tx,
      hubId,
      targetAssessmentId,
      "Archived Course Hubs are read-only and grades cannot be modified.",
      initialSub ? "Submission not found" : "Assessment not found",
    );

    if (data.marks < 0) {
      throw new AppError("Marks cannot be negative", 400);
    }
    if (data.marks > locked.totalMarks) {
      throw new AppError(
        `Marks (${data.marks}) cannot exceed the maximum allowed marks (${locked.totalMarks})`,
        400,
      );
    }

    if (!initialSub) {
      const validMember = await tx.hubMember.findFirst({
        where: {
          hubId,
          userId: targetStudentId,
          isActive: true,
          role: { in: ["STUDENT", "CR"] },
        },
        select: { userId: true },
      });
      if (!validMember) {
        throw new AppError(
          "Student is not an active student in this course hub",
          403,
        );
      }

      const gradedSubmission = await tx.submission.upsert({
        where: {
          assessmentId_studentId: {
            assessmentId: targetAssessmentId,
            studentId: targetStudentId,
          },
        },
        update: {
          marks: data.marks,
          feedback: data.feedback,
          gradedById: graderUserId,
          status: "GRADED",
        },
        create: {
          assessmentId: targetAssessmentId,
          studentId: targetStudentId,
          marks: data.marks,
          feedback: data.feedback,
          gradedById: graderUserId,
          status: "GRADED",
        },
        include: {
          student: { select: { id: true, name: true, image: true } },
          gradedBy: { select: { id: true, name: true } },
        },
      });

      return {
        gradedSubmission,
        gradeChanged: true,
        isNewGrade: true,
        studentId: targetStudentId,
        assessmentId: locked.id,
        assessmentTitle: locked.title,
      };
    }

    const freshSub = await tx.submission.findUnique({
      where: { id: initialSub.id },
      select: { id: true, studentId: true, marks: true, feedback: true },
    });
    if (!freshSub) {
      throw new AppError("Submission not found", 404);
    }

    const feedbackAfterSave =
      data.feedback === undefined ? freshSub.feedback : data.feedback;
    const gradeChanged =
      freshSub.marks !== data.marks ||
      (freshSub.feedback ?? null) !== (feedbackAfterSave ?? null);

    const gradedSubmission = await tx.submission.update({
      where: { id: freshSub.id },
      data: {
        marks: data.marks,
        feedback: data.feedback,
        gradedById: graderUserId,
        status: "GRADED",
      },
      include: {
        student: { select: { id: true, name: true, image: true } },
        gradedBy: { select: { id: true, name: true } },
      },
    });

    return {
      gradedSubmission,
      gradeChanged,
      isNewGrade: freshSub.marks === null,
      studentId: freshSub.studentId,
      assessmentId: locked.id,
      assessmentTitle: locked.title,
    };
  });

export const bulkUpsertGradesAtomic = (
  hubId: string,
  assessmentId: string,
  gradedById: string,
  grades: BulkGradePayload,
) =>
  prisma.$transaction(async (tx) => {
    const locked = await lockAssessmentWithHub(
      tx,
      hubId,
      assessmentId,
      "Archived Course Hubs are read-only and grades cannot be modified.",
    );

    const uniqueStudentIds = Array.from(
      new Set(grades.map((grade) => grade.studentId)),
    );
    if (uniqueStudentIds.length !== grades.length) {
      throw new AppError(
        "A student can only appear once in a bulk grade request",
        400,
      );
    }

    const activeMembers = await tx.hubMember.findMany({
      where: {
        hubId,
        userId: { in: uniqueStudentIds },
        isActive: true,
        role: { in: ["STUDENT", "CR"] },
      },
      select: { userId: true },
    });
    const activeSet = new Set(activeMembers.map((m) => m.userId));
    const invalidStudentId = grades.find(
      (grade) => !activeSet.has(grade.studentId),
    )?.studentId;
    if (invalidStudentId) {
      throw new AppError(
        `Student ${invalidStudentId} is not an active student in this course hub`,
        403,
      );
    }

    for (const grade of grades) {
      if (grade.marks < 0) {
        throw new AppError(
          `Marks for student ${grade.studentId} cannot be negative`,
          400,
        );
      }
      if (grade.marks > locked.totalMarks) {
        throw new AppError(
          `Marks for student ${grade.studentId} (${grade.marks}) exceed maximum marks (${locked.totalMarks})`,
          400,
        );
      }
    }

    const previousSnapshots = await tx.submission.findMany({
      where: { assessmentId },
      select: {
        id: true,
        studentId: true,
        marks: true,
        feedback: true,
      },
    });

    const savedGrades = await Promise.all(
      grades.map((grade) =>
        tx.submission.upsert({
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

    return {
      assessmentTitle: locked.title,
      assessmentId: locked.id,
      previousSnapshots,
      savedGrades,
    };
  });

export const updateAssessmentAtomic = (
  hubId: string,
  assessmentId: string,
  data: UpdateAssessmentPayload,
) =>
  prisma.$transaction(async (tx) => {
    const locked = await lockAssessmentWithHub(
      tx,
      hubId,
      assessmentId,
      "Archived Course Hubs are read-only and coursework cannot be edited.",
    );

    const effectiveStart =
      data.startDate !== undefined ? data.startDate : locked.startDate;
    const effectiveDeadline =
      data.deadline !== undefined ? data.deadline : locked.deadline;
    if (!validateAssessmentDateWindow(effectiveStart, effectiveDeadline)) {
      throw new AppError("Start date must be on or before the deadline.", 400);
    }

    if (data.totalMarks !== undefined && data.totalMarks < locked.totalMarks) {
      const aggregate = await tx.submission.aggregate({
        where: { assessmentId, marks: { not: null } },
        _max: { marks: true },
      });
      const maxGradedMarks = aggregate._max.marks ?? null;
      if (maxGradedMarks !== null && data.totalMarks < maxGradedMarks) {
        throw new AppError(
          `Total marks cannot be lowered below the highest existing grade (${maxGradedMarks}).`,
          400,
        );
      }
    }

    assertNoNewCloudinaryAttachments(
      data.attachments,
      locked.attachments as { url?: string }[] | null,
    );

    return tx.assessment.update({
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
  });

export const deleteAssessment = (assessmentId: string) =>
  prisma.assessment.delete({
    where: { id: assessmentId },
  });
