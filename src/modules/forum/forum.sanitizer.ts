/**
 * Forum Input Sanitizer & Content Validator
 *
 * Enforces XSS protection, strips dangerous tags and attributes,
 * extracts meaningful plain text, and validates readable content limits.
 */

// Tags allowed in rich text descriptions
const ALLOWED_TAGS = new Set([
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
]);

// Strip all dangerous tags including their entire content
const DANGEROUS_BLOCK_TAGS_REGEX =
  /<(script|style|iframe|object|embed|svg|canvas|form|button|input|textarea|select|option)[^>]*>[\s\S]*?<\/\1>/gi;

// Strip self-closing or unclosed dangerous tags
const DANGEROUS_SELF_CLOSING_REGEX =
  /<(script|style|iframe|object|embed|svg|canvas|form|button|input|textarea|select|option)[^>]*\/?>/gi;

// Match inline event handlers (e.g., onload, onerror, onclick)
const EVENT_HANDLER_REGEX = /\s+on[a-z]+\s*=\s*(["'][^"']*["']|[^\s>]+)/gi;

// Match javascript: URIs in any attribute
const JAVASCRIPT_PROTOCOL_REGEX = /(href|src)\s*=\s*(["']\s*javascript:[^"']*["']|javascript:[^\s>]+)/gi;

/**
 * Extracts human-readable plain text from an HTML snippet,
 * decoding common HTML entities and collapsing whitespace.
 */
export function extractPlainText(html?: string | null): string {
  if (!html) return "";
  return html
    .replace(/<\/(p|div|li|h[1-6])>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+([,.:;?!])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Sanitizes rich text HTML by removing dangerous tags, malicious event handlers,
 * and unsafe protocols while preserving safe formatting tags.
 */
export function sanitizeForumHtml(html?: string | null): string {
  if (!html) return "";

  let cleaned = html
    .replace(DANGEROUS_BLOCK_TAGS_REGEX, "")
    .replace(DANGEROUS_SELF_CLOSING_REGEX, "")
    .replace(EVENT_HANDLER_REGEX, "")
    .replace(JAVASCRIPT_PROTOCOL_REGEX, "");

  // Remove any tags not in the allowed list
  cleaned = cleaned.replace(/<\/?([a-zA-Z0-9]+)(\s+[^>]*)?\/?>/g, (match, tagName) => {
    const lower = tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(lower)) {
      return "";
    }
    // For allowed tags, keep style only if it contains safe text-align / color
    if (match.startsWith("</")) {
      return `</${lower}>`;
    }
    // Filter attributes to allow only safe style (text-align)
    const styleMatch = match.match(/style\s*=\s*["']([^"']*)["']/i);
    if (styleMatch && /text-align\s*:\s*(left|center|right|justify)/i.test(styleMatch[1])) {
      const align = styleMatch[1].match(/text-align\s*:\s*(left|center|right|justify)/i)?.[0];
      return `<${lower} style="${align}">`;
    }
    return `<${lower}>`;
  });

  return cleaned.trim();
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
    cleanTitle = input.title.trim().replace(/\s+/g, " ");
    if (cleanTitle.length < 5) {
      return { error: "Question title must be at least 5 characters." };
    }
    if (cleanTitle.length > 150) {
      return { error: "Question title cannot exceed 150 characters." };
    }
  }

  let cleanDescription: string | undefined;
  let plainText: string | undefined;
  if (input.description !== undefined) {
    cleanDescription = sanitizeForumHtml(input.description);
    plainText = extractPlainText(cleanDescription);

    if (plainText.length < 10) {
      return {
        error: "Question details must contain at least 10 characters of readable context.",
      };
    }
    if (cleanDescription.length > 3000) {
      return { error: "Question details cannot exceed 3,000 characters." };
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

  // Comments are plain text with minimal formatting; strip all HTML tags
  const cleanContent = extractPlainText(content);

  if (cleanContent.length < 1) {
    return { error: "Response content cannot be empty." };
  }
  if (cleanContent.length > 2000) {
    return { error: "Response content cannot exceed 2,000 characters." };
  }

  return { cleanContent };
}
