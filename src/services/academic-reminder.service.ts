import { prisma } from "../lib/prisma";
import { createNotifications } from "../modules/notification/notification.service";
import {
  findMatchingClassNotice,
  getDhakaDayBoundsUtc,
  normalizeWeekday,
  parseNoticeStartMinutes,
  parseTimeToMinutes,
} from "../modules/hub/class-routine.domain";
import {
  formatYmdParts,
  normalizeLegacyTermExamType,
  normalizeTermExamDateYmd,
  normalizeTermExamTime,
} from "../modules/hub/exam-schedule.domain";

const TIME_ZONE = "Asia/Dhaka";
const MINUTE_MS = 60_000;
const CLASS_REMINDER_MIN_LEAD_MINUTES = 10;
const CLASS_REMINDER_MAX_LEAD_MINUTES = 16;
export const EXAM_REMINDER_WINDOW_START_HOUR = 8;
export const EXAM_REMINDER_WINDOW_END_HOUR = 22;

const DHAKA_PARTS_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "long",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const partsAt = (date: Date) =>
  Object.fromEntries(
    DHAKA_PARTS_FORMATTER.formatToParts(date).map(({ type, value }) => [
      type,
      value,
    ]),
  );

const safeArray = (
  value: unknown,
  context?: { hubId?: string; field?: string },
): Record<string, unknown>[] => {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed) as unknown;
    } catch (error: unknown) {
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "academic_reminders.invalid_json_array",
          hubId: context?.hubId,
          field: context?.field,
          errorType: error instanceof Error ? error.name : "UnknownError",
        }),
      );
      return [];
    }
  }
  return Array.isArray(parsed)
    ? parsed.filter(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === "object",
      )
    : [];
};

export interface ReminderClassNoticeRecord {
  type: string;
  targetDay: string;
  targetStartTime?: string | null;
  newRoom?: string | null;
  newTime?: string | null;
}

export interface ReminderHubRecord {
  id: string;
  courseCode: string;
  courseName: string;
  weeklyClassSchedule: unknown;
  termExams?: unknown;
  classNotices?: ReminderClassNoticeRecord[];
}

export interface PendingHubReminder {
  hubId: string;
  recipientScope?: "ALL" | "STUDENTS_ONLY";
  payload: Parameters<typeof createNotifications>[1];
}

export const buildUpcomingClassReminders = (
  hubs: ReminderHubRecord[],
  now: Date = new Date(),
): PendingHubReminder[] => {
  const nowParts = partsAt(now);
  const todayWeekday = normalizeWeekday(nowParts.weekday);
  if (!todayWeekday) return [];

  const nowMinutes = Number(nowParts.hour) * 60 + Number(nowParts.minute);
  if (Number.isNaN(nowMinutes)) return [];

  const todayKey = `${nowParts.year}-${nowParts.month}-${nowParts.day}`;
  const pending: PendingHubReminder[] = [];

  for (const hub of hubs) {
    const todayNotices = Array.isArray(hub.classNotices) ? hub.classNotices : [];

    for (const session of safeArray(hub.weeklyClassSchedule, {
      hubId: hub.id,
      field: "weeklyClassSchedule",
    })) {
      const sessionDay = normalizeWeekday(session.day);
      if (sessionDay !== todayWeekday) continue;

      const notice = findMatchingClassNotice(
        todayNotices,
        sessionDay,
        typeof session.startTime === "string" ? session.startTime : null,
      );
      if (notice?.type === "CANCELLED") continue;

      const effectiveStartMin =
        notice?.type === "TIME_CHANGE"
          ? (parseNoticeStartMinutes(notice.newTime) ??
            parseTimeToMinutes(session.startTime))
          : parseTimeToMinutes(session.startTime);

      if (effectiveStartMin === null) continue;
      const minutesUntilStart = effectiveStartMin - nowMinutes;
      if (
        minutesUntilStart < CLASS_REMINDER_MIN_LEAD_MINUTES ||
        minutesUntilStart > CLASS_REMINDER_MAX_LEAD_MINUTES
      ) {
        continue;
      }

      const locationLabel =
        notice?.type === "ONLINE_CLASS"
          ? " · Online Class"
          : notice?.type === "ROOM_CHANGE" && notice.newRoom?.trim()
            ? ` · Room ${notice.newRoom.trim()}`
            : typeof session.room === "string" && session.room.trim()
              ? ` · ${session.room.trim()}`
              : "";

      pending.push({
        hubId: hub.id,
        payload: {
          type: "CLASS_REMINDER",
          title: "Class starting soon",
          body: `${hub.courseCode} · ${hub.courseName}${locationLabel} starts in ~${minutesUntilStart} minutes.`,
          route: "/(tabs)/my-schedule",
          dedupeKey: `class-reminder:${hub.id}:${todayKey}:${effectiveStartMin}`,
        },
      });
    }
  }

  return pending;
};

