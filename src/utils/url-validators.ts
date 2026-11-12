import { z } from "zod";

const IPV4_LITERAL_REGEX = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function isPrivateOrLoopbackHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return true;
  if (
    host === "localhost" ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }

  const ipv4Match = host.match(IPV4_LITERAL_REGEX);
  if (ipv4Match) {
    const octets = ipv4Match.slice(1).map(Number);
    if (octets.some((n) => n > 255)) return true;
    const [a, b] = octets;
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Validates that a remote imageUrl is a public HTTPS URL (prevents SSRF / local scheme injection).
 */
export function isSafePublicHttpsUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 500) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return false;
    if (!parsed.hostname || !parsed.hostname.includes(".")) return false;
    return !isPrivateOrLoopbackHost(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Shared Zod URL sanitizer for profile social/portfolio links.
 * Prepends https:// when omitted and rejects non-HTTP(S) schemes.
 */
export const urlSanitizer = z
  .string()
  .trim()
  .max(300, "URL must not exceed 300 characters")
  .transform((val) => {
    if (!val) return "";
    return /^https?:\/\//i.test(val) ? val : `https://${val}`;
  })
  .pipe(
    z
      .string()
      .url("Must be a valid URL")
      .refine(
        (url) => !url || /^https?:\/\//i.test(url),
        "URL must use http or https protocol",
      )
      .or(z.literal("")),
  );
