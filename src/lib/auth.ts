import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer, emailOTP } from "better-auth/plugins";
import { prisma } from "./prisma";
import { envConfig } from "../config/env";
import { authBeforeHook } from "./auth-hooks";
import { sendAuthVerificationOTP } from "../services/auth-email.service";

// Parse trusted origins safely from environment variables
const parsedTrustedOrigins = envConfig.TRUSTED_ORIGINS
  ? envConfig.TRUSTED_ORIGINS.split(",").map((url) => url.trim())
  : [];

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  trustedOrigins: [
    "smuct-unicompanion://",
    envConfig.FRONTEND_URL,
    ...parsedTrustedOrigins,
  ].filter(Boolean),

  user: {
    additionalFields: {
      role: { type: "string", required: true, defaultValue: "STUDENT", input: false },
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
    autoSignInAfterVerification: true, // Seamless transition to onboarding after verification
  },

  hooks: {
    before: authBeforeHook,
  },

  plugins: [
    bearer(),
    emailOTP({
      expiresIn: 180, // 3 minutes validity window
      sendVerificationOnSignUp: true,
      sendVerificationOTP: sendAuthVerificationOTP,
    }),
  ],
});
