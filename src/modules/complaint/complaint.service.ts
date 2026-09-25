import { AppError } from "../../utils/AppError";
import * as complaintRepository from "./complaint.repository";
import {
  CreateComplaintPayload,
  UpdateComplaintPayload,
  UpdateComplaintStatusPayload,
} from "./complaint.schema";

export const createComplaintService = async (
  userId: string,
  data: CreateComplaintPayload,
) => {
  return await complaintRepository.createComplaint(userId, data);
};

export const getMyComplaintsService = async (
  userId: string,
  options?: complaintRepository.FindComplaintsQueryOptions,
) => {
  return await complaintRepository.findComplaintsByUserId(userId, options);
};

export const getMyComplaintStatsService = async (userId: string) => {
  return await complaintRepository.getComplaintStatsByUserId(userId);
};

export const getAllComplaintsService = async () => {
  return await complaintRepository.findAllComplaints(100);
};

export const updateComplaintService = async (
  id: string,
  userId: string,
  userRole: string,
  data: UpdateComplaintPayload,
) => {
  const complaint = await complaintRepository.findComplaintById(id);
  if (!complaint) throw new AppError("Complaint not found", 404);

  if (complaint.userId !== userId && userRole !== "ADMIN") {
    throw new AppError("You do not have permission to edit this complaint", 403);
  }

  if (complaint.status !== "PENDING" && userRole !== "ADMIN") {
    throw new AppError("Cannot edit a complaint that has already been processed or resolved", 400);
  }

  return await complaintRepository.updateComplaint(id, data);
};

export const updateComplaintStatusService = async (
  id: string,
  status: UpdateComplaintStatusPayload["status"],
  adminRemarks?: string | null,
) => {
  const complaint = await complaintRepository.findComplaintById(id);
  if (!complaint) throw new AppError("Complaint not found", 404);

  return await complaintRepository.updateComplaintStatus(id, status, adminRemarks);
};

export const deleteComplaintService = async (
  id: string,
  userId: string,
  userRole: string,
) => {
  const complaint = await complaintRepository.findComplaintById(id);
  if (!complaint) throw new AppError("Complaint not found", 404);

  if (complaint.userId !== userId && userRole !== "ADMIN") {
    throw new AppError("You do not have permission to delete this complaint", 403);
  }

  return await complaintRepository.deleteComplaintById(id);
};
