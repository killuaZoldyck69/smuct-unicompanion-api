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
  buildTermExamUpdateSummary,
  haveTermExamsChanged,
  normalizeLegacyTermExamType,
  normalizeStoredTermExams,
  normalizeTermExamDateYmd,
  normalizeTermExamTime,
  normalizeTermExamType,
  resolveTermExamUpdateSummary,
} from "../src/modules/hub/exam-schedule.domain";
import {
  getMyHubsQuerySchema,
  hubIdParamSchema,
  updateHubSchema,
} from "../src/modules/hub/hub.schema";
import { buildMyHubSelect } from "../src/modules/hub/hub.repository";
import { hubWriteLimiter } from "../src/modules/hub/hub.routes";
import { extractDeadTokensForChunk } from "../src/services/push-notification.service";

const {
  EXAM_REMINDER_WINDOW_END_HOUR,
  EXAM_REMINDER_WINDOW_START_HOUR,
  buildUpcomingExamReminders,
  filterUndispatchedExamReminders,
  markExamReminderDispatched,
  resetDispatchedExamReminderCache,
} = await import("../src/services/academic-reminder.service");

const VALID_HUB_ID = "11111111-1111-4111-8111-111111111111";

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

test("Exam Schedule domain normalizes types, Dhaka dates, times, diffs, and notification summaries", () => {
  assert.equal(normalizeTermExamType(" midterm "), "Midterm");
  assert.equal(normalizeTermExamType("FINAL"), "Final");
  assert.equal(normalizeTermExamType("Quiz"), null);
  assert.equal(normalizeLegacyTermExamType("mid-term"), "Midterm");
  assert.equal(normalizeLegacyTermExamType("final exam"), "Final");

  assert.equal(normalizeTermExamDateYmd("2026-06-22"), "2026-06-22");
  // 2026-06-21T20:00:00Z is 2026-06-22 02:00 AM in Asia/Dhaka
  assert.equal(
    normalizeTermExamDateYmd("2026-06-21T20:00:00.000Z"),
    "2026-06-22",
  );
  assert.equal(
    normalizeTermExamDateYmd("2026-06-22T20:00:00+06:00"),
    "2026-06-22",
  );
  assert.equal(normalizeTermExamDateYmd("2026-06-22T20:00:00"), null);
  assert.equal(normalizeTermExamDateYmd("2026-02-31"), null);
  assert.equal(normalizeTermExamDateYmd("2026-02-31T10:00:00.000Z"), null);

  assert.equal(normalizeTermExamTime("14:30"), "02:30 PM");
  assert.equal(normalizeTermExamTime("9:05\u202FAM"), "09:05 AM");
  assert.equal(normalizeTermExamTime("TBA"), undefined);
  assert.equal(normalizeTermExamTime("  "), undefined);
  assert.equal(normalizeTermExamTime("25:99"), null);

  assert.equal(haveTermExamsChanged(null, []), false);
  assert.equal(
    haveTermExamsChanged(
      [{ type: "Midterm", date: "2026-06-22", time: "10:00 AM", room: "402" }],
      [{ type: "Midterm", date: "2026-06-22", time: "10:00 AM", room: "402" }],
    ),
    false,
  );
  assert.equal(
    haveTermExamsChanged(
      [{ type: "Midterm", date: "2026-06-22", time: "10:00 AM", room: "402" }],
      [],
    ),
    true,
  );

  const clearedSummary = buildTermExamUpdateSummary(
    [{ type: "Midterm", date: "2026-06-22" }],
    [],
  );
  assert.equal(clearedSummary.body, "Exam schedule has been cleared.");

  const updatedSummary = buildTermExamUpdateSummary(
    [
      { type: "Midterm", date: "2026-06-22" },
      { type: "Final", date: "2026-08-10" },
    ],
    [{ type: "Midterm", date: "2026-06-24", time: "10:00 AM", room: "Hall A" }],
  );
  assert.match(updatedSummary.body, /Midterm: Jun 24, 2026 at 10:00 AM \(Hall A\)/);
  assert.match(updatedSummary.body, /Final cleared/);

  assert.equal(
    resolveTermExamUpdateSummary(
      [{ type: "Midterm", date: "2026-06-22", time: "10:00 AM", room: "Hall A" }],
      [{ type: "Midterm", date: "2026-06-22", time: "10:00 AM", room: "Hall A" }],
    ),
    null,
  );
  assert.equal(
    resolveTermExamUpdateSummary(
      [{ type: "Midterm", date: "2026-06-22" }],
      [],
    )?.body,
    "Exam schedule has been cleared.",
  );

  assert.equal(
    normalizeStoredTermExams(
      JSON.stringify([
        { type: "Final", date: "2026-08-10", time: "14:00", room: " 501 " },
        { type: "Midterm", date: "2026-06-22" },
      ]),
    )[0]?.type,
    "Midterm",
  );
});

