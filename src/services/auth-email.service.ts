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
 * Ephemeral tracking set for pending teacher registrations initiated by Admin
 * to suppress redundant email-verification OTP dispatch.
 */
export const pendingTeacherRegistrationEmails = new Set<string>();

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
  // or is currently being created and auto-verified by an Admin
  const existingUser = await prisma.user.findFirst({
    where: {
      email: { equals: normalizedEmail, mode: "insensitive" },
    },
    select: {
      role: true,
      emailVerified: true,
    },
  });

  if (
    (existingUser?.role === "TEACHER" && existingUser.emailVerified && type === "email-verification") ||
    (pendingTeacherRegistrationEmails.has(normalizedEmail) && type === "email-verification")
  ) {
    console.log(`[AuthEmail] Skipping verification OTP for teacher: ${normalizedEmail}`);
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

export interface TeacherWelcomeEmailPayload {
  name: string;
  email: string;
  teacherId: string;
  temporaryPassword: string;
  designation: string;
  department: string;
  faculty: string;
  officeRoom?: string;
}

/**
 * HTML Email Template for Admin-created Faculty Account Welcome & Credentials
 */
export function renderTeacherWelcomeEmail(data: TeacherWelcomeEmailPayload): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to SMUCT UniCompanion - Faculty Account Credentials</title>
    </head>
    <body style="margin: 0; padding: 32px 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
      <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        
        <!-- Header Banner -->
        <div style="background: linear-gradient(135deg, #065f46 0%, #047857 100%); padding: 32px 28px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0 0 6px; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">SMUCT UniCompanion</h1>
          <p style="margin: 0; font-size: 14px; color: #a7f3d0; font-weight: 500;">Faculty & Academic Staff Portal</p>
        </div>

        <div style="padding: 32px 28px;">
          <p style="font-size: 16px; font-weight: 600; color: #0f172a; margin: 0 0 12px;">Dear ${data.name},</p>
          <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px;">
            Welcome to Shanto-Mariam University of Creative Technology's digital companion. Your faculty account has been created by the university administration. You can now access your timetable, consultation schedule, and university hub through the UniCompanion platform.
          </p>

          <!-- Faculty Profile Summary Card -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 14px;">Academic Profile Information</div>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; width: 140px;">Teacher ID:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${data.teacherId}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Designation:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${data.designation}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Department:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${data.department}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Faculty:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${data.faculty}</td>
              </tr>
              ${
                data.officeRoom
                  ? `
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Office Room:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${data.officeRoom}</td>
              </tr>
              `
                  : ""
              }
            </table>
          </div>

          <!-- Credentials Box -->
          <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <div style="font-size: 13px; font-weight: 700; color: #166534; margin-bottom: 12px;">
              🔑 Your Login Credentials
            </div>
            
            <div style="margin-bottom: 12px;">
              <span style="display: block; font-size: 12px; color: #475569; margin-bottom: 4px;">Registered Email:</span>
              <div style="background: #ffffff; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 14px; font-size: 14px; font-weight: 600; color: #0f172a;">
                ${data.email}
              </div>
            </div>

            <div>
              <span style="display: block; font-size: 12px; color: #475569; margin-bottom: 4px;">Temporary Password:</span>
              <div style="background: #ffffff; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 14px; font-size: 16px; font-weight: 700; color: #047857; font-family: 'Courier New', Courier, monospace; letter-spacing: 1px;">
                ${data.temporaryPassword}
              </div>
            </div>
          </div>

          <!-- Security Warning Alert -->
          <div style="background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 0 10px 10px 0; padding: 16px; margin-bottom: 28px;">
            <p style="margin: 0 0 6px; font-size: 13px; font-weight: 700; color: #991b1b;">
              ⚠️ IMPORTANT SECURITY WARNING:
            </p>
            <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #b91c1c;">
              This temporary password was generated by the administration for your initial login. For institutional security and protection of academic records, you <strong>MUST change your password immediately</strong> upon your first login. Do not share this temporary password with anyone.
            </p>
          </div>

          <!-- Instructions & Action -->
          <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px;">
            To log in, please open the SMUCT UniCompanion mobile application using the credentials provided above. Once logged in, navigate to your Profile settings to set a permanent, confidential password.
          </p>

          <div style="border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 12px; color: #94a3b8; line-height: 1.5;">
            <p style="margin: 0 0 4px;">This is an automated system notification from the SMUCT IT Administration.</p>
            <p style="margin: 0;">Shanto-Mariam University of Creative Technology • Uttara, Dhaka</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `.trim();
}

/**
 * Sends the welcome email with credentials and security warning to the teacher.
 */
export async function sendTeacherWelcomeEmail(
  data: TeacherWelcomeEmailPayload,
): Promise<boolean> {
  const normalizedEmail = data.email.toLowerCase().trim();

  return await sendEmail({
    to: normalizedEmail,
    subject: "Welcome to SMUCT UniCompanion - Faculty Account Credentials 🎓",
    html: renderTeacherWelcomeEmail({
      ...data,
      email: normalizedEmail,
    }),
  });
}
