import { AppError } from "../../utils/AppError";
import { LostFoundClaimStatus, LostFoundStatus } from "../../constants/enums";
import { sendEmail } from "../../lib/email";
import {
  CreateClaimPayload,
  CreateLostFoundPayload,
} from "./lost-found.schema";
import {
  acceptClaimAtomicInDb,
  countPendingClaimsByClaimantInDb,
  createClaimInDb,
  createLostFoundPostInDb,
  deleteLostFoundPostFromDb,
  findClaimByIdInDb,
  findClaimByPostAndClaimantInDb,
  findClaimsByPostIdInDb,
  findLostFoundFeedInDb,
  findLostFoundPostByIdInDb,
  findPossibleMatchesInDb,
  LostFoundFeedFilters,
  rejectClaimInDb,
  updateLostFoundStatusInDb,
  withdrawClaimInDb,
} from "./lost-found.repository";

export const createPostService = async (
  userId: string,
  payload: CreateLostFoundPayload
) => {
  return createLostFoundPostInDb(userId, payload);
};

export const getFeedService = async (filters: LostFoundFeedFilters) => {
  return findLostFoundFeedInDb(filters);
};

export const getPossibleMatchesService = async (postId: string) => {
  const post = await findLostFoundPostByIdInDb(postId);
  if (!post) {
    throw new AppError("Lost & Found post not found", 404);
  }
  return findPossibleMatchesInDb(
    post.id,
    post.category,
    post.location,
    post.type
  );
};

export const getPostByIdService = async (id: string, viewerId: string) => {
  const post = await findLostFoundPostByIdInDb(id);
  if (!post) {
    throw new AppError("Lost & Found post not found", 404);
  }

  const isAuthor = post.authorId === viewerId;
  const acceptedClaim = post.claims[0];
  const isAcceptedClaimant = acceptedClaim?.claimantId === viewerId;

  // Retrieve viewer's claim on this post if not the author
  let myClaim = null;
  if (!isAuthor) {
    myClaim = await findClaimByPostAndClaimantInDb(id, viewerId);
  }

  const postData: any = { ...post };

  // Strip verification answer if viewer is not the author
  if (!isAuthor) {
    delete postData.verificationAnswer;
  }

  // Redact author private contact details if viewer is neither author nor accepted claimant
  if (!isAuthor && !isAcceptedClaimant) {
    delete postData.author.email;
    delete postData.author.phoneNumber;
    delete postData.claims;
  }

  // Return handover card info if post is resolved
  let handoverData = null;
  if (post.status === LostFoundStatus.RESOLVED && acceptedClaim) {
    if (isAuthor) {
      handoverData = {
        role: "AUTHOR",
        counterpart: {
          id: acceptedClaim.claimant.id,
          name: acceptedClaim.claimant.name,
          email: acceptedClaim.claimant.email,
          phoneNumber: acceptedClaim.claimant.phoneNumber,
          image: acceptedClaim.claimant.image,
          studentProfile: acceptedClaim.claimant.studentProfile,
          teacherProfile: acceptedClaim.claimant.teacherProfile,
        },
      };
    } else if (isAcceptedClaimant) {
      handoverData = {
        role: "CLAIMANT",
        counterpart: {
          id: post.author.id,
          name: post.author.name,
          email: post.author.email,
          phoneNumber: post.author.phoneNumber,
          image: post.author.image,
          studentProfile: post.author.studentProfile,
          teacherProfile: post.author.teacherProfile,
        },
      };
    }
  }

  return {
    ...postData,
    myClaim,
    handoverData,
  };
};

export const updateStatusService = async (
  id: string,
  userId: string,
  userRole: string | undefined,
  status: LostFoundStatus
) => {
  const post = await findLostFoundPostByIdInDb(id);
  if (!post) {
    throw new AppError("Lost & Found post not found", 404);
  }

  const isAuthor = post.authorId === userId;
  const isAdmin = userRole === "ADMIN";

  if (!isAuthor && !isAdmin) {
    throw new AppError(
      "Unauthorized: You do not have permission to modify this post",
      403
    );
  }

  return updateLostFoundStatusInDb(id, status);
};

