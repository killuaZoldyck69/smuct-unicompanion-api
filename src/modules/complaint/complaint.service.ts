import { AppError } from "../../utils/AppError";
import * as complaintRepository from "./complaint.repository";
import {
  CreateComplaintPayload,
  UpdateComplaintStatusPayload,
} from "./complaint.schema";

export const createComplaintService = async (
  userId: string,
  data: CreateComplaintPayload,
) => {
  return await complaintRepository.createComplaint(userId, data);
};

export const getMyComplaintsService = async (userId: string) => {
  return await complaintRepository.findComplaintsByUserId(userId, 100);
};

export const getAllComplaintsService = async () => {
  return await complaintRepository.findAllComplaints(100);
};

export const updateComplaintStatusService = async (
  id: string,
  status: UpdateComplaintStatusPayload["status"],
) => {
  const complaint = await complaintRepository.findComplaintById(id);
  if (!complaint) throw new AppError("Complaint not found", 404);

  return await complaintRepository.updateComplaintStatus(id, status);
};

export const deleteComplaintService = async (id: string) => {
  const complaint = await complaintRepository.findComplaintById(id);
  if (!complaint) throw new AppError("Complaint not found", 404);

  return await complaintRepository.deleteComplaintById(id);
};
