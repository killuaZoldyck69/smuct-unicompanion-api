import { AppError } from "../../utils/AppError";
import * as bloodRepository from "./blood.repository";
import {
  CreateBloodPostPayload,
  RespondBloodPostPayload,
} from "./blood.schema";

export const createBloodPostService = async (
  authorId: string,
  data: CreateBloodPostPayload,
) => {
  const author = await bloodRepository.findUserById(authorId);
  if (!author) {
    throw new AppError("User not found.", 404);
  }

  const missingFields: string[] = [];
  if (!author.phoneNumber || !author.phoneNumber.trim()) {
    missingFields.push("phone number");
  }
  if (!author.bloodGroup) {
    missingFields.push("blood group");
  }

  if (missingFields.length > 0) {
    throw new AppError(
      `Profile incomplete: You must have both a phone number and blood group filled in your profile before submitting a blood request. Missing: ${missingFields.join(" and ")}.`,
      400,
    );
  }

  return await bloodRepository.createBloodPost(authorId, data);
};

export const getBloodFeedService = async (
  query?: {
    page?: number | string;
    limit?: number | string;
    search?: string;
    bloodGroup?: any;
    urgency?: string;
    isFulfilled?: string;
    myPosts?: string;
  },
  userId?: string,
) => {
  const page = Math.max(1, Number(query?.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(query?.limit) || 20));
  const skip = (page - 1) * limit;

  const where: any = {};

  if (query?.bloodGroup) {
    where.bloodGroup = query.bloodGroup;
  }

  if (query?.urgency) {
    where.urgency = query.urgency;
  }

  if (query?.isFulfilled !== undefined) {
    where.isFulfilled = query.isFulfilled === "true";
  }

  if (query?.myPosts === "true" && userId) {
    where.authorId = userId;
  }

  const searchKeyword =
    typeof query?.search === "string" ? query.search.trim() : undefined;
  if (searchKeyword) {
    where.OR = [
      { patientName: { contains: searchKeyword, mode: "insensitive" } },
      { patientCondition: { contains: searchKeyword, mode: "insensitive" } },
      { details: { contains: searchKeyword, mode: "insensitive" } },
      { location: { contains: searchKeyword, mode: "insensitive" } },
      { hospitalName: { contains: searchKeyword, mode: "insensitive" } },
      { hospitalAddress: { contains: searchKeyword, mode: "insensitive" } },
    ];
  }

  const [posts, total, counts] = await Promise.all([
    bloodRepository.findBloodFeed(where, skip, limit),
    bloodRepository.countBloodPosts(where),
    bloodRepository.getBloodCounts(userId),
  ]);

  return {
    data: posts,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      counts,
    },
  };
};

export const maskPhoneNumber = (phone?: string | null): string | null => {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (trimmed.length <= 5) return "***";
  const start = trimmed.slice(0, 3);
  const end = trimmed.slice(-3);
  return `${start}****${end}`;
};

export const getBloodPostByIdService = async (
  id: string,
  viewerUserId?: string,
  viewerRole?: string,
) => {
  const post = await bloodRepository.findBloodPostWithDetails(id);

  if (!post) {
    throw new AppError("Blood request not found.", 404);
  }

  // Privacy Protection: Mask volunteer phone numbers for third parties
  // Only the blood post author, an ADMIN, or the volunteer themselves may view unmasked contact numbers.
  const isAuthor = !!(viewerUserId && post.authorId === viewerUserId);
  const isAdmin = viewerRole === "ADMIN";

  const sanitizedResponses = post.responses.map((response) => {
    const isSelf = !!(viewerUserId && response.responderId === viewerUserId);
    const canViewContact = isAuthor || isAdmin || isSelf;

    return {
      ...response,
      responder: response.responder
        ? {
            ...response.responder,
            phoneNumber: canViewContact
              ? response.responder.phoneNumber
              : maskPhoneNumber(response.responder.phoneNumber),
            canContact: canViewContact,
          }
        : response.responder,
    };
  });

  return {
    ...post,
    responses: sanitizedResponses,
  };
};

export const respondToBloodPostService = async (
  postId: string,
  responderId: string,
  data: RespondBloodPostPayload,
) => {
  const post = await bloodRepository.findBloodPostById(postId);

  if (!post) {
    throw new AppError("Blood request not found.", 404);
  }

  // Prevent volunteering for already fulfilled requests
  if (post.isFulfilled) {
    throw new AppError(
      "This blood request has already been fulfilled. No more volunteers are needed.",
      400,
    );
  }

  // Prevent users from responding to their own requests
  if (post.authorId === responderId) {
    throw new AppError("You cannot volunteer for your own blood request.", 400);
  }

  const responder = await bloodRepository.findUserById(responderId);
  if (!responder) {
    throw new AppError("User not found.", 404);
  }

  const missingFields: string[] = [];
  if (!responder.phoneNumber || !responder.phoneNumber.trim()) {
    missingFields.push("phone number");
  }
  if (!responder.bloodGroup) {
    missingFields.push("blood group");
  }

  if (missingFields.length > 0) {
    throw new AppError(
      `Profile incomplete: You must have both a phone number and blood group filled in your profile before volunteering. Missing: ${missingFields.join(" and ")}.`,
      400,
    );
  }

  // Prevent duplicate responses from the same user on the same post
  const existingResponse = await bloodRepository.findBloodResponse(
    postId,
    responderId,
  );

  if (existingResponse) {
    throw new AppError("You have already responded to this request.", 409);
  }

  return await bloodRepository.createBloodResponse(
    postId,
    responderId,
    data.message,
  );
};

export const resolveBloodPostService = async (
  postId: string,
  userId: string,
  role?: string,
) => {
  const post = await bloodRepository.findBloodPostById(postId);

  if (!post) {
    throw new AppError("Blood request not found.", 404);
  }

  if (post.authorId !== userId && role !== "ADMIN") {
    throw new AppError(
      "You do not have permission to mark this request as fulfilled.",
      403,
    );
  }

  if (post.isFulfilled) {
    return post;
  }

  return await bloodRepository.updateBloodPostFulfilled(postId, true);
};

export const deleteBloodPostService = async (
  postId: string,
  userId: string,
  role?: string,
) => {
  const post = await bloodRepository.findBloodPostById(postId);

  if (!post) {
    throw new AppError("Blood request not found.", 404);
  }

  if (post.authorId !== userId && role !== "ADMIN") {
    throw new AppError(
      "You do not have permission to delete this request.",
      403,
    );
  }

  return await bloodRepository.deleteBloodPostById(postId);
};
