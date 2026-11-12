import { APIError } from "better-auth/api";
import { maskEmail, sendEmail } from "../lib/email";
import { prisma } from "../lib/prisma";

export const UNICOMPANION_SPLASH_LOGO_URL =
  "https://res.cloudinary.com/gzgfeoqn/image/upload/v1794486793/smuct-unicompanion/branding/unicompanion-splash-logo.png";

export const DEVELOPER_CREDIT = {
  name: "Nahid Hassan Tanver",
  githubUrl: "https://github.com/killuaZoldyck69",
  linkedInUrl: "https://www.linkedin.com/in/nahid-hassan-tanver-582132436",
} as const;

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderEmailBrandHeader(badgeText: string, subtitleText: string): string {
  return `
    <div style="text-align: center; padding-bottom: 22px; border-bottom: 1px solid #e2e8f0; margin-bottom: 24px;">
      <div style="margin: 0 auto 14px; width: 76px; height: 76px;">
        <img
          src="${UNICOMPANION_SPLASH_LOGO_URL}"
          width="76"
          height="76"
          alt="SMUCT UniCompanion Logo"
          style="display: block; width: 76px; height: 76px; margin: 0 auto; border: 0; outline: none; text-decoration: none; border-radius: 20px;"
        />
      </div>
      <div style="display: inline-block; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 999px; padding: 4px 12px; font-size: 11px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: #1d4ed8; margin-bottom: 10px;">
        ${escapeHtml(badgeText)}
      </div>
      <h1 style="color: #0f172a; font-size: 24px; font-weight: 800; margin: 0 0 6px; letter-spacing: -0.5px; line-height: 1.25;">
        SMUCT UniCompanion
      </h1>
      <p style="color: #64748b; font-size: 13.5px; font-weight: 500; margin: 0; line-height: 1.4;">
        ${escapeHtml(subtitleText)}
      </p>
    </div>
  `.trim();
}

function renderEmailFooter(securityNote: string): string {
  return `
    <div style="border-top: 1px solid #e2e8f0; padding-top: 18px; margin-top: 22px;">
      <p style="color: #64748b; font-size: 12.5px; line-height: 1.55; margin: 0 0 16px;">
        ${escapeHtml(securityNote)}
      </p>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; text-align: center;">
        <p style="margin: 0 0 4px; font-size: 12px; font-weight: 700; color: #0f172a;">
          SMUCT UniCompanion • Shanto-Mariam University of Creative Technology
        </p>
        <p style="margin: 0 0 12px; font-size: 11.5px; color: #64748b;">
          Uttara, Dhaka, Bangladesh
        </p>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 12px;">
          <p style="margin: 0 0 10px; font-size: 12px; color: #475569;">
            Developed by <strong style="color: #0f172a;">${DEVELOPER_CREDIT.name}</strong>
          </p>
          <div>
            <a
              href="${DEVELOPER_CREDIT.githubUrl}"
              target="_blank"
              rel="noopener noreferrer"
              style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; font-size: 12px; font-weight: 700; padding: 7px 14px; border-radius: 999px; margin: 0 4px;"
            >
              GitHub
            </a>
            <a
              href="${DEVELOPER_CREDIT.linkedInUrl}"
              target="_blank"
              rel="noopener noreferrer"
              style="display: inline-block; background-color: #0a66c2; color: #ffffff; text-decoration: none; font-size: 12px; font-weight: 700; padding: 7px 14px; border-radius: 999px; margin: 0 4px;"
            >
              LinkedIn
            </a>
          </div>
        </div>
      </div>
    </div>
  `.trim();
}

/**
 * HTML Email Template for Email Verification OTP
 */
