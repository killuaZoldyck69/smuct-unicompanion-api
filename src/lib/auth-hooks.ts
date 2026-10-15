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
 * Centralized Better Auth Pre-Execution Security Middleware
 */
export const authBeforeHook = createAuthMiddleware(async (ctx) => {
  const path = ctx.path;
  const body = ctx.body as Record<string, any> | undefined;

  // 1. Registration security & duplicate profile checks
  if (path === "/sign-up/email" || path.endsWith("/sign-up/email")) {
    await handleSignUpSecurity(body);
  }

  // 2. Strict password validation for password creation and updates
  const isPasswordPath =
    path === "/sign-up/email" ||
    path === "/reset-password" ||
    path === "/change-password" ||
    path === "/email-otp/reset-password" ||
    path.endsWith("/reset-password");

  if (isPasswordPath) {
    handlePasswordValidation(body);
  }
});
