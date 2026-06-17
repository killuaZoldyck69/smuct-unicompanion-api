import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { bearer } from "better-auth/plugins";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
      },
      phoneNumber: {
        type: "string",
        required: false,
      },
      bloodGroup: {
        type: "string",
        required: false,
      },
    },
  },

  trustedOrigins: [
    "*",
    "http://localhost:8081",
    "smuct-unicompanion://",
    "http://192.168.0.102:8081",
    "http://192.168.0.100",
  ],

  emailAndPassword: {
    enabled: true,
  },
  plugins: [bearer()],
});
