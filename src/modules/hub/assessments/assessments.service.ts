import { Prisma } from "../../../../generated/prisma/client";
import { AppError } from "../../../utils/AppError";
import {
  createCourseNotificationsForRecipients,
  createHubNotifications,
} from "../../notification/notification.service";
import { assertNoNewCloudinaryAttachments } from "../hub-attachments";
import {
  assertActiveHub,
  invalidateHubCaches,
  verifyHubRole,
} from "../hub.service";
import {
  canRoleManageAssessment,
  isSubmissionGraded,
  resolveStudentSubmissionOutcome,
  validateAssessmentDateWindow,
} from "./assessments.domain";
import * as assessmentsRepository from "./assessments.repository";
import {
  BulkGradePayload,
  CreateAssessmentPayload,
  GradeSubmissionPayload,
  SubmitAssessmentPayload,
  UpdateAssessmentPayload,
} from "./assessments.schema";

export const createAssessment = async (
  userId: string,
  hubId: string,
  data: CreateAssessmentPayload,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR"]);
  await assertActiveHub(
    hubId,
    "Archived Course Hubs are read-only and cannot create new coursework.",
  );

  if (!validateAssessmentDateWindow(data.startDate, data.deadline)) {
    throw new AppError("Start date must be on or before the deadline.", 400);
  }

  assertNoNewCloudinaryAttachments(data.attachments);
  const assessment = await assessmentsRepository.createAssessment(
    userId,
    hubId,
    data,
  );
  invalidateHubCaches(hubId);

  await createHubNotifications(hubId, userId, {
    type: "ASSESSMENT",
    title: "New coursework posted",
    body: assessment.title,
    route: `/hub/${hubId}?tab=classwork&assessmentId=${assessment.id}&fromNotification=true`,
    dedupeKey: `assessment:${assessment.id}`,
  });
  return assessment;
};

export const getAssessments = async (
  userId: string,
  hubId: string,
  filters?: { type?: string; status?: string },
) => {
  const member = await verifyHubRole(userId, hubId, [
    "TEACHER",
    "CR",
    "STUDENT",
    "ADMIN",
  ]);
  const isTeacherOrAdmin =
    member.role === "TEACHER" || member.role === "ADMIN";
  const studentIdForFilter = isTeacherOrAdmin ? null : userId;

  return assessmentsRepository.findAssessmentsByHubId(
    hubId,
    filters,
    studentIdForFilter,
  );
};

export const getAssessmentById = async (
  userId: string,
  hubId: string,
  assessmentId: string,
) => {
  const meta = await assessmentsRepository.findAssessmentMetaById(assessmentId);
  if (!meta || meta.hubId !== hubId) {
    throw new AppError("Assessment not found", 404);
  }

  const member = await verifyHubRole(userId, hubId, [
    "TEACHER",
    "CR",
    "STUDENT",
    "ADMIN",
  ]);
  const isTeacherOrAdmin =
    member.role === "TEACHER" || member.role === "ADMIN";
  const studentIdForFilter = isTeacherOrAdmin ? null : userId;

  const assessment = await assessmentsRepository.findAssessmentById(
    assessmentId,
    studentIdForFilter,
  );
  if (!assessment) throw new AppError("Assessment not found", 404);
  return assessment;
};

export const getAssessmentSubmissions = async (
  userId: string,
  hubId: string,
  assessmentId: string,
) => {
  const meta = await assessmentsRepository.findAssessmentMetaById(assessmentId);
  if (!meta || meta.hubId !== hubId) {
    throw new AppError("Assessment not found", 404);
  }

  await verifyHubRole(userId, hubId, ["TEACHER", "ADMIN"]);

  return assessmentsRepository.findAssessmentSubmissions(assessmentId);
};

