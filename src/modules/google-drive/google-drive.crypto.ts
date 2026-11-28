import crypto from "node:crypto";

export interface DriveOAuthStatePayload {
  userId: string;
  returnUrl: string;
  nonce: string;
  exp: number;
}

const TOKEN_FORMAT_VERSION = "v1";

function deriveAesKey(secret: string): Buffer {
  return crypto
    .createHash("sha256")
    .update(`smuct-unicompanion:google-drive-token:v1:${secret}`)
    .digest();
}

function deriveStateHmacKey(secret: string): Buffer {
  return crypto
    .createHash("sha256")
    .update(`smuct-unicompanion:google-drive-state:v1:${secret}`)
    .digest();
}

export function encryptDriveToken(plaintext: string, secret: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveAesKey(secret), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${TOKEN_FORMAT_VERSION}:${iv.toString("hex")}:${tag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptDriveToken(encoded: string, secret: string): string {
  const parts = encoded.split(":");
  if (parts.length !== 4 || parts[0] !== TOKEN_FORMAT_VERSION) {
    throw new Error("Invalid encrypted Google Drive token format.");
  }

  const iv = Buffer.from(parts[1], "hex");
  const tag = Buffer.from(parts[2], "hex");
  const ciphertext = Buffer.from(parts[3], "hex");

  if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
    throw new Error("Malformed Google Drive token payload.");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    deriveAesKey(secret),
    iv,
  );
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

export function signDriveOAuthState(
  payload: DriveOAuthStatePayload,
  secret: string,
): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const sig = crypto
    .createHmac("sha256", deriveStateHmacKey(secret))
    .update(encodedPayload)
    .digest("base64url");
  return `${encodedPayload}.${sig}`;
}

export function verifyDriveOAuthState(
  state: string,
  secret: string,
  nowMs: number = Date.now(),
): DriveOAuthStatePayload | null {
  const dotIdx = state.indexOf(".");
  if (dotIdx <= 0 || dotIdx === state.length - 1) {
    return null;
  }

  const encodedPayload = state.slice(0, dotIdx);
  const providedSig = state.slice(dotIdx + 1);
  if (!encodedPayload || !providedSig || providedSig.includes(".")) {
    return null;
  }

  const expectedSig = crypto
    .createHmac("sha256", deriveStateHmacKey(secret))
    .update(encodedPayload)
    .digest("base64url");

  const providedBuf = Buffer.from(providedSig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  if (
    providedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<DriveOAuthStatePayload>;

    if (
      typeof parsed.userId !== "string" ||
      !parsed.userId.trim() ||
      typeof parsed.returnUrl !== "string" ||
      !parsed.returnUrl.trim() ||
      typeof parsed.nonce !== "string" ||
      !parsed.nonce.trim() ||
      typeof parsed.exp !== "number" ||
      !Number.isFinite(parsed.exp) ||
      parsed.exp <= nowMs
    ) {
      return null;
    }

    return parsed as DriveOAuthStatePayload;
  } catch {
    return null;
  }
}

function isPrivateLanHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host === "::1" ||
    host.endsWith(".exp.direct")
  ) {
    return true;
  }

  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4Match) return false;
  const octets = ipv4Match.slice(1).map((v) => Number(v));
  if (octets.some((n) => n < 0 || n > 255)) return false;

  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

export function isAllowedDriveReturnUrl(
  rawUrl: string,
  options: { frontendUrl?: string; trustedOrigins?: string } = {},
): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 500) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol === "smuct-unicompanion:") {
    return true;
  }

  if (protocol === "exp:" || protocol === "exps:") {
    return isPrivateLanHost(parsed.hostname);
  }

  if (protocol === "http:" || protocol === "https:") {
    const host = parsed.hostname.toLowerCase();
    if (
      protocol === "http:" &&
      (host === "localhost" || host === "127.0.0.1" || host === "[::1]")
    ) {
      return true;
    }

    const allowedOrigins = new Set<string>();
    const candidates = [
      options.frontendUrl || "",
      ...(options.trustedOrigins || "").split(","),
    ];
    for (const candidate of candidates) {
      const val = candidate.trim();
      if (!val) continue;
      try {
        allowedOrigins.add(new URL(val).origin);
      } catch {}
    }

    return allowedOrigins.has(parsed.origin);
  }

  return false;
}

export function appendHashParams(
  baseUrl: string,
  params: Record<string, string>,
): string {
  const [urlWithoutHash, existingHash = ""] = baseUrl.split("#", 2);
  const hashParams = new URLSearchParams(existingHash);
  for (const [key, value] of Object.entries(params)) {
    hashParams.set(key, value);
  }
  const encoded = hashParams.toString();
  return encoded ? `${urlWithoutHash}#${encoded}` : urlWithoutHash;
}
