import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/testdb";
process.env.DIRECT_URL ??= "postgresql://user:pass@localhost:5432/testdb";
process.env.BETTER_AUTH_SECRET ??= "test-secret-minimum-32-characters-long";
process.env.BETTER_AUTH_URL ??= "http://localhost:5000";
process.env.FRONTEND_URL ??= "http://localhost:8081";
process.env.BREVO_API_KEY ??= "test-brevo-key";
process.env.EMAIL_FROM ??= "no-reply@example.com";
process.env.NODE_ENV ??= "test";

import {
  findMatchingClassNotice,
  formatDhakaNoticeDayPhrase,
  getDhakaDayBoundsUtc,
  getDhakaWeekdayFromBounds,
  isEffectiveDateWithinAllowedWindow,
  normalizeClassNoticeTimeRange,
  normalizeSafeMeetUrl,
  normalizeScheduleStartTime,
  normalizeWeekday,
  parseCalendarOrIsoDateToDhakaDay,
  parseNoticeStartMinutes,
  parseTimeToMinutes,
  resolveClassNoticeDefaultMessage,
  resolveEffectiveHubRole,
  sanitizeClassNoticeFields,
} from "../src/modules/hub/class-routine.domain";
import {
  createClassNoticeSchema,
  createHubSchema,
  deleteClassNoticeSchema,
  getMyHubsQuerySchema,
  toggleLiveClassSchema,
  updateHubSchema,
} from "../src/modules/hub/hub.schema";
import {
  buildMyHubSelect,
  getActiveNoticeCutoff,
  getActiveNoticeHorizon,
} from "../src/modules/hub/hub.repository";
import { classNoticeWriteLimiter } from "../src/modules/hub/hub.routes";

const { createAcademicReminderCronHandler } = await import("../src/app");
const { buildUpcomingClassReminders } = await import(
  "../src/services/academic-reminder.service"
);

