import { createAuthMiddleware, APIError } from "better-auth/api";
import { prisma } from "./prisma";
import { validatePassword } from "../utils/password-validator";
import { envConfig } from "../config/env";
import {
  evaluateDeletionGuardBlock,
  hashAccountIdentifier,
} from "../utils/account-deletion-guard";
import { hasActiveVerificationOtpCooldown } from "../services/auth-email.service";
import { consumeIdentifierRateLimit } from "../middleware/rateLimit.middleware";

const AUTH_RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const EMAIL_OTP_LIMIT_PER_WINDOW = 3;
const EMAIL_ACTION_LIMIT_PER_WINDOW = 10;

export interface ExistingSignUpUserSnapshot {
  id: string;
  role?: string | null;
  emailVerified?: boolean | null;
  isRestricted?: boolean | null;
  studentProfile?: unknown | null;
  teacherProfile?: unknown | null;
}

export type SignUpCollisionDecision =
  | { action: "allow_new" }
  | { action: "purge_stale_unverified"; userId: string }
  | { action: "forbidden"; message: string }
  | { action: "reject_existing"; message: string }
  | { action: "reject_active_otp"; message: string };

/**
 * Pure decision helper for public sign-up collisions (API-2).
 * Verified accounts (even if onboarding is still in progress) are NEVER deleted.
 */
export function evaluateSignUpAccountCollision(
  existingUser: ExistingSignUpUserSnapshot | null | undefined,
  hasRecentOtpCooldown: boolean,
): SignUpCollisionDecision {
  if (!existingUser) {
    return { action: "allow_new" };
  }

  if (existingUser.isRestricted) {
    return {
      action: "forbidden",
      message:
        "This account has been restricted by an administrator. Please contact support.",
    };
  }

  // CRITICAL (API-2): Never delete a verified account even if studentProfile is null
  // (e.g., a student who just verified their email and is filling out the Onboarding screen).
  const isProtectedAccount =
    Boolean(existingUser.emailVerified) ||
    existingUser.studentProfile !== null && existingUser.studentProfile !== undefined ||
    existingUser.teacherProfile !== null && existingUser.teacherProfile !== undefined ||
    existingUser.role === "TEACHER" ||
    existingUser.role === "ADMIN";

  if (isProtectedAccount) {
    return {
      action: "reject_existing",
      message:
        "An account with this email address already exists. Please log in instead.",
    };
  }

  if (hasRecentOtpCooldown) {
    return {
      action: "reject_active_otp",
      message:
        "A verification code was recently sent to this email. Please check your inbox or sign in to verify your account.",
    };
  }

  return {
    action: "purge_stale_unverified",
    userId: existingUser.id,
  };
}

function enforcePerEmailRateLimit(
  rawEmail: unknown,
  bucket: "auth-otp-email" | "auth-action-email",
  limit: number,
  message: string,
): void {
  if (!rawEmail || typeof rawEmail !== "string") return;
  const normalizedEmail = rawEmail.trim().toLowerCase();
  if (!normalizedEmail) return;

  const check = consumeIdentifierRateLimit(
    normalizedEmail,
    bucket,
    limit,
    AUTH_RATE_WINDOW_MS,
  );
  if (!check.allowed) {
    throw new APIError("TOO_MANY_REQUESTS", {
      message,
    });
  }
}

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
  const deletionGuard = await prisma.accountDeletionGuard.findUnique({
    where: {
      identifierHash: hashAccountIdentifier(
        "EMAIL",
        normalizedEmail,
        envConfig.BETTER_AUTH_SECRET,
      ),
    },
    select: { isPermanentlyBlocked: true, blockedUntil: true },
  });
  const guardCheck = evaluateDeletionGuardBlock(deletionGuard);
  if (guardCheck.blocked && guardCheck.message) {
    throw new APIError("FORBIDDEN", {
      message: guardCheck.message,
    });
  }

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

  const decision = evaluateSignUpAccountCollision(
    existingUser,
    hasActiveVerificationOtpCooldown(normalizedEmail),
  );

  if (decision.action === "allow_new") return;

  if (decision.action === "forbidden") {
    throw new APIError("FORBIDDEN", { message: decision.message });
  }

  if (
    decision.action === "reject_existing" ||
    decision.action === "reject_active_otp"
  ) {
    throw new APIError("BAD_REQUEST", { message: decision.message });
  }

  // Only purge if the account is unverified, has no profile, and has no active OTP cooldown
  await prisma.user.delete({
    where: { id: decision.userId },
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
      isRestricted: true,
    },
  });

  if (!existingUser) {
    throw new APIError("BAD_REQUEST", {
      message: "No account found with this email address. Please register or check for typos.",
    });
  }

  if (existingUser.isRestricted) {
    throw new APIError("FORBIDDEN", {
      message: "Your account has been restricted by an administrator. Please contact support.",
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

  // 0. Per-email rate limiting (API-8 & API-14): isolates individual accounts on shared campus NAT IPs
  const isOtpDispatchPath =
    cleanPath === "/email-otp/send-verification-otp" ||
    cleanPath.endsWith("/email-otp/send-verification-otp") ||
    cleanPath === "/email-otp/request-password-reset" ||
    cleanPath.endsWith("/email-otp/request-password-reset") ||
    cleanPath === "/forget-password/email-otp" ||
    cleanPath.endsWith("/forget-password/email-otp") ||
    cleanPath === "/forget-password" ||
    cleanPath.endsWith("/forget-password");

  if (isOtpDispatchPath) {
    enforcePerEmailRateLimit(
      body?.email,
      "auth-otp-email",
      EMAIL_OTP_LIMIT_PER_WINDOW,
      "Too many verification code requests for this email address. You can request up to 3 codes every 15 minutes.",
    );
  }

  const isAuthActionPath =
    cleanPath === "/sign-up/email" ||
    cleanPath.endsWith("/sign-up/email") ||
    cleanPath === "/sign-in/email" ||
    cleanPath.endsWith("/sign-in/email") ||
    cleanPath === "/email-otp/verify-email" ||
    cleanPath.endsWith("/email-otp/verify-email") ||
    cleanPath === "/email-otp/reset-password" ||
    cleanPath.endsWith("/email-otp/reset-password");

  if (isAuthActionPath) {
    enforcePerEmailRateLimit(
      body?.email,
      "auth-action-email",
      EMAIL_ACTION_LIMIT_PER_WINDOW,
      "Too many authentication attempts for this email address. Please try again after 15 minutes.",
    );
  }

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

  // 5. Restrict sign-in for banned/restricted accounts
  const isSignInPath =
    cleanPath === "/sign-in/email" ||
    cleanPath.endsWith("/sign-in/email") ||
    cleanPath === "/sign-in" ||
    cleanPath.endsWith("/sign-in");

  if (isSignInPath) {
    const email = body?.email;
    if (email && typeof email === "string") {
      const user = await prisma.user.findFirst({
        where: {
          email: { equals: email.toLowerCase().trim(), mode: "insensitive" },
        },
        select: { isRestricted: true },
      });
      if (user?.isRestricted) {
        throw new APIError("FORBIDDEN", {
          message:
            "Your account has been restricted by an administrator. Please contact support.",
        });
      }
    }
  }
});
