// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { bearer } from "better-auth/plugins";
import { sendEmail } from "./email";
import { envConfig } from "../config/env";

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
  plugins: [bearer()],
});
