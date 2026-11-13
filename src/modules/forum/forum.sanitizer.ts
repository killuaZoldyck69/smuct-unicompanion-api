import sanitizeHtml from "sanitize-html";

/**
 * Forum Input Sanitizer & Content Validator
 *
 * Enforces XSS protection via sanitize-html AST parsing, extracts meaningful
 * plain text, and validates readable content limits aligned with Mobile UI.
 */

export const MIN_FORUM_TITLE_LENGTH = 5;
export const MAX_FORUM_TITLE_LENGTH = 150;
export const MIN_FORUM_DESCRIPTION_PLAIN_LENGTH = 10;
export const MAX_FORUM_DESCRIPTION_PLAIN_LENGTH = 3000;
export const MAX_FORUM_DESCRIPTION_HTML_LENGTH = 12000;
export const MIN_FORUM_RESPONSE_LENGTH = 1;
export const MAX_FORUM_RESPONSE_LENGTH = 2000;

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

// Discard both tag and inner content for non-text/executable elements
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

/**
 * Extracts human-readable plain text from an HTML snippet, removing executable
 * payloads safely, decoding common HTML entities, and collapsing whitespace.
 */
export function extractPlainText(html?: string | null): string {
  if (!html) return "";

  // Insert spacing around block boundaries before stripping all HTML tags
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
 * Sanitizes rich text HTML by discarding dangerous tags, attributes, event
 * handlers, and unsafe URIs via sanitize-html's HTML parser while preserving
 * safe formatting tags and explicit text-align styles.
 */
export function sanitizeForumHtml(html?: string | null): string {
  if (!html) return "";
  return sanitizeHtml(html, SANITIZE_OPTIONS)
    .replace(
      /style="text-align:\s*(left|center|right|justify)"/gi,
      (_m, dir: string) => `style="text-align: ${dir.toLowerCase()}"`,
    )
    .trim();
}

/**
 * Validates and sanitizes forum post creation and edit payloads.
 */
export function validateAndSanitizePost(input: {
  title?: string;
  description?: string;
}): {
  cleanTitle?: string;
  cleanDescription?: string;
  plainText?: string;
  error?: string;
} {
  let cleanTitle: string | undefined;
  if (input.title !== undefined) {
    cleanTitle = extractPlainText(input.title).replace(/\s+/g, " ").trim();
    if (cleanTitle.length < MIN_FORUM_TITLE_LENGTH) {
      return {
        error: `Question title must be at least ${MIN_FORUM_TITLE_LENGTH} characters.`,
      };
    }
    if (cleanTitle.length > MAX_FORUM_TITLE_LENGTH) {
      return {
        error: `Question title cannot exceed ${MAX_FORUM_TITLE_LENGTH} characters.`,
      };
    }
  }

  let cleanDescription: string | undefined;
  let plainText: string | undefined;
  if (input.description !== undefined) {
    cleanDescription = sanitizeForumHtml(input.description);
    plainText = extractPlainText(cleanDescription);

    if (plainText.length < MIN_FORUM_DESCRIPTION_PLAIN_LENGTH) {
      return {
        error: `Question details must contain at least ${MIN_FORUM_DESCRIPTION_PLAIN_LENGTH} characters of readable context.`,
      };
    }
    if (plainText.length > MAX_FORUM_DESCRIPTION_PLAIN_LENGTH) {
      return { error: "Question details cannot exceed 3,000 characters." };
    }
    if (cleanDescription.length > MAX_FORUM_DESCRIPTION_HTML_LENGTH) {
      return {
        error:
          "Question formatting markup exceeds maximum allowed payload size.",
      };
    }
  }

  return { cleanTitle, cleanDescription, plainText };
}

/**
 * Validates and sanitizes a comment or reply response.
 */
export function validateAndSanitizeResponse(content?: string): {
  cleanContent?: string;
  error?: string;
} {
  if (!content) {
    return { error: "Response content cannot be empty." };
  }

  const sanitized = sanitizeForumHtml(content);
  const cleanContent = extractPlainText(sanitized);

  if (cleanContent.length < MIN_FORUM_RESPONSE_LENGTH) {
    return { error: "Response content cannot be empty." };
  }
  if (cleanContent.length > MAX_FORUM_RESPONSE_LENGTH) {
    return { error: "Response content cannot exceed 2,000 characters." };
  }

  return { cleanContent };
}
