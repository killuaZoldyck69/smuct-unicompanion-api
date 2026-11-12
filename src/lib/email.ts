import { envConfig } from "../config/env";

type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
};

const BREVO_TIMEOUT_MS = 10_000;

/**
 * Masks an email address for safe logging without exposing full PII (API-21).
 * Example: "student223@smuct.ac.bd" -> "st***@smuct.ac.bd"
 */
export function maskEmail(email: string): string {
  const trimmed = String(email || "").trim().toLowerCase();
  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 0) return "***";
  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  if (!domain) return "***";
  const visiblePrefix = local.length <= 2 ? (local[0] ?? "*") : local.slice(0, 2);
  return `${visiblePrefix}***@${domain}`;
}

export const sendEmail = async (options: SendEmailOptions): Promise<boolean> => {
  const maskedRecipient = maskEmail(options.to);
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "api-key": envConfig.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: {
          name: "SMUCT UniCompanion",
          email: envConfig.EMAIL_FROM,
        },
        to: [
          {
            email: options.to,
          },
        ],
        subject: options.subject,
        htmlContent: options.html,
      }),
      signal: AbortSignal.timeout(BREVO_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ status: response.status }));
      console.error(`❌ Brevo API Error sending to ${maskedRecipient}:`, errorData);
      return false;
    }

    console.log(`✅ Email sent successfully via Brevo to ${maskedRecipient}`);
    return true;
  } catch (error) {
    console.error(
      `❌ Network/Server Error sending email to ${maskedRecipient}:`,
      error instanceof Error ? error.message : "Unknown error",
    );
    return false;
  }
};
