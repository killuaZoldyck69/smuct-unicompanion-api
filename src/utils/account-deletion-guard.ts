import { createHmac } from "node:crypto";

export const ACCOUNT_RE_REGISTRATION_COOLDOWN_DAYS = 30;
export const PERMANENT_BLOCK_DELETION_THRESHOLD = 2;

export type AccountIdentifierType = "EMAIL" | "STUDENT_ID";

export interface DeletionGuardState {
  isPermanentlyBlocked: boolean;
  blockedUntil: Date | null;
}

export interface DeletionGuardEvaluation {
  blocked: boolean;
  permanent: boolean;
  message: string | null;
}

/**
 * Normalizes an account identifier into canonical form prior to keyed hashing.
 */
export function normalizeAccountIdentifier(
  type: AccountIdentifierType,
  rawValue: string,
): string {
  const trimmed = rawValue.trim();
  return type === "EMAIL" ? trimmed.toLowerCase() : trimmed.toUpperCase();
}

/**
 * Produces a deterministic, irreversible domain-separated HMAC-SHA256 fingerprint
 * so deleted-account anti-abuse checks do not retain raw PII.
 */
export function hashAccountIdentifier(
  type: AccountIdentifierType,
  rawValue: string,
  secret: string | undefined = process.env.BETTER_AUTH_SECRET,
): string {
  const normalized = normalizeAccountIdentifier(type, rawValue);
  if (!normalized) {
    throw new Error(`Cannot hash empty ${type} identifier.`);
  }
  if (!secret || secret.length < 16) {
    throw new Error("Missing signing secret for account deletion guard.");
  }
  return createHmac("sha256", secret)
    .update(`${type}:${normalized}`)
    .digest("hex");
}

/**
 * Computes updated anti-abuse guard state for a self-service account deletion event.
 * First deletion applies a temporary cooldown; repeated deletions lock self-signup permanently.
 */
export function computeNextDeletionGuardState(
  existingCount: number,
  now: Date = new Date(),
  cooldownDays: number = ACCOUNT_RE_REGISTRATION_COOLDOWN_DAYS,
): {
  deletionCount: number;
  lastDeletedAt: Date;
  blockedUntil: Date | null;
  isPermanentlyBlocked: boolean;
} {
  const deletionCount = Math.max(0, Math.floor(existingCount)) + 1;
  const isPermanentlyBlocked =
    deletionCount >= PERMANENT_BLOCK_DELETION_THRESHOLD;
  const blockedUntil = isPermanentlyBlocked
    ? null
    : new Date(now.getTime() + cooldownDays * 24 * 60 * 60 * 1000);

  return {
    deletionCount,
    lastDeletedAt: now,
    blockedUntil,
    isPermanentlyBlocked,
  };
}

/**
 * Evaluates whether a stored guard record currently blocks sign-up or student onboarding.
 */
export function evaluateDeletionGuardBlock(
  guard: DeletionGuardState | null | undefined,
  now: Date = new Date(),
): DeletionGuardEvaluation {
  if (!guard) {
    return { blocked: false, permanent: false, message: null };
  }

  if (guard.isPermanentlyBlocked) {
    return {
      blocked: true,
      permanent: true,
      message:
        "Registration with this email or student ID is permanently blocked after repeated account deletions. Please contact an administrator.",
    };
  }

  if (guard.blockedUntil && guard.blockedUntil.getTime() > now.getTime()) {
    const unlockDate = guard.blockedUntil.toISOString().slice(0, 10);
    return {
      blocked: true,
      permanent: false,
      message: `This account was recently deleted. You can re-register with these details after ${unlockDate}, or contact an administrator for assistance.`,
    };
  }

  return { blocked: false, permanent: false, message: null };
}
