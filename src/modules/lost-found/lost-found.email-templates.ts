import { escapeHtml } from "../../utils/html";

export function buildNewClaimEmail(params: {
  authorName: string;
  postTitle: string;
  claimantName: string;
  message: string;
}) {
  const safeAuthorName = escapeHtml(params.authorName);
  const safeTitle = escapeHtml(params.postTitle);
  const safeClaimantName = escapeHtml(params.claimantName);
  const safeMessage = escapeHtml(params.message);

  return {
    subject: `New Claim Received: ${params.postTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 12px;">
        <h2 style="color: #0284c7;">New Claim Received</h2>
        <p>Hi ${safeAuthorName},</p>
        <p>Someone has submitted a claim for your Lost & Found item <strong>"${safeTitle}"</strong>.</p>
        <div style="background-color: #f8fafc; padding: 14px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0; color: #475569;"><strong>Claimant:</strong> ${safeClaimantName}</p>
          <p style="margin: 8px 0 0 0; color: #475569;"><strong>Message:</strong> ${safeMessage}</p>
        </div>
        <p>Open SMUCT UniCompanion app to review the submitted claim and verification proof.</p>
      </div>
    `,
  };
}

export function buildHandoverClaimantEmail(params: {
  postTitle: string;
  authorName: string;
  authorEmail: string;
  authorPhone: string | null;
}) {
  const safeTitle = escapeHtml(params.postTitle);
  const safeAuthorName = escapeHtml(params.authorName);
  const safeAuthorEmail = escapeHtml(params.authorEmail);
  const safeAuthorPhone = params.authorPhone
    ? escapeHtml(params.authorPhone)
    : null;

  return {
    subject: `Claim Accepted! Handover Details for: ${params.postTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #10b981; border-radius: 12px;">
        <h2 style="color: #10b981;">Your Claim Was Accepted!</h2>
        <p>Congratulations! The owner has verified your claim for <strong>"${safeTitle}"</strong>.</p>
        <div style="background-color: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #bbf7d0;">
          <h3 style="margin-top: 0; color: #166534;">Safe Handover Contact</h3>
          <p style="margin: 4px 0;"><strong>Name:</strong> ${safeAuthorName}</p>
          <p style="margin: 4px 0;"><strong>Email:</strong> ${safeAuthorEmail}</p>
          ${safeAuthorPhone ? `<p style="margin: 4px 0;"><strong>Phone:</strong> ${safeAuthorPhone}</p>` : ""}
        </div>
        <p style="color: #64748b; font-size: 13px;">Safety tip: Always meet in a populated, public area on campus (such as the Central Library or Department Office) for item handovers.</p>
      </div>
    `,
  };
}

export function buildHandoverAuthorEmail(params: {
  postTitle: string;
  claimantName: string;
  claimantEmail: string;
  claimantPhone: string | null;
}) {
  const safeTitle = escapeHtml(params.postTitle);
  const safeClaimantName = escapeHtml(params.claimantName);
  const safeClaimantEmail = escapeHtml(params.claimantEmail);
  const safeClaimantPhone = params.claimantPhone
    ? escapeHtml(params.claimantPhone)
    : null;

  return {
    subject: `Claim Finalized: Handover Details for ${params.postTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #0284c7; border-radius: 12px;">
        <h2 style="color: #0284c7;">Claim Accepted & Post Resolved</h2>
        <p>You have accepted <strong>${safeClaimantName}</strong>'s claim for <strong>"${safeTitle}"</strong>.</p>
        <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #e2e8f0;">
          <h3 style="margin-top: 0; color: #0f172a;">Claimant Contact Details</h3>
          <p style="margin: 4px 0;"><strong>Name:</strong> ${safeClaimantName}</p>
          <p style="margin: 4px 0;"><strong>Email:</strong> ${safeClaimantEmail}</p>
          ${safeClaimantPhone ? `<p style="margin: 4px 0;"><strong>Phone:</strong> ${safeClaimantPhone}</p>` : ""}
        </div>
        <p style="color: #64748b; font-size: 13px;">Safety tip: Always meet in a populated, public area on campus (such as the Central Library or Department Office) for item handovers.</p>
      </div>
    `,
  };
}

export function buildClaimRejectedEmail(params: {
  claimantName: string;
  postTitle: string;
}) {
  const safeClaimantName = escapeHtml(params.claimantName);
  const safeTitle = escapeHtml(params.postTitle);

  return {
    subject: `Claim Update: ${params.postTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ef4444; border-radius: 12px;">
        <h2 style="color: #ef4444;">Claim Status Update</h2>
        <p>Hi ${safeClaimantName},</p>
        <p>The owner of <strong>"${safeTitle}"</strong> has reviewed your claim and marked it as not verified.</p>
        <p>If you believe this was in error or you have additional proof, check the listing in the app.</p>
      </div>
    `,
  };
}
