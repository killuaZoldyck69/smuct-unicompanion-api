import { LostFoundClaimStatus } from "../../constants/enums";
import { publicUserSelect } from "../forum/forum.domain";

export const publicAuthorSelection = publicUserSelect;

export const privateContactSelection = {
  id: true,
  name: true,
  email: true,
  phoneNumber: true,
  image: true,
  role: true,
  studentProfile: {
    select: {
      studentId: true,
      department: true,
      batch: true,
      currentSemester: true,
      section: true,
    },
  },
  teacherProfile: {
    select: {
      department: true,
      designation: true,
      officeRoom: true,
      consultationSlots: true,
    },
  },
} as const;

export const safePostResponseSelect = {
  id: true,
  authorId: true,
  type: true,
  title: true,
  description: true,
  category: true,
  location: true,
  status: true,
  images: true,
  verificationQuestion: true,
  resolvedClaimId: true,
  isHiddenByModeration: true,
  createdAt: true,
  updatedAt: true,
  author: { select: publicAuthorSelection },
  _count: {
    select: {
      claims: {
        where: { status: LostFoundClaimStatus.PENDING },
      },
    },
  },
} as const;
