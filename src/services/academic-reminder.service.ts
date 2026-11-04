import { prisma } from "../lib/prisma";
import { createNotifications } from "../modules/notification/notification.service";

const TIME_ZONE = "Asia/Dhaka";
const MINUTE_MS = 60_000;

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

const toMinutes = (raw: unknown): number | null => {
  if (typeof raw !== "string") return null;
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59 || hour > 23) return null;
  const period = match[3]?.toUpperCase();
  if (period) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (period === "PM" ? 12 : 0);
  }
  return hour * 60 + minute;
};

const safeArray = (value: unknown): Record<string, unknown>[] => {
  let parsed = value;
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed) as unknown; } catch { return []; }
  }
  return Array.isArray(parsed)
    ? parsed.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    : [];
};

export const runAcademicReminderPass = async (now = new Date()) => {
  const target = partsAt(new Date(now.getTime() + 15 * MINUTE_MS));
  const targetMinute = Number(target.hour) * 60 + Number(target.minute);
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
    await createNotifications(event.interested.map(({ userId }) => userId), {
      type: "CAMPUS_EVENT_REMINDER",
      title: "Campus event starting soon",
      body: `${event.title} starts in about one hour.`,
      route: `/(tabs)/events?eventId=${event.id}`,
      dedupeKey: `campus-event-reminder:${event.id}`,
    });
  }
  const hubs = await prisma.courseHub.findMany({
    where: { isArchived: false },
    select: {
      id: true,
      courseCode: true,
      courseName: true,
      weeklyClassSchedule: true,
      termExams: true,
      members: { where: { isActive: true }, select: { userId: true } },
    },
  });

  for (const hub of hubs) {
    const recipients = [...new Set(hub.members.map(({ userId }) => userId))];
    if (!recipients.length) continue;
    for (const session of safeArray(hub.weeklyClassSchedule)) {
      if (String(session.day ?? "").toLowerCase() !== String(target.weekday).toLowerCase()) continue;
      if (toMinutes(session.startTime) !== targetMinute) continue;
      await createNotifications(recipients, {
        type: "CLASS_REMINDER",
        title: "Class starting soon",
        body: `${hub.courseCode} · ${hub.courseName}${session.room ? ` · ${String(session.room)}` : ""} starts in 15 minutes.`,
        route: `/hub/${hub.id}`,
        dedupeKey: `class-reminder:${hub.id}:${target.year}-${target.month}-${target.day}:${target.hour}:${target.minute}`,
      });
    }
    for (const exam of safeArray(hub.termExams)) {
      if (typeof exam.date !== "string" || typeof exam.type !== "string") continue;
      const examDay = exam.date.slice(0, 10);
      const tomorrow = partsAt(new Date(now.getTime() + 24 * 60 * MINUTE_MS));
      const tomorrowKey = `${tomorrow.year}-${tomorrow.month}-${tomorrow.day}`;
      if (examDay !== tomorrowKey || target.hour !== "09" || target.minute !== "15") continue;
      await createNotifications(recipients, {
        type: "EXAM_REMINDER",
        title: "Exam tomorrow",
        body: `${exam.type} for ${hub.courseCode} is scheduled for tomorrow${typeof exam.time === "string" ? ` at ${exam.time}` : ""}.`,
        route: `/hub/${hub.id}`,
        dedupeKey: `exam-reminder:${hub.id}:${examDay}:${exam.type}`,
      });
    }
  }
};

export const startAcademicReminderScheduler = () => {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await runAcademicReminderPass();
    } catch (error) {
      console.error(JSON.stringify({ level: "error", event: "academic_reminders.failed", errorType: error instanceof Error ? error.name : "UnknownError" }));
    } finally {
      running = false;
    }
  };
  void run();
  const timer = setInterval(() => void run(), MINUTE_MS);
  timer.unref();
};
