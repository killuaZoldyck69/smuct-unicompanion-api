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

  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: urlValidator,
  TRUSTED_ORIGINS: z.string().optional(),

  FRONTEND_URL: urlValidator,
  BREVO_API_KEY: z.string().min(1, "Brevo API key is required"),

  SMTP_HOST: z.string().default("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().default(465),
  SMTP_USER: z.string().email(),
  SMTP_PASS: z.string().min(16),
  EMAIL_FROM: z.string().email(),

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
