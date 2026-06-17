import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const urlValidator = z.string().refine(
  (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },
  { message: "Invalid URL format" },
);

const envSchema = z.object({
  DATABASE_URL: urlValidator.describe("Transaction pooler URL for app queries"),
  DIRECT_URL: urlValidator.describe(
    "Direct connection URL for Prisma migrations",
  ),

  BETTER_AUTH_SECRET: z
    .string()
    .min(
      32,
      "Better Auth Secret must be at least 32 characters long for security",
    ),
  BETTER_AUTH_URL: urlValidator,
  TRUSTED_ORIGINS: z.string().optional(),

  PORT: z.coerce.number().default(5000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

export type EnvConfig = z.infer<typeof envSchema>;

let parsedEnv: EnvConfig;

try {
  parsedEnv = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("❌ Invalid Environment Variables:");
    error.issues.forEach((issue) => {
      console.error(`   - ${issue.path.join(".")}: ${issue.message}`);
    });
  } else {
    console.error("❌ Environment validation failed:", error);
  }
  process.exit(1);
}

export const envConfig = parsedEnv;
