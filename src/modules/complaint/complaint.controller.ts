import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import * as complaintService from "./complaint.service";
import type { ComplaintStatus } from "../../../generated/prisma/enums";

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
    const { status, page, limit } = req.query;

    const result = await complaintService.getMyComplaintsService(req.user.id, {
      status: status ? (status as ComplaintStatus) : undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    res.status(200).json({
      success: true,
      message: "My complaints retrieved.",
      data: result.items,
      pagination: result.pagination,
    });
  },
);

export const getMyComplaintStats = catchAsync(
  async (req: Request, res: Response) => {
    const stats = await complaintService.getMyComplaintStatsService(req.user.id);
    res.status(200).json({
      success: true,
      message: "Complaint stats retrieved.",
      data: stats,
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

export const updateComplaint = catchAsync(
  async (req: Request, res: Response) => {
    const updated = await complaintService.updateComplaintService(
      req.params.id as string,
      req.user.id,
      req.user.role,
      req.body,
    );
    res.status(200).json({
      success: true,
      message: "Complaint updated successfully.",
      data: updated,
    });
  },
);

export const updateComplaintStatus = catchAsync(
  async (req: Request, res: Response) => {
    const updatedComplaint =
      await complaintService.updateComplaintStatusService(
        req.params.id as string,
        req.body.status,
        req.body.adminRemarks,
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
    await complaintService.deleteComplaintService(
      req.params.id as string,
      req.user.id,
      req.user.role,
    );
    res.status(200).json({ success: true, message: "Complaint deleted." });
  },
);
