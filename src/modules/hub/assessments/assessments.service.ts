import { prisma } from "../../../lib/prisma";
import { verifyHubRole } from "../hub.service";
import { AppError } from "../../../utils/AppError";

export const createAssessment = async (
  userId: string,
  hubId: string,
  data: any,
) => {
  await verifyHubRole(userId, hubId, ["TEACHER", "CR", "TA"]);
  return await prisma.assessment.create({
    data: { hubId, creatorId: userId, ...data },
  });
};

export const getAssessments = async (hubId: string) => {
  return await prisma.assessment.findMany({
    where: { hubId },
    orderBy: { deadline: "asc" },
    include: { submissions: true },
  });
};

export const submitAssessment = async (
  userId: string,
  assessmentId: string,
  submittedUrl: string,
) => {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
  });
  if (!assessment) throw new AppError("Assessment not found", 404);

  // 👈 FIX: Added "TA" and ensured "CR" are allowed to submit
  await verifyHubRole(userId, assessment.hubId, ["STUDENT", "CR", "TA"]);

  return await prisma.submission.upsert({
    where: { assessmentId_studentId: { assessmentId, studentId: userId } },
    update: { submittedUrl },
    create: { assessmentId, studentId: userId, submittedUrl },
  });
};

export const gradeSubmission = async (
  userId: string,
  submissionId: string,
  marks: number,
) => {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { assessment: true },
  });
  if (!submission) throw new AppError("Submission not found", 404);

  await verifyHubRole(userId, submission.assessment.hubId, ["TEACHER", "TA"]);

  return await prisma.submission.update({
    where: { id: submissionId },
    data: { marks, gradedById: userId },
  });
};

export const bulkGrade = async (
  userId: string,
  assessmentId: string,
  grades: { studentId: string; marks: number }[],
) => {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
  });
  if (!assessment) throw new AppError("Assessment not found", 404);

  await verifyHubRole(userId, assessment.hubId, ["TEACHER", "CR", "TA"]);

  return await prisma.$transaction(
    grades.map((grade) =>
      prisma.submission.upsert({
        where: {
          assessmentId_studentId: { assessmentId, studentId: grade.studentId },
        },
        update: { marks: grade.marks, gradedById: userId },
        create: {
          assessmentId,
          studentId: grade.studentId,
          marks: grade.marks,
          gradedById: userId,
        },
      }),
    ),
  );
};
