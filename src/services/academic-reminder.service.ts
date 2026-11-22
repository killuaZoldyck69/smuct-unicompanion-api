import { prisma } from "../lib/prisma";
import { createNotifications } from "../modules/notification/notification.service";
import {
  findMatchingClassNotice,
  getDhakaDayBoundsUtc,
  normalizeWeekday,
  parseNoticeStartMinutes,
  parseTimeToMinutes,
} from "../modules/hub/class-routine.domain";

const TIME_ZONE = "Asia/Dhaka";
const MINUTE_MS = 60_000;
const CLASS_REMINDER_MIN_LEAD_MINUTES = 10;
const CLASS_REMINDER_MAX_LEAD_MINUTES = 16;

const partsAt = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
};

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

const collectExamReminders = (
  hubs: ReminderHubRecord[],
  now: Date,
): PendingHubReminder[] => {
  const target = partsAt(new Date(now.getTime() + 15 * MINUTE_MS));
  if (target.hour !== "09" || target.minute !== "15") {
    return [];
  }

  const tomorrow = partsAt(new Date(now.getTime() + 24 * 60 * MINUTE_MS));
  const tomorrowKey = `${tomorrow.year}-${tomorrow.month}-${tomorrow.day}`;
  const pending: PendingHubReminder[] = [];

  for (const hub of hubs) {
    for (const exam of safeArray(hub.termExams, {
      hubId: hub.id,
      field: "termExams",
    })) {
      if (typeof exam.date !== "string" || typeof exam.type !== "string") continue;
      const examDay = exam.date.slice(0, 10);
      if (examDay !== tomorrowKey) continue;
      pending.push({
        hubId: hub.id,
        payload: {
          type: "EXAM_REMINDER",
          title: "Exam tomorrow",
          body: `${exam.type} for ${hub.courseCode} is scheduled for tomorrow${typeof exam.time === "string" ? ` at ${exam.time}` : ""}.`,
          route: `/hub/${hub.id}`,
          dedupeKey: `exam-reminder:${hub.id}:${examDay}:${exam.type}`,
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

const dispatchHubReminders = async (now: Date) => {
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

  const pendingReminders = [
    ...buildUpcomingClassReminders(hubs, now),
    ...collectExamReminders(hubs, now),
  ];
  if (pendingReminders.length === 0) return;

  const matchedHubIds = [...new Set(pendingReminders.map((r) => r.hubId))];
  const members = await prisma.hubMember.findMany({
    where: { hubId: { in: matchedHubIds }, isActive: true },
    select: { hubId: true, userId: true },
  });

  const recipientsByHub = new Map<string, Set<string>>();
  for (const { hubId, userId } of members) {
    let set = recipientsByHub.get(hubId);
    if (!set) {
      set = new Set<string>();
      recipientsByHub.set(hubId, set);
    }
    set.add(userId);
  }

  for (const reminder of pendingReminders) {
    const recipients = recipientsByHub.get(reminder.hubId);
    if (!recipients?.size) continue;
    await createNotifications([...recipients], reminder.payload);
  }
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