export const deletePostService = async (
  id: string,
  userId: string,
  userRole: string | undefined
) => {
  const post = await findLostFoundPostByIdInDb(id);
  if (!post) {
    throw new AppError("Lost & Found post not found", 404);
  }

  const isAuthor = post.authorId === userId;
  const isAdmin = userRole === "ADMIN";

  if (!isAuthor && !isAdmin) {
    throw new AppError(
      "Unauthorized: You do not have permission to delete this post",
      403
    );
  }

  return deleteLostFoundPostFromDb(id);
};

// ==============================
// CLAIMS SERVICE
// ==============================

export const createClaimService = async (
  postId: string,
  claimantId: string,
  payload: CreateClaimPayload
) => {
  const post = await findLostFoundPostByIdInDb(postId);
  if (!post) {
    throw new AppError("Lost & Found post not found", 404);
  }

  if (post.authorId === claimantId) {
    throw new AppError("You cannot submit a claim on your own post", 400);
  }

  if (post.status !== LostFoundStatus.ACTIVE) {
    throw new AppError("This post is no longer accepting claims", 400);
  }

  const existingClaim = await findClaimByPostAndClaimantInDb(postId, claimantId);
  if (existingClaim) {
    throw new AppError("You have already submitted a claim for this item", 400);
  }

  const pendingCount = await countPendingClaimsByClaimantInDb(claimantId);
  if (pendingCount >= 5) {
    throw new AppError(
      "You have reached the maximum limit of 5 pending claims. Please withdraw an existing claim before submitting a new one.",
      429
    );
  }

  const claim = await createClaimInDb(postId, claimantId, payload);

  // Send notification email to post author
  if (post.author.email) {
    sendEmail({
      to: post.author.email,
      subject: `New Claim Received: ${post.title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 12px;">
          <h2 style="color: #0284c7;">New Claim Received</h2>
          <p>Hi ${post.author.name},</p>
          <p>Someone has submitted a claim for your Lost & Found item <strong>"${post.title}"</strong>.</p>
          <div style="background-color: #f8fafc; padding: 14px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0; color: #475569;"><strong>Claimant:</strong> ${claim.claimant.name}</p>
            <p style="margin: 8px 0 0 0; color: #475569;"><strong>Message:</strong> ${claim.message}</p>
          </div>
          <p>Open SMUCT UniCompanion app to review the submitted claim and verification proof.</p>
        </div>
      `,
    }).catch((err) => console.error("Failed to send claim notification email:", err));
  }

  return claim;
};

export const getClaimsForPostService = async (postId: string, userId: string) => {
  const post = await findLostFoundPostByIdInDb(postId);
  if (!post) {
    throw new AppError("Lost & Found post not found", 404);
  }

  if (post.authorId === userId) {
    return findClaimsByPostIdInDb(postId);
  }

  const myClaim = await findClaimByPostAndClaimantInDb(postId, userId);
  return myClaim ? [myClaim] : [];
};

