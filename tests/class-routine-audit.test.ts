import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  getDhakaDayBoundsUtc,
  isEffectiveDateWithinAllowedWindow,
  normalizeClassNoticeTimeRange,
  normalizeSafeMeetUrl,
  normalizeWeekday,
  parseCalendarOrIsoDateToDhakaDay,
  parseTimeToMinutes,
  resolveEffectiveHubRole,
  sanitizeClassNoticeFields,
} from "../src/modules/hub/class-routine.domain";
import {
  createClassNoticeSchema,
  createHubSchema,
  deleteClassNoticeSchema,
  getMyHubsQuerySchema,
  updateHubSchema,
} from "../src/modules/hub/hub.schema";
import {
  buildMyHubSelect,
  getActiveNoticeCutoff,
  getActiveNoticeHorizon,
} from "../src/modules/hub/hub.repository";
import { classNoticeWriteLimiter } from "../src/modules/hub/hub.routes";

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
      body: {
        weeklyClassSchedule: [
          { day: "monday", startTime: "09:00 AM", endTime: "08:00 AM" },
        ],
      },
    }).success,
    false,
  );
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

test("F1/F2/F4/F6/F11 source & projection guards hold across hub repository and service", () => {
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

  const hubRepoSrc = fs.readFileSync(
    path.resolve(process.cwd(), "src/modules/hub/hub.repository.ts"),
    "utf8",
  );
  assert.match(hubRepoSrc, /FROM "CourseHub"\s+WHERE id = \$\{hubId\}\s+FOR UPDATE/);
  assert.match(hubRepoSrc, /deactivateClassNoticeInHub/);
});
