import { escapeHtml } from "../../utils/html";

function sanitizeEmailSubjectPart(value: string): string {
  return value.replace(/[\r\n\u0000-\u001F\u007F]+/g, " ").trim();
}

function wrapLostFoundEmailHtml(params: {
  borderColor: string;
  headingColor: string;
  heading: string;
  body: string;
}): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid ${params.borderColor}; border-radius: 12px;">
      <h2 style="color: ${params.headingColor};">${params.heading}</h2>
      ${params.body}
    </div>
  `;
}

function buildContactCardHtml(params: {
  heading: string;
  headingColor: string;
  bgColor: string;
  borderColor: string;
  name: string;
  email: string;
  phone: string | null;
}): string {
  const safeName = escapeHtml(params.name);
  const safeEmail = escapeHtml(params.email);
  const safePhone = params.phone ? escapeHtml(params.phone) : null;

  return `
    <div style="background-color: ${params.bgColor}; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid ${params.borderColor};">
      <h3 style="margin-top: 0; color: ${params.headingColor};">${params.heading}</h3>
      <p style="margin: 4px 0;"><strong>Name:</strong> ${safeName}</p>
      <p style="margin: 4px 0;"><strong>Email:</strong> ${safeEmail}</p>
      ${safePhone ? `<p style="margin: 4px 0;"><strong>Phone:</strong> ${safePhone}</p>` : ""}
    </div>
    <p style="color: #64748b; font-size: 13px;">Safety tip: Always meet in a populated, public area on campus (such as the Central Library or Department Office) for item handovers.</p>
  `;
}

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
    subject: `New Claim Received: ${sanitizeEmailSubjectPart(params.postTitle)}`,
    html: wrapLostFoundEmailHtml({
      borderColor: "#eaeaea",
      headingColor: "#0284c7",
      heading: "New Claim Received",
      body: `
        <p>Hi ${safeAuthorName},</p>
        <p>Someone has submitted a claim for your Lost &amp; Found item <strong>"${safeTitle}"</strong>.</p>
        <div style="background-color: #f8fafc; padding: 14px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0; color: #475569;"><strong>Claimant:</strong> ${safeClaimantName}</p>
          <p style="margin: 8px 0 0 0; color: #475569;"><strong>Message:</strong> ${safeMessage}</p>
        </div>
        <p>Open SMUCT UniCompanion app to review the submitted claim and verification proof.</p>
      `,
    }),
  };
}

export function buildHandoverClaimantEmail(params: {
  postTitle: string;
  authorName: string;
  authorEmail: string;
  authorPhone: string | null;
}) {
  const safeTitle = escapeHtml(params.postTitle);

  return {
    subject: `Claim Accepted! Handover Details for: ${sanitizeEmailSubjectPart(params.postTitle)}`,
    html: wrapLostFoundEmailHtml({
      borderColor: "#10b981",
      headingColor: "#10b981",
      heading: "Your Claim Was Accepted!",
      body: `
        <p>Congratulations! The owner has verified your claim for <strong>"${safeTitle}"</strong>.</p>
        ${buildContactCardHtml({
          heading: "Safe Handover Contact",
          headingColor: "#166534",
          bgColor: "#f0fdf4",
          borderColor: "#bbf7d0",
          name: params.authorName,
          email: params.authorEmail,
          phone: params.authorPhone,
        })}
      `,
    }),
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

  return {
    subject: `Claim Finalized: Handover Details for ${sanitizeEmailSubjectPart(params.postTitle)}`,
    html: wrapLostFoundEmailHtml({
      borderColor: "#0284c7",
      headingColor: "#0284c7",
      heading: "Claim Accepted & Post Resolved",
      body: `
        <p>You have accepted <strong>${safeClaimantName}</strong>'s claim for <strong>"${safeTitle}"</strong>.</p>
        ${buildContactCardHtml({
          heading: "Claimant Contact Details",
          headingColor: "#0f172a",
          bgColor: "#f8fafc",
          borderColor: "#e2e8f0",
          name: params.claimantName,
          email: params.claimantEmail,
          phone: params.claimantPhone,
        })}
      `,
    }),
  };
}

export function buildClaimRejectedEmail(params: {
  claimantName: string;
  postTitle: string;
}) {
  const safeClaimantName = escapeHtml(params.claimantName);
  const safeTitle = escapeHtml(params.postTitle);

  return {
    subject: `Claim Update: ${sanitizeEmailSubjectPart(params.postTitle)}`,
    html: wrapLostFoundEmailHtml({
      borderColor: "#ef4444",
      headingColor: "#ef4444",
      heading: "Claim Status Update",
      body: `
        <p>Hi ${safeClaimantName},</p>
        <p>The owner of <strong>"${safeTitle}"</strong> has reviewed your claim and marked it as not verified.</p>
        <p>If you believe this was in error or you have additional proof, check the listing in the app.</p>
      `,
    }),
  };
}
