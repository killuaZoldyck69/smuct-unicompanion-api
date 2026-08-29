import {
  BloodGroup,
  SystemRole,
  HubRole,
  AssessmentType,
  SubmissionType,
  ComplaintStatus,
  BookingStatus,
} from "../../generated/prisma/enums";

export {
  BloodGroup,
  SystemRole,
  HubRole,
  AssessmentType,
  SubmissionType,
  ComplaintStatus,
  BookingStatus,
};

export const BLOOD_GROUP_VALUES = [
  BloodGroup.A_POSITIVE,
  BloodGroup.A_NEGATIVE,
  BloodGroup.B_POSITIVE,
  BloodGroup.B_NEGATIVE,
  BloodGroup.AB_POSITIVE,
  BloodGroup.AB_NEGATIVE,
  BloodGroup.O_POSITIVE,
  BloodGroup.O_NEGATIVE,
] as const;

export const SYSTEM_ROLE_VALUES = [
  SystemRole.ADMIN,
  SystemRole.STUDENT,
  SystemRole.TEACHER,
] as const;

export const HUB_ROLE_VALUES = [
  HubRole.TEACHER,
  HubRole.CR,
  HubRole.TA,
  HubRole.STUDENT,
] as const;

export const ASSESSMENT_TYPE_VALUES = [
  AssessmentType.ASSIGNMENT,
  AssessmentType.QUIZ,
  AssessmentType.PRESENTATION,
] as const;

export const SUBMISSION_TYPE_VALUES = [
  SubmissionType.ONLINE,
  SubmissionType.HAND,
] as const;

export const COMPLAINT_STATUS_VALUES = [
  ComplaintStatus.PENDING,
  ComplaintStatus.RESOLVED,
  ComplaintStatus.REJECTED,
] as const;

export const BOOKING_STATUS_VALUES = [
  BookingStatus.PENDING,
  BookingStatus.APPROVED,
  BookingStatus.REJECTED,
] as const;
