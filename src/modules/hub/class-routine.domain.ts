export const CANONICAL_WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type CanonicalWeekday = (typeof CANONICAL_WEEKDAYS)[number];

export const CLASS_NOTICE_TYPES = [
  "CANCELLED",
  "ROOM_CHANGE",
  "TIME_CHANGE",
  "ONLINE_CLASS",
  "URGENT_NOTICE",
] as const;

export type ClassNoticeKind = (typeof CLASS_NOTICE_TYPES)[number];

export const CLASS_NOTICE_LIMITS = {
  messageMax: 500,
  roomMax: 60,
  timeMax: 60,
  targetStartTimeMax: 20,
  meetUrlMax: 500,
  maxScheduleSlots: 21,
  advanceWindowDays: 7,
} as const;

export const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAY_BY_LOWER = new Map<string, CanonicalWeekday>(
  CANONICAL_WEEKDAYS.map((day) => [day.toLowerCase(), day]),
);

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
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }

  return false;
}

export function normalizeWeekday(raw: unknown): CanonicalWeekday | null {
  if (typeof raw !== "string") return null;
  return WEEKDAY_BY_LOWER.get(raw.trim().toLowerCase()) ?? null;
}

export function parseTimeToMinutes(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute < 0 || minute > 59) return null;

  const period = match[3]?.toUpperCase();
  if (period) {
    if (hour < 1 || hour > 12) return null;
    if (period === "AM" && hour === 12) hour = 0;
    else if (period === "PM" && hour !== 12) hour += 12;
  } else if (hour < 0 || hour > 23) {
    return null;
  }

  return hour * 60 + minute;
}

export function formatMinutes12h(minutes: number): string {
  const clamped = Math.max(0, Math.min(1439, Math.floor(minutes)));
  const h24 = Math.floor(clamped / 60);
  const m = clamped % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
}

export function normalizeScheduleStartTime(raw: unknown): string | null {
  const minutes = parseTimeToMinutes(raw);
  return minutes === null ? null : formatMinutes12h(minutes);
}

export function findMatchingClassNotice<
  T extends { targetDay: string; targetStartTime?: string | null },
>(
  notices: readonly T[],
  slotDay: string,
  slotStartTime?: string | null,
): T | undefined {
  const normalizedDay = normalizeWeekday(slotDay);
  if (!normalizedDay) return undefined;

  const dayNotices = notices.filter(
    (n) => normalizeWeekday(n.targetDay) === normalizedDay,
  );
  if (dayNotices.length === 0) return undefined;

  const normalizedSlotStart = normalizeScheduleStartTime(slotStartTime);
  if (normalizedSlotStart) {
    const exactMatch = dayNotices.find(
      (n) => normalizeScheduleStartTime(n.targetStartTime) === normalizedSlotStart,
    );
    if (exactMatch) return exactMatch;
  }

  return dayNotices.find((n) => !n.targetStartTime?.trim());
}

export function parseNoticeStartMinutes(rawTime?: string | null): number | null {
  if (!rawTime) return null;
  const startSegment = rawTime.replace(/^Now\s*/i, "").trim().split(/\s*[–—-]\s*/)[0];
  return parseTimeToMinutes(startSegment);
}

export function normalizeClassNoticeTimeRange(raw: string): string | null {
  const clean = raw.replace(/^Now\s*/i, "").trim();
  if (!clean || clean.length > CLASS_NOTICE_LIMITS.timeMax) return null;

  const parts = clean.split(/\s*[–—-]\s*/);
  if (parts.length === 2) {
    const startMin = parseTimeToMinutes(parts[0]);
    const endMin = parseTimeToMinutes(parts[1]);
    if (startMin === null || endMin === null || endMin <= startMin) {
      return null;
    }
    return `${formatMinutes12h(startMin)} - ${formatMinutes12h(endMin)}`;
  }

  if (parts.length === 1) {
    const singleMin = parseTimeToMinutes(parts[0]);
    if (singleMin === null) return null;
    return formatMinutes12h(singleMin);
  }

  return null;
}

export function normalizeSafeMeetUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > CLASS_NOTICE_LIMITS.meetUrlMax) return null;

  // Never rewrite explicit non-HTTP(S) schemes such as javascript: or tel:
  const hasExplicitScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
  const candidate = hasExplicitScheme ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    if (!parsed.hostname || !parsed.hostname.includes(".")) {
      return null;
    }
    if (isPrivateOrLoopbackHost(parsed.hostname)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export interface DhakaDayBounds {
  year: number;
  month: number;
  day: number;
  startUtc: Date;
  endUtc: Date;
  canonicalDate: Date;
}

export function parseCalendarOrIsoDateToDhakaDay(
  raw: string | Date,
): { year: number; month: number; day: number } | null {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymdMatch) {
      const year = Number(ymdMatch[1]);
      const month = Number(ymdMatch[2]);
      const day = Number(ymdMatch[3]);
      const probe = new Date(Date.UTC(year, month - 1, day));
      if (
        probe.getUTCFullYear() !== year ||
        probe.getUTCMonth() !== month - 1 ||
        probe.getUTCDate() !== day
      ) {
        return null;
      }
      return { year, month, day };
    }
  }

  const parsed = raw instanceof Date ? raw : new Date(raw);
  if (isNaN(parsed.getTime())) return null;

  const dhaka = new Date(parsed.getTime() + DHAKA_OFFSET_MS);
  return {
    year: dhaka.getUTCFullYear(),
    month: dhaka.getUTCMonth() + 1,
    day: dhaka.getUTCDate(),
  };
}

