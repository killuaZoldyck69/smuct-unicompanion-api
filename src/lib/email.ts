// src/lib/email.ts
import nodemailer from "nodemailer";
import { envConfig } from "../config/env";

// Configure Nodemailer for Gmail
const transporter = nodemailer.createTransport({
  service: "gmail", // Nodemailer has built-in support for Gmail
  auth: {
    user: envConfig.SMTP_USER,
    pass: envConfig.SMTP_PASS,
  },
});

type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
};

export const sendEmail = async (options: SendEmailOptions) => {
  try {
    const info = await transporter.sendMail({
      from: `"SMUCT UniCompanion" <${envConfig.EMAIL_FROM}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    console.log(
      `✅ Email sent successfully to ${options.to} (Message ID: ${info.messageId})`,
    );
    return true;
  } catch (error) {
    console.error(`❌ Error sending email to ${options.to}:`, error);
    return false;
  }
};
