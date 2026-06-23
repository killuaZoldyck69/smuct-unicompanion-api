// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { bearer } from "better-auth/plugins";
import { sendEmail } from "./email";
import { envConfig } from "../config/env";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  // 👇 NEW: Add trustedOrigins here 👇
  trustedOrigins: [
    "http://localhost:8081",
    "http://192.168.0.102:8081", // Your current Expo network IP
    "smuct-unicompanion://", // Your deep link scheme
    envConfig.FRONTEND_URL, // Dynamically trust whatever is in your .env
  ],
  // 👆 ============================ 👆

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
      const resetLink = `${envConfig.FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;

      await sendEmail({
        to: user.email,
        subject: "Reset Your Password - SMUCT UniCompanion",
        html: `
          <h2>Password Reset Request</h2>
          <p>Hi ${user.name},</p>
          <p>Click the link below to reset your password. If you didn't request this, safely ignore this email.</p>
          <a href="${resetLink}">Reset Password</a>
        `,
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url, token }) => {
      if ((user as any).role === "TEACHER") return;

      const verificationLink = `${envConfig.FRONTEND_URL}/verify-email?token=${encodeURIComponent(token)}`;

      await sendEmail({
        to: user.email,
        subject: "Welcome to SMUCT UniCompanion! Verify your email",
        html: `
          <h2>Welcome aboard, ${user.name}! 🚀</h2>
          <p>Your student account has been created successfully.</p>
          <p>Please verify your email address to log in and access the Campus Hub:</p>
          <a href="${verificationLink}">Verify My Email</a>
        `,
      });
    },
  },
  plugins: [bearer()],
});