const addRecipient = (
  map: Map<string, Set<string>>,
  hubId: string,
  userId: string,
) => {
  let set = map.get(hubId);
  if (!set) {
    set = new Set<string>();
    map.set(hubId, set);
  }
  set.add(userId);
};

export const buildUpcomingExamReminders = (
  hubs: ReminderHubRecord[],
  now: Date = new Date(),
): PendingHubReminder[] => {
  const nowParts = partsAt(now);
  const hour = Number(nowParts.hour);
  const year = Number(nowParts.year);
  const month = Number(nowParts.month);
  const day = Number(nowParts.day);
  if (
    Number.isNaN(hour) ||
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    hour < EXAM_REMINDER_WINDOW_START_HOUR ||
    hour >= EXAM_REMINDER_WINDOW_END_HOUR
  ) {
    return [];
  }

  const tomorrowProbe = new Date(Date.UTC(year, month - 1, day + 1));
  const tomorrowKey = formatYmdParts(
    tomorrowProbe.getUTCFullYear(),
    tomorrowProbe.getUTCMonth() + 1,
    tomorrowProbe.getUTCDate(),
  );
  const pending: PendingHubReminder[] = [];

  for (const hub of hubs) {
    for (const exam of safeArray(hub.termExams, {
      hubId: hub.id,
      field: "termExams",
    })) {
      const examDay = normalizeTermExamDateYmd(exam.date);
      const examType = normalizeLegacyTermExamType(exam.type);
      if (!examDay || !examType || examDay !== tomorrowKey) continue;

      const examTime = normalizeTermExamTime(exam.time);
      const examRoom =
        typeof exam.room === "string" && exam.room.trim()
          ? exam.room.trim()
          : undefined;

      pending.push({
        hubId: hub.id,
        recipientScope: "STUDENTS_ONLY",
        payload: {
          type: "EXAM_REMINDER",
          title: `Exam tomorrow (${hub.courseCode})`,
          body: `${examType} for ${hub.courseCode} · ${hub.courseName} is scheduled for tomorrow${examTime ? ` at ${examTime}` : ""}${examRoom ? ` (${examRoom})` : ""}.`,
          route: "/(tabs)/exams",
          dedupeKey: `exam-reminder:${hub.id}:${examDay}:${examType.toLowerCase()}`,
        },
      });
    }
  }

  return pending;
};

const dispatchEventReminders = async (now: Date) => {
  const eventReminderStart = new Date(now.getTime() + 60 * MINUTE_MS);
  eventReminderStart.setSeconds(0, 0);
  const eventReminderEnd = new Date(eventReminderStart.getTime() + MINUTE_MS);

  const upcomingEvents = await prisma.campusEvent.findMany({
    where: { eventDate: { gte: eventReminderStart, lt: eventReminderEnd } },
    select: {
      id: true,
      title: true,
      interested: { select: { userId: true } },
    },
  });

  for (const event of upcomingEvents) {
    await createNotifications(
      event.interested.map(({ userId }) => userId),
      {
        type: "CAMPUS_EVENT_REMINDER",
        title: "Campus event starting soon",
        body: `${event.title} starts in about one hour.`,
        route: `/(tabs)/events?eventId=${event.id}`,
        dedupeKey: `campus-event-reminder:${event.id}`,
      },
    );
  }
};

let dispatchedExamDayKey: string | null = null;
const dispatchedExamReminderKeys = new Set<string>();

function syncExamReminderCacheDay(now: Date): string {
  const parts = partsAt(now);
  const todayKey = `${parts.year}-${parts.month}-${parts.day}`;
  if (dispatchedExamDayKey !== todayKey) {
    dispatchedExamDayKey = todayKey;
    dispatchedExamReminderKeys.clear();
  }
  return todayKey;
}

