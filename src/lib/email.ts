import { envConfig } from "../config/env";

type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
};

export const sendEmail = async (options: SendEmailOptions) => {
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
          email: "nh694225@gmail.com",
        },
        to: [
          {
            email: options.to,
          },
        ],
        subject: options.subject,
        htmlContent: options.html,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`❌ Brevo API Error sending to ${options.to}:`, errorData);
      return false;
    }

    console.log(`✅ Email sent successfully via Brevo to ${options.to}`);
    return true;
  } catch (error) {
    console.error(
      `❌ Network/Server Error sending email to ${options.to}:`,
      error,
    );
    return false;
  }
};
