import {
  normalizeScheduleStartTime,
  parseCalendarOrIsoDateToDhakaDay,
} from "./class-routine.domain";

export const TERM_EXAM_TYPES = ["Midterm", "Final"] as const;
export type TermExamType = (typeof TERM_EXAM_TYPES)[number];

export const TERM_EXAM_LIMITS = {
  maxEntries: 2,
  roomMax: 60,
  timeMax: 20,
} as const;

export interface NormalizedTermExam {
  type: TermExamType;
  date: string;
  time?: string;
  room?: string;
}

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const TYPE_ORDER: Record<TermExamType, number> = {
  Midterm: 0,
  Final: 1,
};

export function normalizeTermExamType(raw: unknown): TermExamType | null {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "midterm") return "Midterm";
  if (normalized === "final") return "Final";
  return null;
}

export function normalizeLegacyTermExamType(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower === "midterm" || lower === "mid-term" || lower === "mid term") {
    return "Midterm";
  }
  if (lower === "final" || lower === "final exam") {
    return "Final";
  }
  return trimmed;
}

const STRICT_YMD_OR_TZ_ISO =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/;

export function formatYmdParts(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function normalizeTermExamDateYmd(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (!STRICT_YMD_OR_TZ_ISO.test(trimmed)) {
    return null;
  }

  // Reject impossible calendar prefixes such as 2026-02-31T10:00:00Z before Date rollover
  const prefixParts = parseCalendarOrIsoDateToDhakaDay(trimmed.slice(0, 10));
  if (!prefixParts) return null;

  const dhakaParts =
    trimmed.length === 10
      ? prefixParts
      : parseCalendarOrIsoDateToDhakaDay(trimmed);
  if (!dhakaParts) return null;

  return formatYmdParts(dhakaParts.year, dhakaParts.month, dhakaParts.day);
}

export function normalizeTermExamTime(
  raw: unknown,
): string | undefined | null {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toUpperCase() === "TBA") {
    return undefined;
  }
  return normalizeScheduleStartTime(trimmed);
}

export function normalizeStoredTermExams(
  raw: unknown,
): NormalizedTermExam[] {
  let parsed = raw;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  const deduped = new Map<TermExamType, NormalizedTermExam>();
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const legacyType = normalizeLegacyTermExamType(record.type);
    const canonicalType = legacyType ? normalizeTermExamType(legacyType) : null;
    const date = normalizeTermExamDateYmd(record.date);
    if (!canonicalType || !date) continue;

    const time = normalizeTermExamTime(record.time);
    const room =
      typeof record.room === "string" && record.room.trim()
        ? record.room.trim().slice(0, TERM_EXAM_LIMITS.roomMax)
        : undefined;

    deduped.set(canonicalType, {
      type: canonicalType,
      date,
      ...(typeof time === "string" ? { time } : {}),
      ...(room ? { room } : {}),
    });
  }

  return [...deduped.values()].sort(
    (a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.date.localeCompare(b.date),
  );
}

function examKey(exam: NormalizedTermExam): string {
  return `${exam.type}|${exam.date}|${exam.time ?? ""}|${exam.room ?? ""}`;
}

export function haveTermExamsChanged(
  previousRaw: unknown,
  nextExams: readonly NormalizedTermExam[],
): boolean {
  const previous = normalizeStoredTermExams(previousRaw);
  const next = normalizeStoredTermExams(nextExams);
  if (previous.length !== next.length) return true;
  return previous.some((exam, index) => examKey(exam) !== examKey(next[index]));
}

export function formatYmdShortDate(ymd: string): string {
  const parts = parseCalendarOrIsoDateToDhakaDay(ymd);
  if (!parts) return ymd;
  return `${MONTH_SHORT[parts.month - 1]} ${parts.day}, ${parts.year}`;
}

function summarizeExamTransition(
  previous: readonly NormalizedTermExam[],
  next: readonly NormalizedTermExam[],
): { body: string; signature: string } {
  if (next.length === 0) {
    return {
      body: "Exam schedule has been cleared.",
      signature: "cleared",
    };
  }

  const nextTypes = new Set(next.map((e) => e.type));
  const clearedTypes = previous
    .filter((e) => !nextTypes.has(e.type))
    .map((e) => e.type);

  const segments = next.map((exam) => {
    const timePart = exam.time ? ` at ${exam.time}` : "";
    const roomPart = exam.room ? ` (${exam.room})` : "";
    return `${exam.type}: ${formatYmdShortDate(exam.date)}${timePart}${roomPart}`;
  });

  if (clearedTypes.length > 0) {
    segments.push(`${clearedTypes.join(", ")} cleared`);
  }

  return {
    body: segments.join(" · ").slice(0, 180),
    signature: next.map(examKey).join(";"),
  };
}

export function buildTermExamUpdateSummary(
  previousRaw: unknown,
  nextExams: readonly NormalizedTermExam[],
): { body: string; signature: string } {
  return summarizeExamTransition(
    normalizeStoredTermExams(previousRaw),
    normalizeStoredTermExams(nextExams),
  );
}

export function resolveTermExamUpdateSummary(
  previousRaw: unknown,
  nextExams: readonly NormalizedTermExam[],
): { body: string; signature: string } | null {
  const previous = normalizeStoredTermExams(previousRaw);
  const next = normalizeStoredTermExams(nextExams);
  const unchanged =
    previous.length === next.length &&
    previous.every((exam, index) => examKey(exam) === examKey(next[index]));
  return unchanged ? null : summarizeExamTransition(previous, next);
}
