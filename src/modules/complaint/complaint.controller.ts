import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import * as complaintService from "./complaint.service";

export const createComplaint = catchAsync(
  async (req: Request, res: Response) => {
    const newComplaint = await complaintService.createComplaintService(
      req.user.id,
      req.body,
    );
    res.status(201).json({
      success: true,
      message: "Complaint created successfully.",
      data: newComplaint,
    });
  },
);

export const getMyComplaints = catchAsync(
  async (req: Request, res: Response) => {
    const complaints = await complaintService.getMyComplaintsService(
      req.user.id,
    );
    res.status(200).json({
      success: true,
      message: "My complaints retrieved.",
      data: complaints,
    });
  },
);

export const getAllComplaints = catchAsync(
  async (req: Request, res: Response) => {
    const complaints = await complaintService.getAllComplaintsService();
    res.status(200).json({
      success: true,
      message: "All complaints retrieved.",
      data: complaints,
    });
  },
);

export const updateComplaintStatus = catchAsync(
  async (req: Request, res: Response) => {
    const updatedComplaint =
      await complaintService.updateComplaintStatusService(
        req.params.id as string,
        req.body.status,
      );
    res.status(200).json({
      success: true,
      message: "Status updated.",
      data: updatedComplaint,
    });
  },
);

export const deleteComplaint = catchAsync(
  async (req: Request, res: Response) => {
    await complaintService.deleteComplaintService(req.params.id as string);
    res.status(200).json({ success: true, message: "Complaint deleted." });
  },
);
