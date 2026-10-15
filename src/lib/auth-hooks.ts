import { createAuthMiddleware, APIError } from "better-auth/api";
import { prisma } from "./prisma";
import { validatePassword } from "../utils/password-validator";

/**
 * Enforces role lockdown and abandoned-account cleanup during public registration.
 */
async function handleSignUpSecurity(body?: Record<string, any>): Promise<void> {
  if (!body || typeof body !== "object") return;

  // 1. PRIVILEGE ESCALATION DEFENSE:
  // Public registrations are strictly assigned the STUDENT role.
  // Administrative or Faculty roles can never be self-assigned via the public API.
  body.role = "STUDENT";

  const email = body.email;
  if (!email || typeof email !== "string") return;

  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: "insensitive",
      },
    },
    include: {
      studentProfile: true,
      teacherProfile: true,
    },
  });

  if (!existingUser) return;

  // An email is considered permanently taken ONLY if the user has an active/completed profile
  const isProfileComplete =
    existingUser.studentProfile !== null ||
    existingUser.teacherProfile !== null ||
    existingUser.role === "TEACHER" ||
    existingUser.role === "ADMIN";

  if (isProfileComplete) {
    throw new APIError("BAD_REQUEST", {
      message: "An account with this email address already exists. Please log in instead.",
    });
  }

  // If the account was abandoned before email verification or onboarding completion,
  // purge the stale record to ensure clean re-registration and fresh OTP generation.
  await prisma.user.delete({
    where: { id: existingUser.id },
  });
}

/**
 * Validates password complexity requirements against institutional policy.
 */
function handlePasswordValidation(body?: Record<string, any>): void {
  const password = body?.password || body?.newPassword;
  if (!password || typeof password !== "string") return;

  const result = validatePassword(password);
  if (!result.isValid) {
    throw new APIError("BAD_REQUEST", {
      message:
        result.error ||
        "Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character.",
    });
  }
}

/**
 * Validates that an existing, verified account exists before dispatching a password reset OTP.
 * Prevents misleading success feedback and improves UX when an unregistered email is entered.
 */
async function handlePasswordResetRequest(body?: Record<string, any>): Promise<void> {
  const email = body?.email;
  if (!email || typeof email !== "string") {
    throw new APIError("BAD_REQUEST", {
      message: "Email address is required.",
    });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      email: true,
      emailVerified: true,
    },
  });

  if (!existingUser) {
    throw new APIError("BAD_REQUEST", {
      message: "No account found with this email address. Please register or check for typos.",
    });
  }

  if (!existingUser.emailVerified) {
    throw new APIError("BAD_REQUEST", {
      message: "This account has not been verified yet. Please complete verification or register again.",
    });
  }
}

/**
 * Validates account existence when requesting a verification OTP resend.
 */
async function handleVerificationOtpRequest(body?: Record<string, any>): Promise<void> {
  const email = body?.email;
  if (!email || typeof email !== "string") {
    throw new APIError("BAD_REQUEST", {
      message: "Email address is required.",
    });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      emailVerified: true,
    },
  });

  if (!existingUser) {
    throw new APIError("BAD_REQUEST", {
      message: "No account found with this email address. Please register first.",
    });
  }

  if (existingUser.emailVerified) {
    throw new APIError("BAD_REQUEST", {
      message: "This email address is already verified. Please log in directly.",
    });
  }
}

/**
 * Centralized Better Auth Pre-Execution Security Middleware
 */
export const authBeforeHook = createAuthMiddleware(async (ctx) => {
  const rawPath = ctx.path || "";
  const cleanPath = rawPath.split("?")[0].replace(/\/+$/, "");
  const body = ctx.body as Record<string, any> | undefined;

  // 1. Registration security & duplicate profile checks
  if (cleanPath === "/sign-up/email" || cleanPath.endsWith("/sign-up/email")) {
    await handleSignUpSecurity(body);
  }

  // 2. Strict password validation for password creation and updates
  const isPasswordPath =
    cleanPath === "/sign-up/email" ||
    cleanPath === "/reset-password" ||
    cleanPath === "/change-password" ||
    cleanPath === "/email-otp/reset-password" ||
    cleanPath.endsWith("/reset-password");

  if (isPasswordPath) {
    handlePasswordValidation(body);
  }

  // 3. Password reset request verification: ensure account exists before sending OTP
  const isPasswordResetRequest =
    cleanPath === "/email-otp/request-password-reset" ||
    cleanPath.endsWith("/email-otp/request-password-reset") ||
    cleanPath === "/forget-password/email-otp" ||
    cleanPath.endsWith("/forget-password/email-otp") ||
    cleanPath === "/forget-password" ||
    cleanPath.endsWith("/forget-password") ||
    (cleanPath.includes("send-verification-otp") && body?.type === "forget-password");

  if (isPasswordResetRequest) {
    await handlePasswordResetRequest(body);
  }

  // 4. Email verification OTP resend verification: ensure account exists and is unverified
  const isEmailVerificationOtpRequest =
    (cleanPath === "/email-otp/send-verification-otp" ||
      cleanPath.endsWith("/email-otp/send-verification-otp")) &&
    body?.type === "email-verification";

  if (isEmailVerificationOtpRequest) {
    await handleVerificationOtpRequest(body);
  }
});