test("API-16: hub schemas validate hubIdParamSchema, view=exams, and strict termExams rules", () => {
  assert.equal(
    hubIdParamSchema.safeParse({ params: { id: "bad-id" } }).success,
    false,
  );
  assert.equal(
    hubIdParamSchema.safeParse({ params: { id: VALID_HUB_ID } }).success,
    true,
  );
  assert.equal(
    getMyHubsQuerySchema.safeParse({ query: { view: "exams" } }).success,
    true,
  );

  // Explicit [] and null clear termExams cleanly
  const clearedArr = updateHubSchema.safeParse({
    params: { id: VALID_HUB_ID },
    body: { termExams: [] },
  });
  assert.equal(clearedArr.success, true);
  if (clearedArr.success) {
    assert.deepEqual(clearedArr.data.body.termExams, []);
  }

  const clearedNull = updateHubSchema.safeParse({
    params: { id: VALID_HUB_ID },
    body: { termExams: null },
  });
  assert.equal(clearedNull.success, true);
  if (clearedNull.success) {
    assert.deepEqual(clearedNull.data.body.termExams, []);
  }

  // Canonicalizes valid Midterm + Final entries
  const validExams = updateHubSchema.safeParse({
    params: { id: VALID_HUB_ID },
    body: {
      termExams: [
        { type: "midterm", date: "2026-06-22", time: "14:30", room: " Hall A " },
        { type: "final", date: "2026-08-10", time: "TBA", room: "" },
      ],
    },
  });
  assert.equal(validExams.success, true);
  if (validExams.success) {
    assert.deepEqual(validExams.data.body.termExams, [
      { type: "Midterm", date: "2026-06-22", time: "02:30 PM", room: "Hall A" },
      { type: "Final", date: "2026-08-10", time: undefined, room: undefined },
    ]);
  }

  // Rejects missing date, fake calendar date, invalid type, duplicate type, bad time, oversized room
  const invalidPayloads = [
    [{ type: "Midterm", room: "Hall A" }],
    [{ type: "Midterm", date: "2026-02-31" }],
    [{ type: "Quiz", date: "2026-06-22" }],
    [
      { type: "Midterm", date: "2026-06-22" },
      { type: "Midterm", date: "2026-06-23" },
    ],
    [{ type: "Midterm", date: "2026-06-22", time: "25:00" }],
    [{ type: "Midterm", date: "2026-06-22", room: "R".repeat(61) }],
  ];
  for (const termExams of invalidPayloads) {
    assert.equal(
      updateHubSchema.safeParse({
        params: { id: VALID_HUB_ID },
        body: { termExams },
      }).success,
      false,
    );
  }
});

test("API-8: hubWriteLimiter isolates authenticated users behind a shared campus NAT IP", () => {
  for (let i = 0; i < 30; i += 1) {
    let nextCalled = false;
    hubWriteLimiter(
      { ip: "198.51.100.42", user: { id: "exam-nat-a" }, headers: {} } as any,
      createMockRes(),
      () => {
        nextCalled = true;
      },
    );
    assert.equal(nextCalled, true);
  }

  const blockedRes = createMockRes();
  let blockedNext = false;
  hubWriteLimiter(
    { ip: "198.51.100.42", user: { id: "exam-nat-a" }, headers: {} } as any,
    blockedRes,
    () => {
      blockedNext = true;
    },
  );
  assert.equal(blockedNext, false);
  assert.equal(blockedRes.statusCode, 429);

  let userBNext = false;
  hubWriteLimiter(
    { ip: "198.51.100.42", user: { id: "exam-nat-b" }, headers: {} } as any,
    createMockRes(),
    () => {
      userBNext = true;
    },
  );
  assert.equal(userBNext, true);
});

