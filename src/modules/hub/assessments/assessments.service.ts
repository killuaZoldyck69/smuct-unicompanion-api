import { verifyHubRole } from "../hub.service";
import { AppError } from "../../../utils/AppError";
import * as assessmentsRepository from "./assessments.repository";
import {
  CreateAssessmentPayload,
  UpdateAssessmentPayload,
  SubmitAssessmentPayload,
  GradeSubmissionPayload,
  BulkGradePayload,
} from "./assessments.schema";
import { assertNoNewCloudinaryAttachments } from "../hub-attachments";
import {
  createHubNotifications,
  createCourseNotificationsForRecipients,
} from "../../notification/notification.service";

export const createAssessment = async (
  userId: string,
  hubId: string,
  data: CreateAssessmentPayload,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR"]);
  assertNoNewCloudinaryAttachments(data.attachments);
  const assessment = await assessmentsRepository.createAssessment(
    userId,
    hubId,
    data,
  );
  await createHubNotifications(hubId, userId, {
    type: "ASSESSMENT",
    title: "New coursework posted",
    body: assessment.title,
    route: `/hub/${hubId}/assessments`,
    dedupeKey: `assessment:${assessment.id}`,
  });
  return assessment;
};

export const getAssessments = async (
  hubId: string,
  filters?: { type?: string; status?: string },
) => {
  return await assessmentsRepository.findAssessmentsByHubId(hubId, filters);
};

export const getAssessmentSubmissions = async (
  userId: string,
  assessmentId: string,
) => {
  const assessment = await assessmentsRepository.findAssessmentById(assessmentId);
  if (!assessment) throw new AppError("Assessment not found", 404);

  await verifyHubRole(userId, assessment.hubId, ["TEACHER", "ADMIN"]);

  return await assessmentsRepository.findAssessmentSubmissions(assessmentId);
};

export const submitAssessment = async (
  userId: string,
  assessmentId: string,
  payload: SubmitAssessmentPayload,
) => {
  const assessment = await assessmentsRepository.findAssessmentById(assessmentId);
  if (!assessment) throw new AppError("Assessment not found", 404);

  await verifyHubRole(userId, assessment.hubId, ["STUDENT", "CR"]);

  const isLate = new Date() > new Date(assessment.deadline);

  if (isLate && !assessment.allowLateSubmission) {
    throw new AppError(
      "Submissions are closed for this coursework. Late submissions are not allowed.",
      400,
    );
  }

  const status =
    payload.status === "HAND_SUBMISSION"
      ? (isLate ? "LATE_HAND_SUBMISSION" : "HAND_SUBMISSION")
      : (isLate ? "LATE" : "SUBMITTED");

  const previousSubmission = assessment.submissions.find(
    (submission) => submission.studentId === userId,
  );
  if (previousSubmission?.status === "UNSUBMITTED" && isLate && !assessment.allowLateSubmission) {
    throw new AppError(
      "This coursework cannot be resubmitted after the deadline.",
      400,
    );
  }
  assertNoNewCloudinaryAttachments(
    payload.attachments,
    previousSubmission?.attachments as { url?: string }[] | null,
  );

  return await assessmentsRepository.upsertSubmission(
    assessmentId,
    userId,
    {
      submittedUrl: payload.submittedUrl,
      content: payload.content,
      attachments: payload.attachments as any,
      links: payload.links as any,
      isLate,
      status,
    },
  );
};

export const unsubmitAssessment = async (
  userId: string,
  assessmentId: string,
) => {
  const assessment = await assessmentsRepository.findAssessmentById(assessmentId);
  if (!assessment) throw new AppError("Assessment not found", 404);

  await verifyHubRole(userId, assessment.hubId, ["STUDENT", "CR"]);
  if (assessment.submissionType === "HAND") {
    throw new AppError("Only online coursework can be unsubmitted.", 400);
  }
  const isOverdue = Date.now() >= new Date(assessment.deadline).getTime();
  if (isOverdue && !assessment.allowLateSubmission) {
    throw new AppError("Coursework can only be unsubmitted before its deadline.", 400);
  }

  const submission = await assessmentsRepository.findStudentSubmission(assessmentId, userId);
  if (!submission || !["SUBMITTED", "LATE", "HAND_SUBMISSION", "LATE_HAND_SUBMISSION"].includes(submission.status)) {
    throw new AppError("No submitted coursework is available to unsubmit.", 400);
  }
  if (submission.marks !== null || submission.status === "GRADED") {
    throw new AppError("Graded coursework cannot be unsubmitted.", 400);
  }

  return assessmentsRepository.markSubmissionUnsubmitted(submission.id);
};

