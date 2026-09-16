import { verifyHubRole } from "../hub.service";
import { AppError } from "../../../utils/AppError";
import * as assessmentsRepository from "./assessments.repository";
import {
  CreateAssessmentPayload,
  UpdateAssessmentPayload,
} from "./assessments.schema";

export const createAssessment = async (
  userId: string,
  hubId: string,
  data: CreateAssessmentPayload,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "TA"]);
  return await assessmentsRepository.createAssessment(userId, hubId, data);
};

export const getAssessments = async (hubId: string) => {
  return await assessmentsRepository.findAssessmentsByHubId(hubId);
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
  submittedUrl: string,
) => {
  const assessment = await assessmentsRepository.findAssessmentById(assessmentId);
  if (!assessment) throw new AppError("Assessment not found", 404);

  await verifyHubRole(userId, assessment.hubId, ["STUDENT", "CR", "TA"]);

  return await assessmentsRepository.upsertSubmission(
    assessmentId,
    userId,
    submittedUrl,
  );
};

export const gradeSubmission = async (
  userId: string,
  submissionId: string,
  marks: number,
) => {
  const submission = await assessmentsRepository.findSubmissionById(submissionId);
  if (!submission) throw new AppError("Submission not found", 404);

  await verifyHubRole(userId, submission.assessment.hubId, ["TEACHER", "TA"]);

  return await assessmentsRepository.updateSubmissionGrade(
    submissionId,
    marks,
    userId,
  );
};

export const bulkGrade = async (
  userId: string,
  assessmentId: string,
  grades: { studentId: string; marks: number }[],
) => {
  const assessment = await assessmentsRepository.findAssessmentById(assessmentId);
  if (!assessment) throw new AppError("Assessment not found", 404);

  await verifyHubRole(userId, assessment.hubId, ["TEACHER", "CR", "TA"]);

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