export function renderVerificationOtpEmail(otp: string): string {
  const safeOtp = escapeHtml(otp);
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="x-apple-disable-message-reformatting">
      <title>Verify Your SMUCT UniCompanion Account</title>
    </head>
    <body style="margin: 0; padding: 16px 10px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
      <div style="max-width: 480px; margin: 0 auto; padding: 28px 20px; background-color: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);">
        ${renderEmailBrandHeader(
          "Account Verification",
          "Your campus life, organized in one place.",
        )}

        <div style="margin-bottom: 20px; text-align: center;">
          <h2 style="color: #0f172a; font-size: 18px; font-weight: 700; margin: 0 0 8px;">
            Verify Your Email Address
          </h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.55; margin: 0;">
            Welcome to SMUCT UniCompanion! Enter the 6-digit verification code below in the mobile app to activate your account and complete student onboarding.
          </p>
        </div>

        <div style="background-color: #f8fafc; border-radius: 16px; padding: 20px 16px; text-align: center; margin-bottom: 20px; border: 1px solid #cbd5e1;">
          <p style="color: #475569; font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px;">
            One-Time Verification Code
          </p>
          <div style="background-color: #ffffff; border: 1.5px solid #93c5fd; border-radius: 12px; padding: 14px 10px; margin: 0 auto 12px; max-width: 280px;">
            <div style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #0f172a; font-family: 'Courier New', Courier, monospace; line-height: 1.2;">
              ${safeOtp}
            </div>
          </div>
          <p style="color: #64748b; font-size: 12.5px; font-weight: 600; margin: 0;">
            ⏱️ Valid for 5 minutes • Do not share this code
          </p>
        </div>

        <div style="background-color: #eff6ff; border-radius: 12px; padding: 14px 16px; border: 1px solid #dbeafe;">
          <p style="margin: 0 0 6px; font-size: 12.5px; font-weight: 700; color: #1e3a8a;">
            Next Steps:
          </p>
          <p style="margin: 0; font-size: 13px; line-height: 1.55; color: #334155;">
            1. Open the <strong>SMUCT UniCompanion</strong> mobile app.<br/>
            2. Enter the 6-digit verification code above.<br/>
            3. Complete your academic profile to access your routine, course hubs, and campus services.
          </p>
        </div>

        ${renderEmailFooter(
          "If you did not create an account on SMUCT UniCompanion, please ignore this email. No further action is required and your email address will not be used.",
        )}
      </div>
    </body>
    </html>
  `.trim();
}

/**
 * HTML Email Template for Password Reset OTP
 */
export function renderPasswordResetOtpEmail(otp: string): string {
  const safeOtp = escapeHtml(otp);
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="x-apple-disable-message-reformatting">
      <title>Reset Your SMUCT UniCompanion Password</title>
    </head>
    <body style="margin: 0; padding: 16px 10px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
      <div style="max-width: 480px; margin: 0 auto; padding: 28px 20px; background-color: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);">
        ${renderEmailBrandHeader(
          "Security & Password Reset",
          "Your campus life, organized in one place.",
        )}

        <div style="margin-bottom: 20px; text-align: center;">
          <h2 style="color: #0f172a; font-size: 18px; font-weight: 700; margin: 0 0 8px;">
            Password Reset Request
          </h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.55; margin: 0;">
            We received a request to reset the password for your SMUCT UniCompanion account. Use the 6-digit security code below to set a new password.
          </p>
        </div>

        <div style="background-color: #f8fafc; border-radius: 16px; padding: 20px 16px; text-align: center; margin-bottom: 20px; border: 1px solid #cbd5e1;">
          <p style="color: #475569; font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px;">
            Password Reset Code
          </p>
          <div style="background-color: #ffffff; border: 1.5px solid #93c5fd; border-radius: 12px; padding: 14px 10px; margin: 0 auto 12px; max-width: 280px;">
            <div style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #0f172a; font-family: 'Courier New', Courier, monospace; line-height: 1.2;">
              ${safeOtp}
            </div>
          </div>
          <p style="color: #64748b; font-size: 12.5px; font-weight: 600; margin: 0;">
            ⏱️ Valid for 5 minutes • Single-use security code
          </p>
        </div>

        <div style="background-color: #fffbeb; border-radius: 12px; padding: 14px 16px; border: 1px solid #fde68a;">
          <p style="margin: 0 0 4px; font-size: 12.5px; font-weight: 700; color: #92400e;">
            🔒 Security Notice
          </p>
          <p style="margin: 0; font-size: 13px; line-height: 1.55; color: #78350f;">
            Enter this code along with your new password in the <strong>SMUCT UniCompanion</strong> mobile app. University staff will never ask you for this code.
          </p>
        </div>

        ${renderEmailFooter(
          "If you did not request a password reset, you can safely disregard this email. Your account remains secure and no changes were made.",
        )}
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
 * Tracks timestamps of successfully delivered verification OTP emails so
 * unverified re-registration cannot overwrite an active OTP in progress,
 * while failed email deliveries never lock the user out from retrying.
 */
const lastVerificationOtpDeliveredAt = new Map<string, number>();
const MAX_TRACKED_OTP_EMAILS = 5_000;
export const UNVERIFIED_OTP_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

export function recordVerificationOtpDelivered(
  email: string,
  nowMs: number = Date.now(),
): void {
  const key = email.toLowerCase().trim();
  if (lastVerificationOtpDeliveredAt.size >= MAX_TRACKED_OTP_EMAILS) {
    const cutoff = nowMs - UNVERIFIED_OTP_COOLDOWN_MS;
    for (const [k, ts] of lastVerificationOtpDeliveredAt.entries()) {
      if (ts < cutoff) {
        lastVerificationOtpDeliveredAt.delete(k);
      }
    }
  }
  lastVerificationOtpDeliveredAt.set(key, nowMs);
}

export function clearVerificationOtpDelivered(email: string): void {
  lastVerificationOtpDeliveredAt.delete(email.toLowerCase().trim());
}

export function hasActiveVerificationOtpCooldown(
  email: string,
  nowMs: number = Date.now(),
  cooldownMs: number = UNVERIFIED_OTP_COOLDOWN_MS,
): boolean {
  const key = email.toLowerCase().trim();
  const sentAt = lastVerificationOtpDeliveredAt.get(key);
  if (!sentAt) return false;
  if (nowMs - sentAt >= cooldownMs) {
    lastVerificationOtpDeliveredAt.delete(key);
    return false;
  }
  return true;
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
  const masked = maskEmail(normalizedEmail);

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
    (existingUser?.role === "TEACHER" &&
      existingUser.emailVerified &&
      type === "email-verification") ||
    (pendingTeacherRegistrationEmails.has(normalizedEmail) &&
      type === "email-verification")
  ) {
    console.log(`[AuthEmail] Skipping verification OTP for teacher: ${masked}`);
    return;
  }

  let delivered = false;
  if (type === "email-verification") {
    delivered = await sendEmail({
      to: normalizedEmail,
      subject: "Your SMUCT UniCompanion Verification Code 🚀",
      html: renderVerificationOtpEmail(otp),
    });
    if (delivered) {
      recordVerificationOtpDelivered(normalizedEmail);
    } else {
      clearVerificationOtpDelivered(normalizedEmail);
    }
  } else if (type === "forget-password") {
    delivered = await sendEmail({
      to: normalizedEmail,
      subject: "Reset Your Password - SMUCT UniCompanion 🔒",
      html: renderPasswordResetOtpEmail(otp),
    });
  } else {
    console.warn(`[AuthEmail] Unhandled OTP email type: ${type} for ${masked}`);
    return;
  }

  if (!delivered) {
    throw new APIError("SERVICE_UNAVAILABLE", {
      message:
        "Unable to send verification email right now. Please try again shortly.",
    });
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
export function renderTeacherWelcomeEmail(
  data: TeacherWelcomeEmailPayload,
): string {
  const safeName = escapeHtml(data.name);
  const safeEmail = escapeHtml(data.email);
  const safeTeacherId = escapeHtml(data.teacherId);
  const safePassword = escapeHtml(data.temporaryPassword);
  const safeDesignation = escapeHtml(data.designation);
  const safeDepartment = escapeHtml(data.department);
  const safeFaculty = escapeHtml(data.faculty);
  const safeOfficeRoom = data.officeRoom ? escapeHtml(data.officeRoom) : "";

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="x-apple-disable-message-reformatting">
      <title>Welcome to SMUCT UniCompanion - Faculty Account Credentials</title>
    </head>
    <body style="margin: 0; padding: 16px 10px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
      <div style="max-width: 520px; margin: 0 auto; padding: 28px 20px; background-color: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);">
        ${renderEmailBrandHeader(
          "Faculty & Academic Staff Portal",
          "Your campus life, organized in one place.",
        )}

        <div style="margin-bottom: 20px;">
          <p style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 10px;">
            Dear ${safeName},
          </p>
          <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0;">
            Welcome to Shanto-Mariam University of Creative Technology's digital campus platform. Your faculty account has been provisioned by the university administration. You can now manage your class schedules, course hubs, and student consultations through the <strong>SMUCT UniCompanion</strong> mobile app.
          </p>
        </div>

        <!-- Faculty Profile Summary Card -->
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 14px; padding: 16px; margin-bottom: 18px;">
          <div style="font-size: 11.5px; font-weight: 700; text-transform: uppercase; color: #475569; letter-spacing: 0.8px; margin-bottom: 12px;">
            Academic Profile Summary
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
            <tr>
              <td style="padding: 5px 0; color: #64748b; width: 120px; vertical-align: top;">Teacher ID:</td>
              <td style="padding: 5px 0; color: #0f172a; font-weight: 700;">${safeTeacherId}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #64748b; vertical-align: top;">Designation:</td>
              <td style="padding: 5px 0; color: #0f172a; font-weight: 600;">${safeDesignation}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #64748b; vertical-align: top;">Department:</td>
              <td style="padding: 5px 0; color: #0f172a; font-weight: 600;">${safeDepartment}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #64748b; vertical-align: top;">Faculty:</td>
              <td style="padding: 5px 0; color: #0f172a; font-weight: 600;">${safeFaculty}</td>
            </tr>
            ${
              safeOfficeRoom
                ? `
            <tr>
              <td style="padding: 5px 0; color: #64748b; vertical-align: top;">Office Room:</td>
              <td style="padding: 5px 0; color: #0f172a; font-weight: 600;">${safeOfficeRoom}</td>
            </tr>
            `
                : ""
            }
          </table>
        </div>

        <!-- Credentials Box -->
        <div style="background-color: #ecfdf5; border: 1.5px solid #6ee7b7; border-radius: 14px; padding: 16px; margin-bottom: 18px;">
          <div style="font-size: 12.5px; font-weight: 700; color: #065f46; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.6px;">
            🔑 Your Initial Login Credentials
          </div>

          <div style="margin-bottom: 12px;">
            <span style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">
              Registered Email:
            </span>
            <div style="background-color: #ffffff; border: 1px solid #a7f3d0; border-radius: 10px; padding: 10px 12px; font-size: 13.5px; font-weight: 600; color: #0f172a; word-break: break-all;">
              ${safeEmail}
            </div>
          </div>

          <div>
            <span style="display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">
              Temporary Password:
            </span>
            <div style="background-color: #ffffff; border: 1px solid #a7f3d0; border-radius: 10px; padding: 10px 12px; font-size: 15px; font-weight: 800; color: #047857; font-family: 'Courier New', Courier, monospace; letter-spacing: 1px; word-break: break-all;">
              ${safePassword}
            </div>
          </div>
        </div>

        <!-- Security Warning Alert -->
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 0 12px 12px 0; padding: 14px 16px;">
          <p style="margin: 0 0 4px; font-size: 12.5px; font-weight: 700; color: #991b1b;">
            ⚠️ Mandatory Password Update
          </p>
          <p style="margin: 0; font-size: 13px; line-height: 1.55; color: #b91c1c;">
            This temporary password is for your initial sign-in only. For institutional security, please <strong>update your password immediately</strong> after signing in via the SMUCT UniCompanion app.
          </p>
        </div>

        ${renderEmailFooter(
          "This is an automated institutional notification from SMUCT UniCompanion Administration. Do not share your login credentials with anyone.",
        )}
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