export const submitAssessment = async (
  userId: string,
  hubId: string,
  assessmentId: string,
  payload: SubmitAssessmentPayload,
) => {
  const meta = await assessmentsRepository.findAssessmentMetaById(assessmentId);
  if (!meta || meta.hubId !== hubId) {
    throw new AppError("Assessment not found", 404);
  }

  await verifyHubRole(userId, hubId, ["STUDENT", "CR"]);
  await assertActiveHub(
    hubId,
    "Archived Course Hubs are read-only and do not accept submissions.",
  );

  const previousSubmission = await assessmentsRepository.findStudentSubmission(
    assessmentId,
    userId,
  );

  const outcome = resolveStudentSubmissionOutcome({
    assessmentStatus: meta.status,
    submissionType: meta.submissionType,
    deadline: new Date(meta.deadline),
    allowLateSubmission: meta.allowLateSubmission,
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

  const submission = await assessmentsRepository.upsertSubmission(
    assessmentId,
    userId,
    {
      submittedUrl: payload.submittedUrl || null,
      content: payload.content || null,
      attachments: (payload.attachments ?? null) as
        | Prisma.InputJsonValue
        | null,
      links: (payload.links ?? null) as Prisma.InputJsonValue | null,
      isLate: outcome.isLate,
      status: outcome.status,
    },
  );
  invalidateHubCaches(hubId);
  return submission;
};

export const unsubmitAssessment = async (
  userId: string,
  hubId: string,
  assessmentId: string,
) => {
  const meta = await assessmentsRepository.findAssessmentMetaById(assessmentId);
  if (!meta || meta.hubId !== hubId) {
    throw new AppError("Assessment not found", 404);
  }

  await verifyHubRole(userId, hubId, ["STUDENT", "CR"]);
  await assertActiveHub(
    hubId,
    "Archived Course Hubs are read-only and submissions cannot be modified.",
  );

  if (meta.status !== "PUBLISHED") {
    throw new AppError("This assessment is no longer open for changes.", 400);
  }
  if (meta.submissionType === "HAND") {
    throw new AppError("Only online coursework can be unsubmitted.", 400);
  }
  const isOverdue = Date.now() >= new Date(meta.deadline).getTime();
  if (isOverdue && !meta.allowLateSubmission) {
    throw new AppError(
      "Coursework can only be unsubmitted before its deadline.",
      400,
    );
  }

  const submission = await assessmentsRepository.findStudentSubmission(
    assessmentId,
    userId,
  );
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

  const updated = await assessmentsRepository.markSubmissionUnsubmitted(
    submission.id,
  );
  invalidateHubCaches(hubId);
  return updated;
};

export const gradeSubmission = async (
  userId: string,
  hubId: string,
  submissionId: string,
  data: GradeSubmissionPayload,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER"]);
  await assertActiveHub(
    hubId,
    "Archived Course Hubs are read-only and grades cannot be modified.",
  );

  const submission = await assessmentsRepository.findSubmissionById(submissionId);

  if (!submission) {
    const targetAssessmentId = data.assessmentId;
    const targetStudentId = data.studentId || submissionId;
    if (!targetAssessmentId || !targetStudentId) {
      throw new AppError("Submission not found", 404);
    }

    const meta = await assessmentsRepository.findAssessmentMetaById(
      targetAssessmentId,
    );
    if (!meta || meta.hubId !== hubId) {
      throw new AppError("Assessment not found", 404);
    }

    const validStudentIds = await assessmentsRepository.findActiveHubStudentIds(
      hubId,
      [targetStudentId],
    );
    if (!validStudentIds.has(targetStudentId)) {
      throw new AppError(
        "Student is not an active student in this course hub",
        403,
      );
    }

    if (data.marks < 0) {
      throw new AppError("Marks cannot be negative", 400);
    }
    if (data.marks > meta.totalMarks) {
      throw new AppError(
        `Marks (${data.marks}) cannot exceed the maximum allowed marks (${meta.totalMarks})`,
        400,
      );
    }

    const gradedSubmission =
      await assessmentsRepository.upsertOfflineOrMissingSubmissionGrade(
        targetAssessmentId,
        targetStudentId,
        {
          marks: data.marks,
          feedback: data.feedback,
          gradedById: userId,
        },
      );
    invalidateHubCaches(hubId);

    await createCourseNotificationsForRecipients(hubId, [
      {
        userId: targetStudentId,
        type: "GRADE",
        title: "Grade posted",
        body: `Your grade for ${meta.title} is available.`,
        route: `/hub/${hubId}?tab=classwork&assessmentId=${meta.id}&fromNotification=true`,
        dedupeKey: `assessment-grade:${gradedSubmission.id}:${gradedSubmission.updatedAt.toISOString()}`,
      },
    ]);
    return gradedSubmission;
  }

  if (submission.assessment.hubId !== hubId) {
    throw new AppError("Submission not found", 404);
  }

  if (data.marks < 0) {
    throw new AppError("Marks cannot be negative", 400);
  }
  if (data.marks > submission.assessment.totalMarks) {
    throw new AppError(
      `Marks (${data.marks}) cannot exceed the maximum allowed marks (${submission.assessment.totalMarks})`,
      400,
    );
  }

  const feedbackAfterSave =
    data.feedback === undefined ? submission.feedback : data.feedback;
  const gradeChanged =
    submission.marks !== data.marks ||
    (submission.feedback ?? null) !== (feedbackAfterSave ?? null);

  const gradedSubmission = await assessmentsRepository.updateSubmissionGrade(
    submissionId,
    {
      marks: data.marks,
      feedback: data.feedback,
      gradedById: userId,
    },
  );
  invalidateHubCaches(hubId);

  if (gradeChanged) {
    await createCourseNotificationsForRecipients(hubId, [
      {
        userId: submission.studentId,
        type: "GRADE",
        title: submission.marks === null ? "Grade posted" : "Grade updated",
        body: `Your grade for ${submission.assessment.title} is available.`,
        route: `/hub/${hubId}?tab=classwork&assessmentId=${submission.assessment.id}&fromNotification=true`,
        dedupeKey: `assessment-grade:${gradedSubmission.id}:${gradedSubmission.updatedAt.toISOString()}`,
      },
    ]);
  }
  return gradedSubmission;
};

export const bulkGrade = async (
  userId: string,
  hubId: string,
  assessmentId: string,
  grades: BulkGradePayload,
) => {
  const meta = await assessmentsRepository.findAssessmentMetaById(assessmentId);
  if (!meta || meta.hubId !== hubId) {
    throw new AppError("Assessment not found", 404);
  }

  await verifyHubRole(userId, hubId, ["TEACHER"]);
  await assertActiveHub(
    hubId,
    "Archived Course Hubs are read-only and grades cannot be modified.",
  );

  const uniqueStudentIds = new Set(grades.map((grade) => grade.studentId));
  if (uniqueStudentIds.size !== grades.length) {
    throw new AppError(
      "A student can only appear once in a bulk grade request",
      400,
    );
  }

  const activeHubStudentIds =
    await assessmentsRepository.findActiveHubStudentIds(hubId, [
      ...uniqueStudentIds,
    ]);
  const invalidStudentId = grades.find(
    (grade) => !activeHubStudentIds.has(grade.studentId),
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
    if (grade.marks > meta.totalMarks) {
      throw new AppError(
        `Marks for student ${grade.studentId} (${grade.marks}) exceed maximum marks (${meta.totalMarks})`,
        400,
      );
    }
  }

  const previousSnapshots =
    await assessmentsRepository.findSubmissionSnapshotsForAssessment(
      assessmentId,
    );
  const previousSubmissionsByStudent = new Map(
    previousSnapshots.map((submission) => [submission.studentId, submission]),
  );

  const changedStudentIds = new Set(
    grades
      .filter((grade) => {
        const previous = previousSubmissionsByStudent.get(grade.studentId);
        if (!previous) return true;

        const feedbackAfterSave =
          grade.feedback === undefined ? previous.feedback : grade.feedback;
        return (
          previous.marks !== grade.marks ||
          (previous.feedback ?? null) !== (feedbackAfterSave ?? null)
        );
      })
      .map((grade) => grade.studentId),
  );

  const savedGrades = await assessmentsRepository.bulkUpsertGrades(
    assessmentId,
    userId,
    grades,
  );
  invalidateHubCaches(hubId);

  const gradeNotifications = savedGrades
    .filter((submission) => changedStudentIds.has(submission.studentId))
    .map((submission) => {
      const previous = previousSubmissionsByStudent.get(submission.studentId);
      return {
        userId: submission.studentId,
        type: "GRADE",
        title:
          !previous || previous.marks === null
            ? "Grade posted"
            : "Grade updated",
        body: `Your grade for ${meta.title} is available.`,
        route: `/hub/${hubId}?tab=classwork&assessmentId=${meta.id}&fromNotification=true`,
        dedupeKey: `assessment-grade:${submission.id}:${submission.updatedAt.toISOString()}`,
      };
    });
  await createCourseNotificationsForRecipients(hubId, gradeNotifications);
  return savedGrades;
};

export const updateAssessment = async (
  userId: string,
  hubId: string,
  assessmentId: string,
  data: UpdateAssessmentPayload,
) => {
  const meta = await assessmentsRepository.findAssessmentMetaById(assessmentId);
  if (!meta || meta.hubId !== hubId) {
    throw new AppError("Assessment not found", 404);
  }

  const member = await verifyHubRole(userId, hubId, ["TEACHER", "CR"]);
  await assertActiveHub(
    hubId,
    "Archived Course Hubs are read-only and coursework cannot be edited.",
  );

  if (
    !canRoleManageAssessment({
      role: member.role,
      userId,
      creatorId: meta.creatorId,
    })
  ) {
    throw new AppError(
      "You do not have permission to edit another member's coursework.",
      403,
    );
  }

  const effectiveStart =
    data.startDate !== undefined ? data.startDate : meta.startDate;
  const effectiveDeadline =
    data.deadline !== undefined ? data.deadline : meta.deadline;
  if (!validateAssessmentDateWindow(effectiveStart, effectiveDeadline)) {
    throw new AppError("Start date must be on or before the deadline.", 400);
  }

  if (data.totalMarks !== undefined && data.totalMarks < meta.totalMarks) {
    const maxGradedMarks =
      await assessmentsRepository.findMaxGradedMarksForAssessment(
        assessmentId,
      );
    if (maxGradedMarks !== null && data.totalMarks < maxGradedMarks) {
      throw new AppError(
        `Total marks cannot be lowered below the highest existing grade (${maxGradedMarks}).`,
        400,
      );
    }
  }

  assertNoNewCloudinaryAttachments(
    data.attachments,
    meta.attachments as { url?: string }[] | null,
  );
  const updated = await assessmentsRepository.updateAssessment(
    assessmentId,
    data,
  );
  invalidateHubCaches(hubId);
  return updated;
};

export const deleteAssessment = async (
  userId: string,
  hubId: string,
  assessmentId: string,
) => {
  const meta = await assessmentsRepository.findAssessmentMetaById(assessmentId);
  if (!meta || meta.hubId !== hubId) {
    throw new AppError("Assessment not found", 404);
  }

  const member = await verifyHubRole(userId, hubId, ["TEACHER", "CR"]);
  await assertActiveHub(
    hubId,
    "Archived Course Hubs are read-only and coursework cannot be deleted.",
  );

  if (
    !canRoleManageAssessment({
      role: member.role,
      userId,
      creatorId: meta.creatorId,
    })
  ) {
    throw new AppError(
      "You do not have permission to delete another member's coursework.",
      403,
    );
  }

  const deleted = await assessmentsRepository.deleteAssessment(assessmentId);
  invalidateHubCaches(hubId);
  return deleted;
};
