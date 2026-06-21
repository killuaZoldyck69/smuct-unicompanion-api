import { Request, Response } from "express";
import { catchAsync } from "../../../utils/catchAsync";
import * as assessmentService from "./assessments.service";

export const createAssessment = catchAsync(
  async (req: Request, res: Response) => {
    const data = await assessmentService.createAssessment(
      req.user.id,
      req.params.id as string,
      req.body,
    );
    res
      .status(201)
      .json({ success: true, message: "Assessment created", data });
  },
);

export const getAssessments = catchAsync(
  async (req: Request, res: Response) => {
    const data = await assessmentService.getAssessments(
      req.params.id as string,
    );
    res.status(200).json({ success: true, data });
  },
);

export const submitAssessment = catchAsync(
  async (req: Request, res: Response) => {
    const data = await assessmentService.submitAssessment(
      req.user.id,
      req.params.assessmentId as string,
      req.body.submittedUrl,
    );
    res
      .status(200)
      .json({ success: true, message: "Assignment submitted", data });
  },
);

export const gradeSubmission = catchAsync(
  async (req: Request, res: Response) => {
    const data = await assessmentService.gradeSubmission(
      req.user.id,
      req.params.submissionId as string,
      req.body.marks,
    );
    res.status(200).json({ success: true, message: "Submission graded", data });
  },
);

export const bulkGrade = catchAsync(async (req: Request, res: Response) => {
  const data = await assessmentService.bulkGrade(
    req.user.id,
    req.params.assessmentId as string,
    req.body,
  );
  res
    .status(200)
    .json({ success: true, message: "Bulk grading complete", data });
});
