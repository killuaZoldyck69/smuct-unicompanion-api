import {
  BloodGroup,
  SystemRole,
  HubRole,
  AssessmentType,
  SubmissionType,
  ComplaintStatus,
  BookingStatus,
  LostFoundType,
  LostFoundStatus,
  LostFoundClaimStatus,
  LostFoundCategory,
  ListingType,
  ListingStatus,
  ItemCondition,
  MarketplaceCategory,
  MemeReactionType,
} from "../../generated/prisma/enums";

export {
  BloodGroup,
  SystemRole,
  HubRole,
  AssessmentType,
  SubmissionType,
  ComplaintStatus,
  BookingStatus,
  LostFoundType,
  LostFoundStatus,
  LostFoundClaimStatus,
  LostFoundCategory,
  ListingType,
  ListingStatus,
  ItemCondition,
  MarketplaceCategory,
  MemeReactionType,
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

export const LOST_FOUND_TYPE_VALUES = [
  LostFoundType.LOST,
  LostFoundType.FOUND,
] as const;

export const LOST_FOUND_STATUS_VALUES = [
  LostFoundStatus.ACTIVE,
  LostFoundStatus.CLAIMED,
  LostFoundStatus.RESOLVED,
  LostFoundStatus.CLOSED,
] as const;

export const LOST_FOUND_CLAIM_STATUS_VALUES = [
  LostFoundClaimStatus.PENDING,
  LostFoundClaimStatus.ACCEPTED,
  LostFoundClaimStatus.REJECTED,
  LostFoundClaimStatus.WITHDRAWN,
] as const;

export const LOST_FOUND_CATEGORY_VALUES = [
  LostFoundCategory.BOOKS,
  LostFoundCategory.ELECTRONICS,
  LostFoundCategory.ID_CARD,
  LostFoundCategory.KEYS,
  LostFoundCategory.CLOTHING,
  LostFoundCategory.OTHER,
] as const;

export const LISTING_TYPE_VALUES = [
  ListingType.SELLING,
  ListingType.BUYING,
] as const;

export const LISTING_STATUS_VALUES = [
  ListingStatus.ACTIVE,
  ListingStatus.SOLD,
  ListingStatus.CLOSED,
] as const;

export const ITEM_CONDITION_VALUES = [
  ItemCondition.NEW,
  ItemCondition.LIKE_NEW,
  ItemCondition.GOOD,
  ItemCondition.FAIR,
] as const;

export const MARKETPLACE_CATEGORY_VALUES = [
  MarketplaceCategory.TEXTBOOKS,
  MarketplaceCategory.ELECTRONICS,
  MarketplaceCategory.STATIONERY,
  MarketplaceCategory.CLOTHING,
  MarketplaceCategory.OTHER,
] as const;