export const filterUndispatchedExamReminders = (
  reminders: PendingHubReminder[],
  now: Date = new Date(),
): PendingHubReminder[] => {
  syncExamReminderCacheDay(now);
  return reminders.filter(
    (r) => !dispatchedExamReminderKeys.has(r.payload.dedupeKey),
  );
};

export const markExamReminderDispatched = (
  dedupeKey: string,
  now: Date = new Date(),
): void => {
  syncExamReminderCacheDay(now);
  dispatchedExamReminderKeys.add(dedupeKey);
};

export const resetDispatchedExamReminderCache = (): void => {
  dispatchedExamDayKey = null;
  dispatchedExamReminderKeys.clear();
};

const dispatchHubReminders = async (now: Date) => {
  const startedAt = Date.now();
  const dhakaToday = getDhakaDayBoundsUtc(now);
  const hubs = await prisma.courseHub.findMany({
    where: { isArchived: false },
    select: {
      id: true,
      courseCode: true,
      courseName: true,
      weeklyClassSchedule: true,
      termExams: true,
      ...(dhakaToday
        ? {
            classNotices: {
              where: {
                isActive: true,
                effectiveDate: {
                  gte: dhakaToday.startUtc,
                  lte: dhakaToday.endUtc,
                },
              },
              orderBy: { createdAt: "desc" as const },
              take: 10,
              select: {
                type: true,
                targetDay: true,
                targetStartTime: true,
                newRoom: true,
                newTime: true,
              },
            },
          }
        : {}),
    },
  });

  const pendingClassReminders = buildUpcomingClassReminders(hubs, now);
  const pendingExamReminders = filterUndispatchedExamReminders(
    buildUpcomingExamReminders(hubs, now),
    now,
  );
  const pendingReminders = [
    ...pendingClassReminders,
    ...pendingExamReminders,
  ];
  if (pendingReminders.length === 0) return;

  const matchedHubIds = [...new Set(pendingReminders.map((r) => r.hubId))];
  const members = await prisma.hubMember.findMany({
    where: { hubId: { in: matchedHubIds }, isActive: true },
    select: { hubId: true, userId: true, role: true },
  });

  const allRecipientsByHub = new Map<string, Set<string>>();
  const studentRecipientsByHub = new Map<string, Set<string>>();
  for (const { hubId, userId, role } of members) {
    addRecipient(allRecipientsByHub, hubId, userId);
    if (role !== "TEACHER") {
      addRecipient(studentRecipientsByHub, hubId, userId);
    }
  }

  for (const reminder of pendingReminders) {
    const map =
      reminder.recipientScope === "STUDENTS_ONLY"
        ? studentRecipientsByHub
        : allRecipientsByHub;
    const recipients = map.get(reminder.hubId);
    if (!recipients?.size) continue;
    const persisted = await createNotifications([...recipients], reminder.payload);
    if (persisted && reminder.payload.type === "EXAM_REMINDER") {
      markExamReminderDispatched(reminder.payload.dedupeKey, now);
    }
  }

  console.info(
    JSON.stringify({
      level: "info",
      event: "academic_reminders.hub_pass_completed",
      hubsScanned: hubs.length,
      remindersQueued: pendingReminders.length,
      examReminders: pendingExamReminders.length,
      durationMs: Date.now() - startedAt,
    }),
  );
};

export const runAcademicReminderPass = async (now = new Date()) => {
  await dispatchEventReminders(now);
  await dispatchHubReminders(now);
};

let reminderPassInFlight = false;

export const runAcademicReminderPassLocked = async (
  now = new Date(),
): Promise<{ ran: boolean; skipped: boolean }> => {
  if (reminderPassInFlight) {
    return { ran: false, skipped: true };
  }
  reminderPassInFlight = true;
  try {
    await runAcademicReminderPass(now);
    return { ran: true, skipped: false };
  } finally {
    reminderPassInFlight = false;
  }
};

export const startAcademicReminderScheduler = () => {
  const run = async () => {
    try {
      await runAcademicReminderPassLocked();
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "academic_reminders.failed",
          errorType: error instanceof Error ? error.name : "UnknownError",
        }),
      );
    }
  };
  void run();
  const timer = setInterval(() => void run(), MINUTE_MS);
  timer.unref();
};