test("API-19: buildMyHubSelect('exams') projects minimal exam fields without heavy hub sub-resources", () => {
  const examsSelect = buildMyHubSelect("exams") as Record<string, unknown>;
  assert.equal(examsSelect.termExams, true);
  assert.equal(examsSelect.courseCode, true);
  assert.equal(examsSelect.courseName, true);
  assert.equal(examsSelect.weeklyClassSchedule, undefined);
  assert.equal(examsSelect.classNotices, undefined);
  assert.equal(examsSelect.assessments, undefined);
  assert.equal(examsSelect.joinCode, undefined);
  assert.equal(examsSelect.members, undefined);
  assert.equal(examsSelect.reviewQuestions, undefined);
});

test("API-11: buildUpcomingExamReminders handles Render spin-down window, Dhaka dates, and student-only routing", () => {
  assert.equal(EXAM_REMINDER_WINDOW_START_HOUR, 8);
  assert.equal(EXAM_REMINDER_WINDOW_END_HOUR, 22);

  const hubs = [
    {
      id: "hub-exam-1",
      courseCode: "CSE-315",
      courseName: "Compiler Design",
      weeklyClassSchedule: [],
      termExams: [
        {
          type: "Midterm",
          date: "2026-11-23T20:00:00.000Z", // 2026-11-24 in Asia/Dhaka
          time: "14:00",
          room: "Exam Hall B",
        },
        {
          type: "Final",
          date: "2026-12-20",
          time: "10:00 AM",
          room: "Hall A",
        },
      ],
    },
  ];

  // 07:30 AM Dhaka (01:30Z) -> outside window
  const earlyMorning = buildUpcomingExamReminders(
    hubs,
    new Date("2026-11-23T01:30:00.000Z"),
  );
  assert.equal(earlyMorning.length, 0);

  // 11:20 AM Dhaka (05:20Z) -> inside window (resilient to 09:00 spin-down)
  const midMorning = buildUpcomingExamReminders(
    hubs,
    new Date("2026-11-23T05:20:00.000Z"),
  );
  assert.equal(midMorning.length, 1);
  assert.equal(midMorning[0].recipientScope, "STUDENTS_ONLY");
  assert.equal(midMorning[0].payload.type, "EXAM_REMINDER");
  assert.equal(midMorning[0].payload.title, "Exam tomorrow (CSE-315)");
  assert.equal(midMorning[0].payload.route, "/(tabs)/exams");
  assert.equal(
    midMorning[0].payload.dedupeKey,
    "exam-reminder:hub-exam-1:2026-11-24:midterm",
  );
  assert.match(midMorning[0].payload.body, /at 02:00 PM \(Exam Hall B\)/);
});

