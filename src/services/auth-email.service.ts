import { sendEmail } from "../lib/email";
import { prisma } from "../lib/prisma";

/**
 * HTML Email Template for Email Verification OTP
 */
export function renderVerificationOtpEmail(otp: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Verification</title>
    </head>
    <body style="margin: 0; padding: 24px 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <div style="max-width: 520px; margin: 0 auto; padding: 36px 28px; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="text-align: center; margin-bottom: 28px;">
          <h1 style="color: #131b2e; font-size: 24px; font-weight: 800; margin: 0 0 8px; letter-spacing: -0.5px;">SMUCT UniCompanion</h1>
          <p style="color: #64748b; font-size: 15px; margin: 0;">Verify your academic account</p>
        </div>

        <div style="background: #f8fafc; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px; border: 1px solid #e2e8f0;">
          <p style="color: #475569; font-size: 14px; margin: 0 0 12px; font-weight: 500;">Here is your 6-digit verification code:</p>
          <div style="font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #131b2e; font-family: 'Courier New', Courier, monospace; padding: 10px 0;">
            ${otp}
          </div>
          <p style="color: #94a3b8; font-size: 13px; margin: 12px 0 0;">⏱️ Valid for 3 minutes</p>
        </div>

        <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 12px;">
          Enter this code in your mobile application to verify your account and proceed to the student onboarding.
        </p>
        <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 0; border-top: 1px solid #f1f5f9; padding-top: 16px;">
          If you did not request this verification code, please disregard this email. Your account remains completely secure.
        </p>
      </div>
    </body>
    </html>
  `.trim();
}

/**
 * HTML Email Template for Password Reset OTP
 */
export function renderPasswordResetOtpEmail(otp: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
    </head>
    <body style="margin: 0; padding: 24px 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <div style="max-width: 520px; margin: 0 auto; padding: 36px 28px; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="text-align: center; margin-bottom: 28px;">
          <h1 style="color: #131b2e; font-size: 24px; font-weight: 800; margin: 0 0 8px; letter-spacing: -0.5px;">SMUCT UniCompanion</h1>
          <p style="color: #64748b; font-size: 15px; margin: 0;">Password Reset Request</p>
        </div>

        <div style="background: #f8fafc; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px; border: 1px solid #e2e8f0;">
          <p style="color: #475569; font-size: 14px; margin: 0 0 12px; font-weight: 500;">Use the following 6-digit code to reset your password:</p>
          <div style="font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #131b2e; font-family: 'Courier New', Courier, monospace; padding: 10px 0;">
            ${otp}
          </div>
          <p style="color: #94a3b8; font-size: 13px; margin: 12px 0 0;">⏱️ Valid for 3 minutes</p>
        </div>

        <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 12px;">
          Enter this code along with your new password in the UniCompanion mobile app.
        </p>
        <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 0; border-top: 1px solid #f1f5f9; padding-top: 16px;">
          If you did not request a password reset, your account remains secure and no changes were made.
        </p>
      </div>
    </body>
    </html>
  `.trim();
}

export interface SendOtpPayload {
  email: string;
  otp: string;
  type: "email-verification" | "forget-password" | string;
}

/**
 * Handles sending authentication OTP emails with robust validation and error handling.
 */
export async function sendAuthVerificationOTP({
  email,
  otp,
  type,
}: SendOtpPayload): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();

  // Defense-in-depth: Never send verification OTP if user is an existing verified TEACHER
  const existingUser = await prisma.user.findFirst({
    where: {
      email: { equals: normalizedEmail, mode: "insensitive" },
    },
    select: {
      role: true,
      emailVerified: true,
    },
  });

  if (existingUser?.role === "TEACHER" && existingUser.emailVerified && type === "email-verification") {
    console.log(`[AuthEmail] Skipping verification OTP for already verified teacher: ${normalizedEmail}`);
    return;
  }

  if (type === "email-verification") {
    await sendEmail({
      to: normalizedEmail,
      subject: "Your SMUCT UniCompanion Verification Code 🚀",
      html: renderVerificationOtpEmail(otp),
    });
  } else if (type === "forget-password") {
    await sendEmail({
      to: normalizedEmail,
      subject: "Reset Your Password - SMUCT UniCompanion 🔒",
      html: renderPasswordResetOtpEmail(otp),
    });
  } else {
    console.warn(`[AuthEmail] Unhandled OTP email type: ${type} for ${normalizedEmail}`);
  }
}
