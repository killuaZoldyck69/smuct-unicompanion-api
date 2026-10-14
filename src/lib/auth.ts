import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { bearer, emailOTP } from "better-auth/plugins";
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
  },

  emailVerification: {
    sendOnSignUp: false, // Managed by emailOTP plugin
    autoSignInAfterVerification: true, // Seamlessly logs user in so they route straight to Onboard screen
  },

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // 1. Sign-up defense: strip role injection & enforce completed-profile duplicate policy
      if (
        ctx.path === "/sign-up/email" ||
        ctx.path.endsWith("/sign-up/email")
      ) {
        const body = ctx.body as Record<string, any> | undefined;

        // PRIVILEGE ESCALATION DEFENSE:
        // Strip client-supplied role so public callers can never self-assign ADMIN or TEACHER roles
        if (body && typeof body === "object") {
          delete body.role;
        }

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
            include: {
              studentProfile: true,
              teacherProfile: true,
            },
          });

          if (existingUser) {
            // An email is strictly taken ONLY after full completion of profile
            const isProfileComplete =
              existingUser.studentProfile !== null ||
              existingUser.teacherProfile !== null ||
              existingUser.role === "TEACHER" ||
              existingUser.role === "ADMIN";

            if (isProfileComplete) {
              throw new APIError("BAD_REQUEST", {
                message:
                  "An account with this email address already exists. Please log in instead.",
              });
            }

            // If account was abandoned before verification or onboarding completion,
            // clean up stale row to allow fresh registration & fresh OTP dispatch
            await prisma.user.delete({
              where: { id: existingUser.id },
            });
          }
        }
      }

      // 2. Password complexity validation for sign-up, reset-password, and email-otp reset
      if (
        ctx.path === "/sign-up/email" ||
        ctx.path === "/reset-password" ||
        ctx.path === "/change-password" ||
        ctx.path === "/email-otp/reset-password" ||
        ctx.path.endsWith("/reset-password")
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

  plugins: [
    bearer(),
    emailOTP({
      expiresIn: 180, // 3 minutes validity
      sendVerificationOnSignUp: true,
      async sendVerificationOTP({ email, otp, type }) {
        const normalizedEmail = email.toLowerCase().trim();

        // Defense-in-depth: Never send verification OTP if user is verified TEACHER
        const existingUser = await prisma.user.findFirst({
          where: {
            email: { equals: normalizedEmail, mode: "insensitive" },
          },
        });
        if (existingUser?.role === "TEACHER" && existingUser.emailVerified) {
          return;
        }

        if (type === "email-verification") {
          await sendEmail({
            to: normalizedEmail,
            subject: "Your SMUCT UniCompanion Verification Code 🚀",
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0;">
                <div style="text-align: center; margin-bottom: 24px;">
                  <h1 style="color: #131b2e; font-size: 24px; font-weight: 800; margin: 0 0 8px;">SMUCT UniCompanion</h1>
                  <p style="color: #64748b; font-size: 15px; margin: 0;">Verify your academic account</p>
                </div>
                <div style="background: #f8fafc; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px; border: 1px solid #e2e8f0;">
                  <p style="color: #475569; font-size: 14px; margin: 0 0 12px;">Here is your 6-digit verification code:</p>
                  <div style="font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #131b2e; font-family: monospace; padding: 8px 0;">
                    ${otp}
                  </div>
                  <p style="color: #94a3b8; font-size: 13px; margin: 12px 0 0;">Expires in 3 minutes</p>
                </div>
                <p style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0 0 8px;">
                  Enter this code in your mobile application to verify your account and proceed to onboarding.
                </p>
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                  If you did not request this verification code, please ignore this email.
                </p>
              </div>
            `,
          });
        } else if (type === "forget-password") {
          await sendEmail({
            to: normalizedEmail,
            subject: "Reset Your Password - SMUCT UniCompanion 🔒",
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0;">
                <div style="text-align: center; margin-bottom: 24px;">
                  <h1 style="color: #131b2e; font-size: 24px; font-weight: 800; margin: 0 0 8px;">SMUCT UniCompanion</h1>
                  <p style="color: #64748b; font-size: 15px; margin: 0;">Password Reset Code</p>
                </div>
                <div style="background: #f8fafc; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px; border: 1px solid #e2e8f0;">
                  <p style="color: #475569; font-size: 14px; margin: 0 0 12px;">Use the following 6-digit code to reset your password:</p>
                  <div style="font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #131b2e; font-family: monospace; padding: 8px 0;">
                    ${otp}
                  </div>
                  <p style="color: #94a3b8; font-size: 13px; margin: 12px 0 0;">Expires in 3 minutes</p>
                </div>
                <p style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0 0 8px;">
                  Enter this code along with your new password in the mobile app.
                </p>
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                  If you did not request a password reset, your account remains secure and you can safely ignore this email.
                </p>
              </div>
            `,
          });
        }
      },
    }),
  ],
});

