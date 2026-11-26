import sanitizeHtml from "sanitize-html";
import { isSafeHubHttpUrl } from "../hub-attachments";

/**
 * Course Hub Stream Sanitizer & Domain Validation Constants
 *
 * Enforces XSS-safe HTML sanitization, HTTP(S)-only URL validation, and
 * consistent payload/pagination bounds aligned between API and Mobile.
 */

export const MAX_ANNOUNCEMENT_PLAIN_LENGTH = 2000;
export const MAX_ANNOUNCEMENT_HTML_LENGTH = 12000;
export const MAX_COMMENT_LENGTH = 500;
export const MAX_DISCUSSION_TITLE_LENGTH = 200;
export const MAX_DISCUSSION_CONTENT_LENGTH = 3000;
export const MAX_DISCUSSION_REPLY_LENGTH = 2000;
export const MAX_ANNOUNCEMENT_ATTACHMENTS = 5;
export const MAX_ANNOUNCEMENT_LINKS = 5;
export const MAX_LINK_TITLE_LENGTH = 200;

export const DEFAULT_ANNOUNCEMENTS_LIMIT = 50;
export const MAX_ANNOUNCEMENTS_LIMIT = 100;
export const MAX_COMMENTS_PER_ANNOUNCEMENT = 100;
export const MAX_REPLIES_PER_COMMENT = 50;
export const MAX_DISCUSSIONS_LIMIT = 50;
export const MAX_DISCUSSION_REPLIES = 100;

const ALLOWED_TAGS = [
  "p",
  "b",
  "i",
  "u",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
  "br",
  "div",
  "span",
];

const NON_TEXT_TAGS = [
  "script",
  "style",
  "textarea",
  "option",
  "noscript",
  "iframe",
  "object",
  "embed",
  "svg",
  "canvas",
  "form",
  "button",
  "input",
  "select",
];

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    p: ["style"],
    div: ["style"],
    li: ["style"],
  },
  allowedStyles: {
    "*": {
      "text-align": [/^(?:left|center|right|justify)$/i],
    },
  },
  allowedSchemes: [],
  disallowedTagsMode: "discard",
  nonTextTags: NON_TEXT_TAGS,
};

export const isSafeHttpUrl = isSafeHubHttpUrl;

/**
 * Extracts plain text from an HTML announcement snippet, safely stripping
 * dangerous tags and decoding common entities.
 */
export function extractAnnouncementPlainText(html?: string | null): string {
  if (!html) return "";

  const spaced = html
    .replace(/<\/(p|div|li|h[1-6])>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ");

  const stripped = sanitizeHtml(spaced, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: "discard",
    nonTextTags: NON_TEXT_TAGS,
  });

  return stripped
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/\s+([,.:;?!])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Sanitizes announcement HTML while preserving supported formatting tags and alignment styles.
 */
export function sanitizeAnnouncementHtml(html?: string | null): string {
  if (!html) return "";
  return sanitizeHtml(html, SANITIZE_OPTIONS)
    .replace(
      /style="text-align:\s*(left|center|right|justify)"/gi,
      (_m, dir: string) => `style="text-align: ${dir.toLowerCase()}"`,
    )
    .trim();
}

/**
 * Validates and sanitizes announcement HTML content against plain-text and HTML limits.
 */
export function validateAndSanitizeAnnouncementContent(raw?: string | null): {
  cleanHtml?: string;
  plainText?: string;
  error?: string;
} {
  if (!raw || typeof raw !== "string") {
    return { error: "Announcement content cannot be empty." };
  }

  const cleanHtml = sanitizeAnnouncementHtml(raw);
  const plainText = extractAnnouncementPlainText(cleanHtml);

  if (plainText.length < 1) {
    return { error: "Announcement content cannot be empty." };
  }
  if (plainText.length > MAX_ANNOUNCEMENT_PLAIN_LENGTH) {
    return {
      error: `Announcement content cannot exceed ${MAX_ANNOUNCEMENT_PLAIN_LENGTH} characters.`,
    };
  }
  if (cleanHtml.length > MAX_ANNOUNCEMENT_HTML_LENGTH) {
    return {
      error: "Announcement formatting markup exceeds maximum allowed payload size.",
    };
  }

  return { cleanHtml, plainText };
}

/**
 * Strips HTML/markup and validates plain-text comments and discussion replies.
 */
export function sanitizePlainTextInput(
  raw?: string | null,
  maxLength: number = MAX_COMMENT_LENGTH,
  fieldLabel: string = "Content",
): { cleanText?: string; error?: string } {
  if (!raw || typeof raw !== "string") {
    return { error: `${fieldLabel} cannot be empty.` };
  }

  const stripped = sanitizeHtml(raw, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: "discard",
    nonTextTags: NON_TEXT_TAGS,
  });

  const cleanText = stripped
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .trim();

  if (cleanText.length < 1) {
    return { error: `${fieldLabel} cannot be empty.` };
  }
  if (cleanText.length > maxLength) {
    return {
      error: `${fieldLabel} cannot exceed ${maxLength} characters.`,
    };
  }

  return { cleanText };
}