export const acceptClaimService = async (
  postId: string,
  claimId: string,
  userId: string
) => {
  const post = await findLostFoundPostByIdInDb(postId);
  if (!post) {
    throw new AppError("Lost & Found post not found", 404);
  }

  if (post.authorId !== userId) {
    throw new AppError("Unauthorized: Only the post author can accept claims", 403);
  }

  if (post.status === LostFoundStatus.RESOLVED) {
    throw new AppError("This post is already resolved", 400);
  }

  const claim = await findClaimByIdInDb(claimId);
  if (!claim || claim.postId !== postId) {
    throw new AppError("Claim not found on this post", 404);
  }

  if (claim.status !== LostFoundClaimStatus.PENDING) {
    throw new AppError("Only pending claims can be accepted", 400);
  }

  const result = await acceptClaimAtomicInDb(postId, claimId);

  // Send mutual handover notification emails
  if (result.acceptedClaim.claimant.email) {
    sendEmail({
      to: result.acceptedClaim.claimant.email,
      subject: `Claim Accepted! Handover Details for: ${post.title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #10b981; border-radius: 12px;">
          <h2 style="color: #10b981;">Your Claim Was Accepted!</h2>
          <p>Congratulations! The owner has verified your claim for <strong>"${post.title}"</strong>.</p>
          <div style="background-color: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #bbf7d0;">
            <h3 style="margin-top: 0; color: #166534;">Safe Handover Contact</h3>
            <p style="margin: 4px 0;"><strong>Name:</strong> ${result.post.author.name}</p>
            <p style="margin: 4px 0;"><strong>Email:</strong> ${result.post.author.email}</p>
            ${result.post.author.phoneNumber ? `<p style="margin: 4px 0;"><strong>Phone:</strong> ${result.post.author.phoneNumber}</p>` : ""}
          </div>
          <p style="color: #64748b; font-size: 13px;">Safety tip: Always meet in a populated, public area on campus (such as the Central Library or Department Office) for item handovers.</p>
        </div>
      `,
    }).catch((err) => console.error("Failed to email accepted claimant:", err));
  }

  if (result.post.author.email) {
    sendEmail({
      to: result.post.author.email,
      subject: `Claim Finalized: Handover Details for ${post.title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #0284c7; border-radius: 12px;">
          <h2 style="color: #0284c7;">Claim Accepted & Post Resolved</h2>
          <p>You have accepted <strong>${result.acceptedClaim.claimant.name}</strong>'s claim for <strong>"${post.title}"</strong>.</p>
          <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #e2e8f0;">
            <h3 style="margin-top: 0; color: #0f172a;">Claimant Contact Details</h3>
            <p style="margin: 4px 0;"><strong>Name:</strong> ${result.acceptedClaim.claimant.name}</p>
            <p style="margin: 4px 0;"><strong>Email:</strong> ${result.acceptedClaim.claimant.email}</p>
            ${result.acceptedClaim.claimant.phoneNumber ? `<p style="margin: 4px 0;"><strong>Phone:</strong> ${result.acceptedClaim.claimant.phoneNumber}</p>` : ""}
          </div>
          <p style="color: #64748b; font-size: 13px;">Safety tip: Always meet in a populated, public area on campus (such as the Central Library or Department Office) for item handovers.</p>
        </div>
      `,
    }).catch((err) => console.error("Failed to email post author:", err));
  }

  return result;
};

export const rejectClaimService = async (
  postId: string,
  claimId: string,
  userId: string
) => {
  const post = await findLostFoundPostByIdInDb(postId);
  if (!post) {
    throw new AppError("Lost & Found post not found", 404);
  }

  if (post.authorId !== userId) {
    throw new AppError("Unauthorized: Only the post author can reject claims", 403);
  }

  const claim = await findClaimByIdInDb(claimId);
  if (!claim || claim.postId !== postId) {
    throw new AppError("Claim not found on this post", 404);
  }

  if (claim.status !== LostFoundClaimStatus.PENDING) {
    throw new AppError("Only pending claims can be rejected", 400);
  }

  const updatedClaim = await rejectClaimInDb(claimId);

  // Notify claimant via Brevo
  if (claim.claimant.email) {
    sendEmail({
      to: claim.claimant.email,
      subject: `Claim Update: ${post.title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ef4444; border-radius: 12px;">
          <h2 style="color: #ef4444;">Claim Status Update</h2>
          <p>Hi ${claim.claimant.name},</p>
          <p>The owner of <strong>"${post.title}"</strong> has reviewed your claim and marked it as not verified.</p>
          <p>If you believe this was in error or you have additional details, check the post in the app.</p>
        </div>
      `,
    }).catch((err) => console.error("Failed to email claimant regarding rejection:", err));
  }

  return updatedClaim;
};

export const withdrawClaimService = async (
  postId: string,
  claimId: string,
  userId: string
) => {
  const claim = await findClaimByIdInDb(claimId);
  if (!claim || claim.postId !== postId) {
    throw new AppError("Claim not found on this post", 404);
  }

  if (claim.claimantId !== userId) {
    throw new AppError("Unauthorized: You can only withdraw your own claim", 403);
  }

  if (claim.status === LostFoundClaimStatus.ACCEPTED) {
    throw new AppError("Cannot withdraw an accepted claim", 400);
  }

  await withdrawClaimInDb(claimId);
  return { message: "Claim withdrawn successfully" };
};

