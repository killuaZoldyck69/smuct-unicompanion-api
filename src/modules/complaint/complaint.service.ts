import { AppError } from "../../utils/AppError";
import * as complaintRepository from "./complaint.repository";
import {
  CreateComplaintPayload,
  UpdateComplaintPayload,
  UpdateComplaintStatusPayload,
} from "./complaint.schema";

/**
 * Sanitizes anonymous complaints to protect complainant identity.
 * If the complaint is anonymous, `user` and `userId` are never revealed
 * unless the requester is the original creator viewing their own item.
 */
export const sanitizeComplaint = (
  complaint: any,
  requesterUserId?: string,
  requesterRole?: string,
) => {
  if (!complaint) return complaint;
  const sanitized = { ...complaint };

  if (sanitized.isAnonymous && requesterUserId !== sanitized.userId) {
    sanitized.userId = null;
    sanitized.user = null;
  }

  return sanitized;
};

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

export const getAllComplaintsService = async (
  options?: complaintRepository.FindAllComplaintsOptions,
) => {
  const result = await complaintRepository.findAllComplaints(options);
  const sanitizedItems = result.items.map((item) => sanitizeComplaint(item));

  return {
    items: sanitizedItems,
    pagination: result.pagination,
  };
};

export const getAdminComplaintStatsService = async () => {
  return await complaintRepository.getAdminComplaintStats();
};

export const getComplaintByIdService = async (
  id: string,
  requesterId: string,
  requesterRole: string,
) => {
  const complaint = await complaintRepository.findComplaintById(id);
  if (!complaint || complaint.deletedAt) {
    throw new AppError("Complaint not found", 404);
  }

  if (complaint.userId !== requesterId && requesterRole !== "ADMIN") {
    throw new AppError("You do not have permission to view this complaint", 403);
  }

  return sanitizeComplaint(complaint, requesterId, requesterRole);
};

export const updateComplaintService = async (
  id: string,
  userId: string,
  userRole: string,
  data: UpdateComplaintPayload,
) => {
  const complaint = await complaintRepository.findComplaintById(id);
  if (!complaint || complaint.deletedAt) {
    throw new AppError("Complaint not found", 404);
  }

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
  newStatus: UpdateComplaintStatusPayload["status"],
  adminRemarks?: string | null,
) => {
  const complaint = await complaintRepository.findComplaintById(id);
  if (!complaint || complaint.deletedAt) {
    throw new AppError("Complaint not found", 404);
  }

  // 1. Prevent duplicate or redundant state change
  if (complaint.status === newStatus) {
    throw new AppError(
      `Complaint is already ${newStatus.toLowerCase()}`,
      400,
    );
  }

  // 2. Validate strict lifecycle state transitions
  switch (complaint.status) {
    case "PENDING":
      // A pending complaint can be accepted or rejected.
      // Must not allow resolving before it has been accepted!
      if (newStatus === "RESOLVED") {
        throw new AppError(
          "A pending complaint must first be accepted before it can be resolved",
          400,
        );
      }
      if (newStatus !== "ACCEPTED" && newStatus !== "REJECTED") {
        throw new AppError(
          `Invalid status transition from PENDING to ${newStatus}`,
          400,
        );
      }
      break;

    case "ACCEPTED":
      // An accepted complaint can be resolved or rejected.
      // Cannot revert back to pending.
      if (newStatus === "PENDING") {
        throw new AppError(
          "Cannot revert an accepted complaint back to pending",
          400,
        );
      }
      if (newStatus !== "RESOLVED" && newStatus !== "REJECTED") {
        throw new AppError(
          `Invalid status transition from ACCEPTED to ${newStatus}`,
          400,
        );
      }
      break;

    case "RESOLVED":
      // Prevent further lifecycle transitions
      throw new AppError(
        "Resolved complaints cannot undergo further status transitions",
        400,
      );

    case "REJECTED":
      // Prevent acceptance or resolution through invalid status transitions
      throw new AppError(
        "Rejected complaints cannot undergo further status transitions",
        400,
      );

    default:
      throw new AppError("Invalid complaint status", 400);
  }

  const updated = await complaintRepository.updateComplaintStatus(
    id,
    newStatus,
    adminRemarks,
  );

  return sanitizeComplaint(updated);
};

export const deleteComplaintService = async (
  id: string,
  userId: string,
  userRole: string,
) => {
  const complaint = await complaintRepository.findComplaintById(id);
  if (!complaint || complaint.deletedAt) {
    throw new AppError("Complaint not found", 404);
  }

  if (complaint.userId !== userId && userRole !== "ADMIN") {
    throw new AppError("You do not have permission to delete this complaint", 403);
  }

  if (userRole !== "ADMIN" && complaint.status !== "PENDING") {
    throw new AppError("Cannot delete a complaint that has already been accepted or processed", 400);
  }

  return await complaintRepository.deleteComplaintById(id);
};