export const gradeSubmission = async (
  userId: string,
  submissionId: string,
  data: GradeSubmissionPayload & { studentId?: string; assessmentId?: string },
) => {
  let submission = await assessmentsRepository.findSubmissionById(submissionId);

  if (!submission && (data.assessmentId || data.studentId)) {
    const targetAssessmentId = data.assessmentId;
    const targetStudentId = data.studentId || submissionId;
    if (targetAssessmentId && targetStudentId) {
      const assessment = await assessmentsRepository.findAssessmentById(targetAssessmentId);
      if (assessment) {
        await verifyHubRole(userId, assessment.hubId, ["TEACHER"]);
        if (data.marks < 0) throw new AppError("Marks cannot be negative", 400);
        if (data.marks > assessment.totalMarks) {
          throw new AppError(
            `Marks (${data.marks}) cannot exceed the maximum allowed marks (${assessment.totalMarks})`,
            400,
          );
        }
        const upserted = await assessmentsRepository.upsertSubmission(
          targetAssessmentId,
          targetStudentId,
          { status: "GRADED" },
        );
        const gradedSubmission = await assessmentsRepository.updateSubmissionGrade(
          upserted.id,
          {
            marks: data.marks,
            feedback: data.feedback,
            gradedById: userId,
          },
        );
        await createCourseNotificationsForRecipients(assessment.hubId, [
          {
            userId: targetStudentId,
            type: "GRADE",
            title: "Grade posted",
            body: `Your grade for ${assessment.title} is available.`,
            route: `/hub/${assessment.hubId}/assessments?assessmentId=${assessment.id}`,
            dedupeKey: `assessment-grade:${gradedSubmission.id}:${gradedSubmission.updatedAt.toISOString()}`,
          },
        ]);
        return gradedSubmission;
      }
    }
  }

  if (!submission) throw new AppError("Submission not found", 404);

  await verifyHubRole(userId, submission.assessment.hubId, ["TEACHER"]);

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
  if (gradeChanged) {
    await createCourseNotificationsForRecipients(submission.assessment.hubId, [
      {
        userId: submission.studentId,
        type: "GRADE",
        title: submission.marks === null ? "Grade posted" : "Grade updated",
        body: `Your grade for ${submission.assessment.title} is available.`,
        route: `/hub/${submission.assessment.hubId}/assessments?assessmentId=${submission.assessment.id}`,
        dedupeKey: `assessment-grade:${gradedSubmission.id}:${gradedSubmission.updatedAt.toISOString()}`,
      },
    ]);
  }
  return gradedSubmission;
};

export const bulkGrade = async (
  userId: string,
  assessmentId: string,
  grades: BulkGradePayload,
) => {
  const assessment = await assessmentsRepository.findAssessmentById(assessmentId);
  if (!assessment) throw new AppError("Assessment not found", 404);

  await verifyHubRole(userId, assessment.hubId, ["TEACHER"]);

  const uniqueStudentIds = new Set(grades.map((grade) => grade.studentId));
  if (uniqueStudentIds.size !== grades.length) {
    throw new AppError("A student can only appear once in a bulk grade request", 400);
  }

  const activeHubStudentIds = await assessmentsRepository.findActiveHubStudentIds(
    assessment.hubId,
    [...uniqueStudentIds],
  );
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
      throw new AppError(`Marks for student ${grade.studentId} cannot be negative`, 400);
    }
    if (grade.marks > assessment.totalMarks) {
      throw new AppError(
        `Marks for student ${grade.studentId} (${grade.marks}) exceed maximum marks (${assessment.totalMarks})`,
        400,
      );
    }
  }

  const previousSubmissionsByStudent = new Map(
    assessment.submissions.map((submission) => [submission.studentId, submission]),
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
  const gradeNotifications = savedGrades
    .filter((submission) => changedStudentIds.has(submission.studentId))
    .map((submission) => {
      const previous = previousSubmissionsByStudent.get(submission.studentId);
      return {
        userId: submission.studentId,
        type: "GRADE",
        title: !previous || previous.marks === null ? "Grade posted" : "Grade updated",
        body: `Your grade for ${assessment.title} is available.`,
        route: `/hub/${assessment.hubId}/assessments?assessmentId=${assessment.id}`,
        dedupeKey: `assessment-grade:${submission.id}:${submission.updatedAt.toISOString()}`,
      };
    });
  await createCourseNotificationsForRecipients(assessment.hubId, gradeNotifications);
  return savedGrades;
};

export const updateAssessment = async (
  userId: string,
  assessmentId: string,
  data: UpdateAssessmentPayload,
) => {
  const assessment = await assessmentsRepository.findAssessmentById(assessmentId);
  if (!assessment) throw new AppError("Assessment not found", 404);

  await verifyHubRole(userId, assessment.hubId, ["TEACHER", "CR"]);

  assertNoNewCloudinaryAttachments(
    data.attachments,
    assessment.attachments as { url?: string }[] | null,
  );
  return await assessmentsRepository.updateAssessment(assessmentId, data);
};

export const deleteAssessment = async (
  userId: string,
  assessmentId: string,
) => {
  const assessment = await assessmentsRepository.findAssessmentById(assessmentId);
  if (!assessment) throw new AppError("Assessment not found", 404);

  await verifyHubRole(userId, assessment.hubId, ["TEACHER", "CR"]);

  return await assessmentsRepository.deleteAssessment(assessmentId);
};