export function getDhakaDayBoundsUtc(
  input: string | Date,
): DhakaDayBounds | null {
  const parts = parseCalendarOrIsoDateToDhakaDay(input);
  if (!parts) return null;

  const { year, month, day } = parts;
  const startUtc = new Date(
    Date.UTC(year, month - 1, day) - DHAKA_OFFSET_MS,
  );
  const endUtc = new Date(
    Date.UTC(year, month - 1, day + 1) - DHAKA_OFFSET_MS - 1,
  );
  // Noon Asia/Dhaka (06:00Z) guarantees identical calendar date in UTC and Asia/Dhaka
  const canonicalDate = new Date(Date.UTC(year, month - 1, day, 6, 0, 0));

  return { year, month, day, startUtc, endUtc, canonicalDate };
}

export function isEffectiveDateWithinAllowedWindow(
  canonicalDate: Date,
  now: Date = new Date(),
): boolean {
  const todayBounds = getDhakaDayBoundsUtc(now);
  if (!todayBounds) return false;

  const maxAllowedUtc =
    todayBounds.endUtc.getTime() +
    CLASS_NOTICE_LIMITS.advanceWindowDays * ONE_DAY_MS;
  const targetMs = canonicalDate.getTime();
  return targetMs >= todayBounds.startUtc.getTime() && targetMs <= maxAllowedUtc;
}

export function getDhakaWeekdayFromBounds(
  bounds: DhakaDayBounds,
): CanonicalWeekday {
  const utcDay = new Date(
    Date.UTC(bounds.year, bounds.month - 1, bounds.day),
  ).getUTCDay();
  return CANONICAL_WEEKDAYS[utcDay];
}

export function formatDhakaNoticeDayPhrase(
  bounds: DhakaDayBounds,
  targetDay: CanonicalWeekday,
  now: Date = new Date(),
): string {
  const todayBounds = getDhakaDayBoundsUtc(now);
  if (
    todayBounds &&
    todayBounds.year === bounds.year &&
    todayBounds.month === bounds.month &&
    todayBounds.day === bounds.day
  ) {
    return "today";
  }
  const yyyy = String(bounds.year);
  const mm = String(bounds.month).padStart(2, "0");
  const dd = String(bounds.day).padStart(2, "0");
  return `${targetDay} (${yyyy}-${mm}-${dd})`;
}

export function resolveEffectiveHubRole<T extends string>(
  memberRole: T,
  user?: {
    role?: string | null;
    studentProfile?: { isCR?: boolean | null } | null;
  } | null,
): T | "TEACHER" | "CR" {
  if (memberRole === "STUDENT") {
    if (user?.role === "TEACHER") {
      return "TEACHER";
    }
    if (user?.studentProfile?.isCR) {
      return "CR";
    }
  }
  return memberRole;
}

export function resolveClassNoticeDefaultMessage(
  type: ClassNoticeKind,
  newRoom?: string,
  newTime?: string,
  dayPhrase: string = "today",
): string {
  switch (type) {
    case "CANCELLED":
      return `Class is cancelled for ${dayPhrase}.`;
    case "ROOM_CHANGE":
      return newRoom
        ? `Class for ${dayPhrase} will be held in Room ${newRoom}.`
        : `Classroom has been changed for ${dayPhrase}.`;
    case "ONLINE_CLASS":
      return `Class will be held online for ${dayPhrase}.`;
    case "TIME_CHANGE":
      return newTime
        ? `Class for ${dayPhrase} rescheduled to ${newTime}.`
        : `Class time for ${dayPhrase} has been rescheduled.`;
    default:
      return `Class notice for ${dayPhrase}.`;
  }
}

export interface SanitizedClassNoticeData {
  type: ClassNoticeKind;
  targetDay: CanonicalWeekday;
  targetStartTime?: string;
  message: string;
  newRoom?: string;
  newTime?: string;
  meetUrl?: string;
}

export function sanitizeClassNoticeFields(
  input: {
    type: ClassNoticeKind;
    targetDay: string;
    targetStartTime?: string;
    message?: string;
    newRoom?: string;
    newTime?: string;
    meetUrl?: string;
  },
  dayPhrase: string = "today",
): SanitizedClassNoticeData {
  const targetDay = normalizeWeekday(input.targetDay);
  if (!targetDay) {
    throw new Error(`Invalid target day: ${input.targetDay}`);
  }

  const targetStartTime = input.targetStartTime
    ? (normalizeScheduleStartTime(input.targetStartTime) ?? undefined)
    : undefined;
  const newRoom =
    input.type === "ROOM_CHANGE" && input.newRoom?.trim()
      ? input.newRoom.trim()
      : undefined;
  const newTime =
    input.type === "TIME_CHANGE" && input.newTime?.trim()
      ? (normalizeClassNoticeTimeRange(input.newTime) ?? undefined)
      : undefined;
  const meetUrl =
    input.type === "ONLINE_CLASS" && input.meetUrl?.trim()
      ? (normalizeSafeMeetUrl(input.meetUrl) ?? undefined)
      : undefined;

  const trimmedMessage = input.message?.trim();
  const message =
    trimmedMessage && trimmedMessage.length > 0
      ? trimmedMessage
      : resolveClassNoticeDefaultMessage(input.type, newRoom, newTime, dayPhrase);

  return {
    type: input.type,
    targetDay,
    targetStartTime,
    message,
    newRoom,
    newTime,
    meetUrl,
  };
}
