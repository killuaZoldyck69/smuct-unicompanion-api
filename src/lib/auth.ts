import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { bearer } from "better-auth/plugins";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { sendEmail } from "./email";
import { envConfig } from "../config/env";
import { validatePassword } from "../utils/password-validator";

// 👇 Parse origins safely from the .env string
const parsedTrustedOrigins = envConfig.TRUSTED_ORIGINS
  ? envConfig.TRUSTED_ORIGINS.split(",").map((url) => url.trim())
  : [];

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  trustedOrigins: [
    "smuct-unicompanion://",
    envConfig.FRONTEND_URL,
    ...parsedTrustedOrigins,
  ],

  user: {
    additionalFields: {
      role: { type: "string", required: false },
      phoneNumber: { type: "string", required: false },
      bloodGroup: { type: "string", required: false },
    },
  },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url, token }) => {
      // Point to the redirector URL, pass 'reset-password' as the 'type'
      const resetLink = `${envConfig.FRONTEND_URL}?token=${encodeURIComponent(token)}&type=reset-password`;

      await sendEmail({
        to: user.email,
        subject: "Reset Your Password - SMUCT UniCompanion",
        html: `
      <h2>Password Reset Request</h2>
      <a href="${resetLink}" style="...">Reset Password</a>
    `,
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url, token }) => {
      if ((user as any).role === "TEACHER") return;

      // Defense-in-depth: Never send verification email if user already exists and is verified
      const existingUser = await prisma.user.findFirst({
        where: {
          email: {
            equals: user.email.toLowerCase().trim(),
            mode: "insensitive",
          },
        },
      });
      if (existingUser && existingUser.emailVerified) {
        return;
      }

      // Point to the redirector URL, pass 'verify-email' as the 'type'
      const verificationLink = `${envConfig.FRONTEND_URL}?token=${encodeURIComponent(token)}&type=verify-email`;

      await sendEmail({
        to: user.email,
        subject: "Welcome to SMUCT UniCompanion! Verify your email",
        html: `
      <h2>Welcome aboard! 🚀</h2>
      <a href="${verificationLink}" style="...">Verify My Email</a>
    `,
      });
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // 1. Strict duplicate account check: prevent duplicate user creation and fake verification emails
      if (
        ctx.path === "/sign-up/email" ||
        ctx.path.endsWith("/sign-up/email")
      ) {
        const body = ctx.body as Record<string, any> | undefined;
        const email = body?.email;
        if (email && typeof email === "string") {
          const normalizedEmail = email.toLowerCase().trim();
          const existingUser = await prisma.user.findFirst({
            where: {
              email: {
                equals: normalizedEmail,
                mode: "insensitive",
              },
            },
          });
          if (existingUser) {
            throw new APIError("BAD_REQUEST", {
              message:
                "An account with this email address already exists. Please log in instead.",
            });
          }
        }
      }

      // 2. Password complexity validation for sign-up, reset-password, and change-password
      if (
        ctx.path === "/sign-up/email" ||
        ctx.path === "/reset-password" ||
        ctx.path === "/change-password"
      ) {
        const body = ctx.body as Record<string, any> | undefined;
        const passwordToValidate = body?.password || body?.newPassword;
        if (passwordToValidate && typeof passwordToValidate === "string") {
          const result = validatePassword(passwordToValidate);
          if (!result.isValid) {
            throw new APIError("BAD_REQUEST", {
              message:
                result.error ||
                "Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.",
            });
          }
        }
      }
    }),
  },
  plugins: [bearer()],
});