test("API-11 hardening: exam reminder cache prevents per-minute storms and push chunk pruning stays aligned", () => {
  resetDispatchedExamReminderCache();

  const hubs = [
    {
      id: "hub-exam-storm",
      courseCode: "CSE-320",
      courseName: "Networks",
      weeklyClassSchedule: [],
      termExams: [{ type: "Midterm", date: "2026-11-24", time: "10:00 AM" }],
    },
  ];
  const tick1 = new Date("2026-11-23T04:00:00.000Z"); // 10:00 AM Dhaka Nov 23
  const tick2 = new Date("2026-11-23T04:01:00.000Z"); // 10:01 AM Dhaka Nov 23
  const nextDhakaDay = new Date("2026-11-24T04:00:00.000Z"); // 10:00 AM Dhaka Nov 24

  const reminders1 = filterUndispatchedExamReminders(
    buildUpcomingExamReminders(hubs, tick1),
    tick1,
  );
  assert.equal(reminders1.length, 1);

  // If DB write did not confirm, next minute still retries
  const retryReminders = filterUndispatchedExamReminders(
    buildUpcomingExamReminders(hubs, tick2),
    tick2,
  );
  assert.equal(retryReminders.length, 1);

  markExamReminderDispatched(reminders1[0].payload.dedupeKey, tick1);
  const suppressedSameDay = filterUndispatchedExamReminders(
    buildUpcomingExamReminders(hubs, tick2),
    tick2,
  );
  assert.equal(suppressedSameDay.length, 0);

  // Rolling over to a new Dhaka day clears the cache automatically
  const nextDayFiltered = filterUndispatchedExamReminders([reminders1[0]], nextDhakaDay);
  assert.equal(nextDayFiltered.length, 1);
  resetDispatchedExamReminderCache();

  const chunk0 = [{ to: "ExponentPushToken[healthy-chunk0]" }];
  const chunk1 = [
    { to: "ExponentPushToken[dead-chunk1]" },
    { to: "ExponentPushToken[healthy-chunk1]" },
  ];
  // Simulate chunk 0 failing transiently while chunk 1 returns DeviceNotRegistered at idx 0
  const dead = extractDeadTokensForChunk(chunk1, [
    { status: "error", message: "Unregistered", details: { error: "DeviceNotRegistered" } },
    { status: "ok", id: "ticket-2" },
  ]);
  assert.deepEqual(dead, ["ExponentPushToken[dead-chunk1]"]);
  assert.equal(dead.includes(chunk0[0].to as string), false);
});

test("Exam Schedule backend source guards hold across routes, repository, service, and reminders", () => {
  const routesSrc = fs.readFileSync(
    path.resolve(process.cwd(), "src/modules/hub/hub.routes.ts"),
    "utf8",
  );
  assert.match(
    routesSrc,
    /router\.get\(\s*"\/:id",\s*requireAuth,\s*validateRequest\(hubIdParamSchema\),\s*getHubDetails/s,
  );
  assert.match(
    routesSrc,
    /router\.patch\(\s*"\/:id",\s*requireAuth,\s*hubWriteLimiter,\s*validateRequest\(updateHubSchema\),\s*updateHub/s,
  );

  const repoSrc = fs.readFileSync(
    path.resolve(process.cwd(), "src/modules/hub/hub.repository.ts"),
    "utf8",
  );
  assert.match(repoSrc, /export const updateHubAtomic/);
  assert.match(repoSrc, /FROM "CourseHub"\s+WHERE id = \$\{hubId\}\s+FOR UPDATE/);

  const serviceSrc = fs.readFileSync(
    path.resolve(process.cwd(), "src/modules/hub/hub.service.ts"),
    "utf8",
  );
  assert.match(
    serviceSrc,
    /view === "exams" && \(user\?\.role === "ADMIN" \|\| user\?\.role === "TEACHER"\)/,
  );
  assert.match(serviceSrc, /updateHubAtomic/);
  assert.match(serviceSrc, /createHash\("sha256"\)/);
  assert.match(serviceSrc, /resolveTermExamUpdateSummary/);
  assert.match(serviceSrc, /EXAM_SCHEDULE_UPDATE/);
  assert.match(serviceSrc, /\["STUDENT", "CR"\]/);

  const reminderSrc = fs.readFileSync(
    path.resolve(process.cwd(), "src/services/academic-reminder.service.ts"),
    "utf8",
  );
  assert.match(reminderSrc, /DHAKA_PARTS_FORMATTER/);
  assert.match(reminderSrc, /buildUpcomingExamReminders/);
  assert.match(reminderSrc, /filterUndispatchedExamReminders/);
  assert.match(reminderSrc, /markExamReminderDispatched/);
  assert.match(reminderSrc, /academic_reminders\.hub_pass_completed/);
  assert.match(reminderSrc, /role !== "TEACHER"/);
  assert.match(reminderSrc, /route:\s*"\/\(tabs\)\/exams"/);

  const pushSrc = fs.readFileSync(
    path.resolve(process.cwd(), "src/services/push-notification.service.ts"),
    "utf8",
  );
  assert.equal(pushSrc.includes(".catch(() => {})"), false);
  assert.match(pushSrc, /push\.token_prune_failed/);
});
