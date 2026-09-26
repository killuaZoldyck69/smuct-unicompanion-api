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

export const createAssessment = async (
  userId: string,
  hubId: string,
  data: CreateAssessmentPayload,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "TA"]);
  return await assessmentsRepository.createAssessment(userId, hubId, data);
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

  await verifyHubRole(userId, assessment.hubId, ["TEACHER", "CR", "TA"]);

  return await assessmentsRepository.findAssessmentSubmissions(assessmentId);
};

export const submitAssessment = async (
  userId: string,
  assessmentId: string,
  payload: SubmitAssessmentPayload,
) => {
  const assessment = await assessmentsRepository.findAssessmentById(assessmentId);
  if (!assessment) throw new AppError("Assessment not found", 404);

  await verifyHubRole(userId, assessment.hubId, ["STUDENT", "CR", "TA"]);

  const isLate = new Date() > new Date(assessment.deadline);
  const status = isLate ? "LATE" : "SUBMITTED";

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

export const gradeSubmission = async (
  userId: string,
  submissionId: string,
  data: GradeSubmissionPayload,
) => {
  const submission = await assessmentsRepository.findSubmissionById(submissionId);
  if (!submission) throw new AppError("Submission not found", 404);

  await verifyHubRole(userId, submission.assessment.hubId, ["TEACHER", "CR", "TA"]);

  if (data.marks < 0) {
    throw new AppError("Marks cannot be negative", 400);
  }

  if (data.marks > submission.assessment.totalMarks) {
    throw new AppError(
      `Marks (${data.marks}) cannot exceed the maximum allowed marks (${submission.assessment.totalMarks})`,
      400,
    );
  }

  return await assessmentsRepository.updateSubmissionGrade(submissionId, {
    marks: data.marks,
    feedback: data.feedback,
    gradedById: userId,
  });
};

export const bulkGrade = async (
  userId: string,
  assessmentId: string,
  grades: BulkGradePayload,
) => {
  const assessment = await assessmentsRepository.findAssessmentById(assessmentId);
  if (!assessment) throw new AppError("Assessment not found", 404);

  await verifyHubRole(userId, assessment.hubId, ["TEACHER", "CR", "TA"]);

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

  return await assessmentsRepository.bulkUpsertGrades(
    assessmentId,
    userId,
    grades,
  );
};

export const updateAssessment = async (
  userId: string,
  assessmentId: string,
  data: UpdateAssessmentPayload,
) => {
  const assessment = await assessmentsRepository.findAssessmentById(assessmentId);
  if (!assessment) throw new AppError("Assessment not found", 404);

  await verifyHubRole(userId, assessment.hubId, ["TEACHER", "CR", "TA"]);

  return await assessmentsRepository.updateAssessment(assessmentId, data);
};

export const deleteAssessment = async (
  userId: string,
  assessmentId: string,
) => {
  const assessment = await assessmentsRepository.findAssessmentById(assessmentId);
  if (!assessment) throw new AppError("Assessment not found", 404);

  await verifyHubRole(userId, assessment.hubId, ["TEACHER", "CR", "TA"]);

  return await assessmentsRepository.deleteAssessment(assessmentId);
};
