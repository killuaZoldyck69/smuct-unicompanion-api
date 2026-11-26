/**
 * Course Hub Anonymous Reviews Domain Helpers & Bounds
 *
 * Enforces integer ratings, bounded questions & structured answers,
 * prototype-safe answer sanitization, strict PII stripping, and stats helpers.
 */

export const MIN_REVIEW_RATING = 1;
export const MAX_REVIEW_RATING = 5;
export const MAX_REVIEW_COMMENT_LENGTH = 2000;
export const MAX_REVIEW_QUESTIONS = 10;
export const MAX_REVIEW_QUESTION_LENGTH = 200;
export const MAX_REVIEW_ANSWER_ENTRIES = 10;
export const MAX_REVIEW_ANSWER_KEY_LENGTH = 200;
export const MAX_REVIEW_ANSWER_LENGTH = 1000;
export const MAX_HUB_REVIEWS_LIST = 500;

const FORBIDDEN_RECORD_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Normalizes, deduplicates (case-insensitive), and caps custom evaluation questions.
 */
export function sanitizeReviewQuestions(rawQuestions: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of rawQuestions) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim().slice(0, MAX_REVIEW_QUESTION_LENGTH);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
    if (result.length >= MAX_REVIEW_QUESTIONS) break;
  }

  return result;
}

/**
 * Sanitizes custom question answers: rejects prototype keys, trims keys & values,
 * drops blank answers, caps entry counts/lengths, and returns null when empty.
 */
export function sanitizeReviewAnswers(
  rawAnswers?: Record<string, string> | null,
): Record<string, string> | null {
  if (!rawAnswers || typeof rawAnswers !== "object" || Array.isArray(rawAnswers)) {
    return null;
  }

  const sanitized: Record<string, string> = {};
  let count = 0;

  for (const [rawKey, rawVal] of Object.entries(rawAnswers)) {
    if (count >= MAX_REVIEW_ANSWER_ENTRIES) break;
    if (typeof rawKey !== "string" || typeof rawVal !== "string") continue;

    const key = rawKey.trim().slice(0, MAX_REVIEW_ANSWER_KEY_LENGTH);
    const val = rawVal.trim().slice(0, MAX_REVIEW_ANSWER_LENGTH);
    if (!key || !val || FORBIDDEN_RECORD_KEYS.has(key)) continue;

    sanitized[key] = val;
    count += 1;
  }

  return count > 0 ? sanitized : null;
}

/**
 * Computes totalReviews, rounded averageRating, and 1..5 rating distribution.
 */
export function computeReviewStats(ratings: number[]): {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
} {
  const ratingDistribution: Record<number, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  let sum = 0;
  let validCount = 0;

  for (const rating of ratings) {
    const rounded = Math.round(rating);
    if (rounded >= MIN_REVIEW_RATING && rounded <= MAX_REVIEW_RATING) {
      ratingDistribution[rounded] = (ratingDistribution[rounded] || 0) + 1;
      sum += rating;
      validCount += 1;
    }
  }

  const totalReviews = ratings.length;
  const averageRating =
    validCount > 0 ? Number((sum / validCount).toFixed(1)) : 0;

  return { totalReviews, averageRating, ratingDistribution };
}

/**
 * Projects a review into the strictly anonymous public representation (zero student PII).
 */
export function toAnonymousReviewPublicItem(review: {
  id: string;
  rating: number;
  comment: string | null;
  answers: unknown;
  createdAt: Date;
}) {
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    isAnonymous: true,
    answers: review.answers,
    createdAt: review.createdAt,
    student: {
      name: "Anonymous Student",
      image: null,
      studentProfile: null,
    },
  };
}

/**
 * Returns a Fisher-Yates shuffled copy of items so review ordering leaks no submission timing.
 */
export function shuffleArray<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