const VALID_HUB_ID = "11111111-1111-4111-8111-111111111111";
const VALID_NOTICE_ID = "22222222-2222-4222-8222-222222222222";

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string | number>,
    body: undefined as unknown,
    setHeader(k: string, v: string | number) {
      this.headers[k] = v;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

test("Class Routine domain normalizes weekdays, times, ranges with en-dash, and safe meet URLs", () => {
  assert.equal(normalizeWeekday("  wednesday "), "Wednesday");
  assert.equal(normalizeWeekday("SUNDAY"), "Sunday");
  assert.equal(normalizeWeekday("Funday"), null);

  assert.equal(parseTimeToMinutes("00:00"), 0);
  assert.equal(parseTimeToMinutes("12:00 AM"), 0);
  assert.equal(parseTimeToMinutes("11:59 PM"), 1439);
  assert.equal(parseTimeToMinutes("25:00"), null);
  assert.equal(parseNoticeStartMinutes("Now 10:30 AM – 12:00 PM"), 630);
  assert.equal(parseNoticeStartMinutes("11:00 AM"), 660);

  assert.equal(
    normalizeClassNoticeTimeRange("10:30 AM – 12:00 PM"),
    "10:30 AM - 12:00 PM",
  );
  assert.equal(
    normalizeClassNoticeTimeRange("Now 14:00 - 15:30"),
    "02:00 PM - 03:30 PM",
  );
  assert.equal(normalizeClassNoticeTimeRange("12:00 PM - 10:00 AM"), null);

  assert.equal(
    normalizeSafeMeetUrl("meet.google.com/abc-defg-hij"),
    "https://meet.google.com/abc-defg-hij",
  );
  assert.equal(normalizeSafeMeetUrl("javascript:alert(1)"), null);
  assert.equal(normalizeSafeMeetUrl("tel:+8801700000000"), null);
  assert.equal(normalizeSafeMeetUrl("http://127.0.0.1:8080/live"), null);
  assert.equal(normalizeSafeMeetUrl("http://localhost/room"), null);
});

test("Class Routine Dhaka day bounds stay consistent across UTC midnight boundary and 7-day window", () => {
  // 2026-11-23T00:30:00+06:00 === 2026-11-22T18:30:00Z
  const earlyDhakaMorning = new Date("2026-11-22T18:30:00.000Z");
  const morningDay = parseCalendarOrIsoDateToDhakaDay(earlyDhakaMorning);
  assert.deepEqual(morningDay, { year: 2026, month: 11, day: 23 });

  const boundsFromYmd = getDhakaDayBoundsUtc("2026-11-23");
  const boundsFromIso = getDhakaDayBoundsUtc("2026-11-22T18:30:00.000Z");
  assert.ok(boundsFromYmd && boundsFromIso);
  assert.equal(boundsFromYmd.startUtc.getTime(), boundsFromIso.startUtc.getTime());
  assert.equal(boundsFromYmd.endUtc.getTime(), boundsFromIso.endUtc.getTime());

  assert.equal(getDhakaDayBoundsUtc("2026-02-31"), null);

  const threeDaysAhead = getDhakaDayBoundsUtc("2026-11-26")!;
  assert.equal(
    isEffectiveDateWithinAllowedWindow(threeDaysAhead.canonicalDate, earlyDhakaMorning),
    true,
  );

  const yesterday = getDhakaDayBoundsUtc("2026-11-22")!;
  assert.equal(
    isEffectiveDateWithinAllowedWindow(yesterday.canonicalDate, earlyDhakaMorning),
    false,
  );

  const tenDaysAhead = getDhakaDayBoundsUtc("2026-12-03")!;
  assert.equal(
    isEffectiveDateWithinAllowedWindow(tenDaysAhead.canonicalDate, earlyDhakaMorning),
    false,
  );
});

test("Class Routine domain preserves global CR role and strips unrelated notice fields", () => {
  assert.equal(
    resolveEffectiveHubRole("STUDENT", {
      role: "STUDENT",
      studentProfile: { isCR: true },
    }),
    "CR",
  );
  assert.equal(
    resolveEffectiveHubRole("STUDENT", {
      role: "TEACHER",
      studentProfile: null,
    }),
    "TEACHER",
  );
  assert.equal(
    resolveEffectiveHubRole("STUDENT", {
      role: "STUDENT",
      studentProfile: { isCR: false },
    }),
    "STUDENT",
  );

  const sanitized = sanitizeClassNoticeFields({
    type: "CANCELLED",
    targetDay: "monday",
    message: "",
    newRoom: "UB-501",
    newTime: "10:00 AM - 11:30 AM",
    meetUrl: "https://meet.google.com/abc-defg-hij",
  });
  assert.equal(sanitized.targetDay, "Monday");
  assert.equal(sanitized.message, "Class is cancelled for today.");
  assert.equal(sanitized.newRoom, undefined);
  assert.equal(sanitized.newTime, undefined);
  assert.equal(sanitized.meetUrl, undefined);
});

test("API-16: hub schemas validate UUID params, view query, weeklyClassSchedule, and class notice constraints", () => {
  assert.equal(getMyHubsQuerySchema.safeParse({ query: {} }).success, true);
  assert.equal(
    getMyHubsQuerySchema.safeParse({ query: { view: "schedule" } }).success,
    true,
  );
  assert.equal(
    getMyHubsQuerySchema.safeParse({ query: { view: "invalid" } }).success,
    false,
  );

  assert.equal(
    deleteClassNoticeSchema.safeParse({
      params: { id: "not-a-uuid", noticeId: VALID_NOTICE_ID },
    }).success,
    false,
  );
  assert.equal(
    deleteClassNoticeSchema.safeParse({
      params: { id: VALID_HUB_ID, noticeId: VALID_NOTICE_ID },
    }).success,
    true,
  );

  assert.equal(
    createClassNoticeSchema.safeParse({
      params: { id: VALID_HUB_ID },
      body: {
        type: "ROOM_CHANGE",
        targetDay: "tuesday",
        effectiveDate: "2026-11-24",
      },
    }).success,
    false,
  );
  assert.equal(
    createClassNoticeSchema.safeParse({
      params: { id: VALID_HUB_ID },
      body: {
        type: "ONLINE_CLASS",
        targetDay: "tuesday",
        effectiveDate: "2026-11-24",
        meetUrl: "javascript:alert(1)",
      },
    }).success,
    false,
  );
  const validNotice = createClassNoticeSchema.safeParse({
    params: { id: VALID_HUB_ID },
    body: {
      type: "TIME_CHANGE",
      targetDay: "wednesday",
      effectiveDate: "2026-11-25",
      newTime: "10:30 AM – 12:00 PM",
    },
  });
  assert.equal(validNotice.success, true);
  if (validNotice.success) {
    assert.equal(validNotice.data.body.targetDay, "Wednesday");
  }

  assert.equal(
    updateHubSchema.safeParse({
      params: { id: VALID_HUB_ID },
      body: {
        weeklyClassSchedule: [
          { day: "monday", startTime: "09:00 AM", endTime: "08:00 AM" },
        ],
      },
    }).success,
    false,
  );
  assert.equal(
    updateHubSchema.safeParse({
      params: { id: "not-a-uuid" },
      body: { meetUrl: "https://meet.google.com/abc-defg-hij" },
    }).success,
    false,
  );
  assert.equal(
    updateHubSchema.safeParse({
      params: { id: VALID_HUB_ID },
      body: { meetUrl: "javascript:alert(1)" },
    }).success,
    false,
  );
  const parsedEmptyMeet = updateHubSchema.safeParse({
    params: { id: VALID_HUB_ID },
    body: { meetUrl: "" },
  });
  assert.equal(parsedEmptyMeet.success, true);
  if (parsedEmptyMeet.success) {
    assert.equal(parsedEmptyMeet.data.body.meetUrl, null);
  }
  assert.equal(
    toggleLiveClassSchema.safeParse({
      params: { id: VALID_HUB_ID },
      body: { isClassLive: true, meetUrl: "http://localhost/room" },
    }).success,
    false,
  );
  const validLiveToggle = toggleLiveClassSchema.safeParse({
    params: { id: VALID_HUB_ID },
    body: { isClassLive: true, meetUrl: "meet.google.com/abc-defg-hij" },
  });
  assert.equal(validLiveToggle.success, true);
  if (validLiveToggle.success) {
    assert.equal(
      validLiveToggle.data.body.meetUrl,
      "https://meet.google.com/abc-defg-hij",
    );
  }
  const validCreateHub = createHubSchema.safeParse({
    body: {
      courseCode: "CSE-301",
      courseName: "Algorithms",
      credit: 3,
      termOffer: "Fall 2026",
      weeklyClassSchedule: [
        { day: "sunday", startTime: "09:00 AM", endTime: "10:30 AM", room: "402" },
      ],
      department: "CSE",
      batch: "32",
      semesterNumber: 6,
    },
  });
  assert.equal(validCreateHub.success, true);
  if (validCreateHub.success) {
    assert.equal(validCreateHub.data.body.weeklyClassSchedule[0].day, "Sunday");
  }
});

test("API-8: classNoticeWriteLimiter isolates authenticated users behind a shared campus NAT IP", () => {
  for (let i = 0; i < 20; i += 1) {
    let nextCalled = false;
    const req: any = {
      ip: "203.0.113.10",
      user: { id: "user-nat-a" },
      headers: {},
    };
    classNoticeWriteLimiter(req, createMockRes(), () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
  }

  const blockedRes = createMockRes();
  let blockedNext = false;
  classNoticeWriteLimiter(
    { ip: "203.0.113.10", user: { id: "user-nat-a" }, headers: {} } as any,
    blockedRes,
    () => {
      blockedNext = true;
    },
  );
  assert.equal(blockedNext, false);
  assert.equal(blockedRes.statusCode, 429);

  let userBNext = false;
  classNoticeWriteLimiter(
    { ip: "203.0.113.10", user: { id: "user-nat-b" }, headers: {} } as any,
    createMockRes(),
    () => {
      userBNext = true;
    },
  );
  assert.equal(userBNext, true);
});

test("F1/F2/F4/F6/F11 source, projection & code-quality guards hold across hub & reminder modules", () => {
  const now = new Date("2026-11-23T06:00:00.000Z");
  const cutoff = getActiveNoticeCutoff(now);
  const horizon = getActiveNoticeHorizon(now);
  assert.ok(horizon.getTime() > cutoff.getTime());

  const scheduleSelect = buildMyHubSelect("schedule", now) as any;
  assert.equal(scheduleSelect.classNotices.take, 30);
  assert.ok(scheduleSelect.classNotices.where.effectiveDate.lte instanceof Date);

  const hubServiceSrc = fs.readFileSync(
    path.resolve(process.cwd(), "src/modules/hub/hub.service.ts"),
    "utf8",
  );
  assert.match(hubServiceSrc, /!member\s*\|\|\s*!member\.isActive/);
  assert.match(hubServiceSrc, /if\s*\(view\s*===\s*"schedule"\)\s*\{\s*return\s*\[\];/s);
  assert.match(hubServiceSrc, /route:\s*"\/\(tabs\)\/my-schedule"/);
  assert.match(hubServiceSrc, /deactivateClassNoticeInHub\(\s*hubId,\s*noticeId/s);
  assert.match(hubServiceSrc, /replaceClassNoticeAtomic/);
  assert.match(hubServiceSrc, /invalidateHubCaches\(hubId\)/);
  assert.match(hubServiceSrc, /effectiveWeekday !== data\.targetDay/);
  assert.match(hubServiceSrc, /const assertActiveHub[\s\S]*findHubStatusById\(hubId\)/);
  assert.match(hubServiceSrc, /updateHubService[\s\S]*updateHubAtomic\(/);
  assert.match(hubServiceSrc, /toggleLiveClassService[\s\S]*assertActiveHub\(\s*hubId/);
  assert.match(hubServiceSrc, /deleteClassNoticeService[\s\S]*assertActiveHub\(\s*hubId/);
  assert.equal(/\bas any\b/.test(hubServiceSrc), false);
  assert.equal(/\breturn await\b/.test(hubServiceSrc), false);

  const hubRepoSrc = fs.readFileSync(
    path.resolve(process.cwd(), "src/modules/hub/hub.repository.ts"),
    "utf8",
  );
  assert.match(hubRepoSrc, /FROM "CourseHub"\s+WHERE id = \$\{hubId\}\s+FOR UPDATE/);
  assert.match(hubRepoSrc, /deactivateClassNoticeInHub/);
  assert.equal(hubRepoSrc.includes("ONE_DAY_PLACEHOLDER"), false);
  assert.match(hubRepoSrc, /buildActiveClassNoticesQuery[\s\S]*take:\s*30/);
  assert.match(
    hubRepoSrc,
    /findHubWithMembersAndDetails[\s\S]*classNotices:\s*buildActiveClassNoticesQuery\(\)/,
  );
  assert.equal(/\breturn await\b/.test(hubRepoSrc), false);

  const hubControllerSrc = fs.readFileSync(
    path.resolve(process.cwd(), "src/modules/hub/hub.controller.ts"),
    "utf8",
  );
  assert.equal(hubControllerSrc.includes("verifyHubRole"), false);
  assert.equal(hubControllerSrc.includes("removeMember"), false);
  assert.equal(hubControllerSrc.includes("// 👈 NEW"), false);

  const notificationServiceSrc = fs.readFileSync(
    path.resolve(process.cwd(), "src/modules/notification/notification.service.ts"),
    "utf8",
  );
  assert.match(notificationServiceSrc, /createManyAndReturn/);
  assert.match(notificationServiceSrc, /!insertedNotifications\.length/);

  const reminderServiceSrc = fs.readFileSync(
    path.resolve(process.cwd(), "src/services/academic-reminder.service.ts"),
    "utf8",
  );
  assert.match(reminderServiceSrc, /hubMember\.findMany/);
  assert.match(reminderServiceSrc, /parseNoticeStartMinutes/);
  assert.match(reminderServiceSrc, /new Set<string>\(\)/);
  assert.equal(reminderServiceSrc.includes(".includes(member.userId)"), false);
});

test("Dhaka weekday verification, advance notice wording, and reminder pass overrides work accurately", () => {
  const mondayBounds = getDhakaDayBoundsUtc("2026-11-23")!;
  const wednesdayBounds = getDhakaDayBoundsUtc("2026-11-25")!;
  assert.equal(getDhakaWeekdayFromBounds(mondayBounds), "Monday");
  assert.equal(getDhakaWeekdayFromBounds(wednesdayBounds), "Wednesday");

  const mondayMorningUtc = new Date("2026-11-23T02:45:00.000Z"); // 08:45 AM Dhaka
  assert.equal(
    formatDhakaNoticeDayPhrase(mondayBounds, "Monday", mondayMorningUtc),
    "today",
  );
  const wedPhrase = formatDhakaNoticeDayPhrase(
    wednesdayBounds,
    "Wednesday",
    mondayMorningUtc,
  );
  assert.equal(wedPhrase, "Wednesday (2026-11-25)");
  assert.equal(
    resolveClassNoticeDefaultMessage("CANCELLED", undefined, undefined, wedPhrase),
    "Class is cancelled for Wednesday (2026-11-25).",
  );

  const remindersAt0845 = buildUpcomingClassReminders(
    [
      {
        id: "hub-normal",
        courseCode: "CSE-101",
        courseName: "Structured Programming",
        weeklyClassSchedule: [
          { day: "Monday", startTime: "09:00 AM", endTime: "10:30 AM", room: "402" },
        ],
        classNotices: [],
      },
      {
        id: "hub-cancelled",
        courseCode: "CSE-102",
        courseName: "Discrete Math",
        weeklyClassSchedule: [
          { day: "Monday", startTime: "09:00 AM", endTime: "10:30 AM", room: "403" },
        ],
        classNotices: [{ type: "CANCELLED", targetDay: "Monday" }],
      },
      {
        id: "hub-resched",
        courseCode: "CSE-201",
        courseName: "Algorithms",
        weeklyClassSchedule: [
          { day: "Monday", startTime: "09:00 AM", endTime: "10:30 AM", room: "404" },
        ],
        classNotices: [
          {
            type: "TIME_CHANGE",
            targetDay: "Monday",
            newTime: "11:00 AM - 12:30 PM",
          },
        ],
      },
      {
        id: "hub-room",
        courseCode: "CSE-205",
        courseName: "Databases",
        weeklyClassSchedule: [
          { day: "Monday", startTime: "09:00 AM", endTime: "10:30 AM", room: "301" },
        ],
        classNotices: [
          { type: "ROOM_CHANGE", targetDay: "Monday", newRoom: "Lab 3" },
        ],
      },
      {
        id: "hub-online",
        courseCode: "CSE-309",
        courseName: "Compilers",
        weeklyClassSchedule: [
          { day: "Monday", startTime: "09:00 AM", endTime: "10:30 AM", room: "501" },
        ],
        classNotices: [{ type: "ONLINE_CLASS", targetDay: "Monday" }],
      },
    ],
    mondayMorningUtc,
  );

  assert.deepEqual(
    remindersAt0845.map((r) => r.hubId),
    ["hub-normal", "hub-room", "hub-online"],
  );
  assert.equal(remindersAt0845[0].payload.route, "/(tabs)/my-schedule");
  assert.match(remindersAt0845[1].payload.body, /Room Lab 3/);
  assert.match(remindersAt0845[2].payload.body, /Online Class/);

  const reschedMorningUtc = new Date("2026-11-23T04:45:00.000Z"); // 10:45 AM Dhaka
  const remindersAt1045 = buildUpcomingClassReminders(
    [
      {
        id: "hub-resched",
        courseCode: "CSE-201",
        courseName: "Algorithms",
        weeklyClassSchedule: [
          { day: "Monday", startTime: "09:00 AM", endTime: "10:30 AM", room: "404" },
        ],
        classNotices: [
          {
            type: "TIME_CHANGE",
            targetDay: "Monday",
            newTime: "11:00 AM - 12:30 PM",
          },
        ],
      },
    ],
    reschedMorningUtc,
  );
  assert.equal(remindersAt1045.length, 1);
  assert.equal(
    remindersAt1045[0].payload.dedupeKey,
    "class-reminder:hub-resched:2026-11-23:660",
  );
});

test("Internal cron reminder endpoint enforces constant-time secret auth", async () => {
  const unconfigured = createAcademicReminderCronHandler(
    async () => ({ ran: true, skipped: false }),
    () => undefined,
  );
  const res503 = createMockRes();
  await unconfigured({ headers: {} } as any, res503);
  assert.equal(res503.statusCode, 503);

  let invoked = 0;
  const configured = createAcademicReminderCronHandler(
    async () => {
      invoked += 1;
      return { ran: true, skipped: false };
    },
    () => "super-secret-cron-token-1234",
  );

  const res401 = createMockRes();
  await configured(
    { headers: { authorization: "Bearer wrong-token" } } as any,
    res401,
  );
  assert.equal(res401.statusCode, 401);
  assert.equal(invoked, 0);

  const res200 = createMockRes();
  await configured(
    { headers: { "x-cron-secret": "super-secret-cron-token-1234" } } as any,
    res200,
  );
  assert.equal(res200.statusCode, 200);
  assert.equal(invoked, 1);
  assert.equal(res200.body.ran, true);
});

test("ClassNotice.targetStartTime isolates same-day multi-slot courses while preserving legacy day-wide fallback", () => {
  assert.equal(normalizeScheduleStartTime("9:00 AM"), "09:00 AM");
  assert.equal(normalizeScheduleStartTime("14:30"), "02:30 PM");
  assert.equal(normalizeScheduleStartTime("25:99"), null);

  const validWithSlot = createClassNoticeSchema.safeParse({
    params: { id: VALID_HUB_ID },
    body: {
      type: "CANCELLED",
      targetDay: "monday",
      targetStartTime: "9:00",
      effectiveDate: "2026-11-23",
    },
  });
  assert.equal(validWithSlot.success, true);
  if (validWithSlot.success) {
    assert.equal(validWithSlot.data.body.targetStartTime, "09:00 AM");
  }

  assert.equal(
    createClassNoticeSchema.safeParse({
      params: { id: VALID_HUB_ID },
      body: {
        type: "CANCELLED",
        targetDay: "monday",
        targetStartTime: "25:99",
        effectiveDate: "2026-11-23",
      },
    }).success,
    false,
  );

  const slotNotice = {
    id: "n-slot",
    type: "CANCELLED",
    targetDay: "Monday",
    targetStartTime: "09:00 AM",
  };
  const legacyDayNotice = {
    id: "n-legacy",
    type: "ROOM_CHANGE",
    targetDay: "Monday",
    targetStartTime: null,
  };

  assert.equal(
    findMatchingClassNotice([legacyDayNotice, slotNotice], "Monday", "9:00 AM")?.id,
    "n-slot",
  );
  assert.equal(
    findMatchingClassNotice([legacyDayNotice, slotNotice], "Monday", "02:00 PM")?.id,
    "n-legacy",
  );
  assert.equal(
    findMatchingClassNotice([slotNotice], "Monday", "02:00 PM"),
    undefined,
  );

  const multiSlotHub = [
    {
      id: "hub-multi",
      courseCode: "CSE-310",
      courseName: "Operating Systems",
      weeklyClassSchedule: [
        { day: "Monday", startTime: "09:00 AM", endTime: "10:30 AM", room: "401" },
        { day: "Monday", startTime: "02:00 PM", endTime: "03:30 PM", room: "Lab 2" },
      ],
      classNotices: [
        {
          type: "CANCELLED",
          targetDay: "Monday",
          targetStartTime: "09:00 AM",
        },
      ],
    },
  ];

  // 08:45 AM Dhaka -> 09:00 AM slot is cancelled so skipped
  const morningReminders = buildUpcomingClassReminders(
    multiSlotHub,
    new Date("2026-11-23T02:45:00.000Z"),
  );
  assert.equal(morningReminders.length, 0);

  // 01:45 PM Dhaka -> 02:00 PM slot remains active so reminder dispatches
  const afternoonReminders = buildUpcomingClassReminders(
    multiSlotHub,
    new Date("2026-11-23T07:45:00.000Z"),
  );
  assert.equal(afternoonReminders.length, 1);
  assert.match(afternoonReminders[0].payload.body, /Lab 2/);

  const hubRepoSrc = fs.readFileSync(
    path.resolve(process.cwd(), "src/modules/hub/hub.repository.ts"),
    "utf8",
  );
  assert.match(hubRepoSrc, /buildActiveClassNoticesQuery[\s\S]*targetStartTime:\s*true/);
  assert.match(hubRepoSrc, /replaceClassNoticeAtomic[\s\S]*targetStartTime:\s*data\.targetStartTime/);
  assert.match(hubRepoSrc, /targetStartTime:\s*data\.targetStartTime \?\? null/);
});
