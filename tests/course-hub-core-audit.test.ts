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
  archiveHubSchema,
  createHubSchema,
  getAvailableTeachersQuerySchema,
  getMyHubsQuerySchema,
  joinHubSchema,
  MY_HUBS_VIEWS,
  updateHubSchema,
} from "../src/modules/hub/hub.schema";
import { buildMyHubSelect } from "../src/modules/hub/hub.repository";
import {
  generateJoinCode,
  JOIN_CODE_ALPHABET,
} from "../src/modules/hub/hub.service";
import { hubJoinLimiter, hubWriteLimiter } from "../src/modules/hub/hub.routes";
import { adminCourseHubsQuerySchema } from "../src/modules/admin/admin.schema";
import { buildAdminCourseHubsWhere } from "../src/modules/admin/admin.service";

const VALID_HUB_ID = "11111111-1111-4111-8111-111111111111";
const VALID_TEACHER_ID = "22222222-2222-4222-8222-222222222222";

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

test("API-16: Course Hub Core & Admin schemas enforce UUIDs, trimmed bounds, and canonical joinCode", () => {
  assert.equal(MY_HUBS_VIEWS.includes("list"), true);
  assert.equal(
    getMyHubsQuerySchema.safeParse({ query: { view: "list" } }).success,
    true,
  );

  // createHubSchema rejects non-UUID teacherId, oversized courseName, fractional semesterNumber
  assert.equal(
    createHubSchema.safeParse({
      body: {
        courseCode: "CSE 3311",
        courseName: "Operating Systems",
        credit: 3,
        termOffer: "Fall 2026",
        weeklyClassSchedule: [
          { day: "Sunday", startTime: "10:00 AM", endTime: "11:20 AM" },
        ],
        department: "CSE",
        batch: "37",
        semesterNumber: 6,
        teacherId: "not-a-uuid",
      },
    }).success,
    false,
  );

  const validCreate = createHubSchema.safeParse({
    body: {
      courseCode: "  CSE 3311  ",
      courseName: "  Operating Systems  ",
      credit: 3,
      termOffer: " Fall 2026 ",
      weeklyClassSchedule: [
        { day: "Sunday", startTime: "10:00 AM", endTime: "11:20 AM" },
      ],
      department: " CSE ",
      batch: " 37 ",
      section: "   ",
      semesterNumber: 6,
      teacherId: VALID_TEACHER_ID,
    },
  });
  assert.equal(validCreate.success, true);
  if (validCreate.success) {
    assert.equal(validCreate.data.body.courseCode, "CSE 3311");
    assert.equal(validCreate.data.body.section, undefined);
  }

  // updateHubSchema rejects empty strings on core metadata
  assert.equal(
    updateHubSchema.safeParse({
      params: { id: VALID_HUB_ID },
      body: { termOffer: "   " },
    }).success,
    false,
  );
  assert.equal(
    updateHubSchema.safeParse({
      params: { id: VALID_HUB_ID },
      body: { courseName: "" },
    }).success,
    false,
  );

  // archiveHubSchema validates UUID param
  assert.equal(
    archiveHubSchema.safeParse({
      params: { id: "bad-id" },
      body: { isArchived: true },
    }).success,
    false,
  );
  assert.equal(
    archiveHubSchema.safeParse({
      params: { id: VALID_HUB_ID },
      body: { isArchived: true },
    }).success,
    true,
  );

  // joinHubSchema normalizes and restricts to 6 alphanumeric characters
  const validJoin = joinHubSchema.safeParse({ body: { joinCode: " x7b9q2 " } });
  assert.equal(validJoin.success, true);
  if (validJoin.success) {
    assert.equal(validJoin.data.body.joinCode, "X7B9Q2");
  }
  assert.equal(
    joinHubSchema.safeParse({ body: { joinCode: "X7B-Q2" } }).success,
    false,
  );

  // Teachers & Admin Course Hubs query schemas
  const parsedTeachers = getAvailableTeachersQuerySchema.safeParse({
    query: {},
  });
  assert.equal(parsedTeachers.success, true);
  if (parsedTeachers.success) {
    assert.equal(parsedTeachers.data.query.limit, 20);
  }
  assert.equal(
    getAvailableTeachersQuerySchema.safeParse({ query: { limit: 100 } }).success,
    false,
  );
  assert.equal(
    adminCourseHubsQuerySchema.safeParse({
      query: { status: "ACTIVE", page: 1, limit: 15 },
    }).success,
    true,
  );
});

test("API-19: buildMyHubSelect('list') projects card-only fields and excludes heavy fields", () => {
  const listSelect = buildMyHubSelect("list") as Record<string, unknown>;
  assert.equal(listSelect.id, true);
  assert.equal(listSelect.courseCode, true);
  assert.equal(listSelect.courseName, true);
  assert.equal(listSelect.semesterNumber, true);
  assert.equal(listSelect.section, true);
  assert.equal(listSelect.isArchived, true);
  assert.equal(listSelect.isClassLive, true);
  assert.ok(listSelect._count);
  assert.ok(listSelect.members);
  assert.ok(listSelect.assessments);

  for (const omitted of [
    "weeklyClassSchedule",
    "termExams",
    "classNotices",
    "joinCode",
    "meetUrl",
    "credit",
    "department",
    "batch",
    "isReviewOpen",
    "reviewQuestions",
  ]) {
    assert.equal(Object.prototype.hasOwnProperty.call(listSelect, omitted), false);
  }
});

test("Join code generator uses cryptographic unambiguous 6-char alphabet", () => {
  for (let i = 0; i < 20; i += 1) {
    const code = generateJoinCode();
    assert.equal(code.length, 6);
    for (const ch of code) {
      assert.equal(JOIN_CODE_ALPHABET.includes(ch), true);
    }
  }
});

test("buildAdminCourseHubsWhere composes status, SMUCT department aliases, and search via AND", () => {
  const where = buildAdminCourseHubsWhere({
    status: "ACTIVE",
    department: "CSE",
    search: "Operating",
    page: 1,
    limit: 15,
  });

  assert.ok(Array.isArray(where.AND));
  assert.equal(where.AND.length, 3);
  assert.deepEqual(where.AND[0], { isArchived: false });
  assert.ok(Array.isArray((where.AND[1] as any).OR));
  assert.ok(Array.isArray((where.AND[2] as any).OR));
});

test("API-8: hubJoinLimiter isolates per-user join attempts behind campus NAT", () => {
  for (let i = 0; i < 15; i += 1) {
    let nextCalled = false;
    hubJoinLimiter(
      { ip: "203.0.113.5", user: { id: "join-nat-a" }, headers: {} } as any,
      createMockRes(),
      () => {
        nextCalled = true;
      },
    );
    assert.equal(nextCalled, true);
  }

  const blockedRes = createMockRes();
  let blockedNext = false;
  hubJoinLimiter(
    { ip: "203.0.113.5", user: { id: "join-nat-a" }, headers: {} } as any,
    blockedRes,
    () => {
      blockedNext = true;
    },
  );
  assert.equal(blockedNext, false);
  assert.equal(blockedRes.statusCode, 429);

  let otherUserAllowed = false;
  hubJoinLimiter(
    { ip: "203.0.113.5", user: { id: "join-nat-b" }, headers: {} } as any,
    createMockRes(),
    () => {
      otherUserAllowed = true;
    },
  );
  assert.equal(otherUserAllowed, true);
  assert.ok(hubWriteLimiter);
});

test("API-7 & Sub-cycle 1 source guards hold across routes, service, repository, and admin", () => {
  const routesSrc = fs.readFileSync(
    path.resolve(process.cwd(), "src/modules/hub/hub.routes.ts"),
    "utf8",
  );
  assert.match(routesSrc, /router\.post\(\s*"\/",\s*requireAuth,\s*hubWriteLimiter/s);
  assert.match(routesSrc, /router\.post\(\s*"\/join",\s*requireAuth,\s*hubJoinLimiter/s);
  assert.match(routesSrc, /router\.delete\(\s*"\/:id",\s*requireAuth,\s*hubWriteLimiter,\s*validateRequest\(hubIdParamSchema\)/s);
  assert.match(routesSrc, /router\.patch\(\s*"\/:id\/archive",\s*requireAuth,\s*hubWriteLimiter,\s*validateRequest\(archiveHubSchema\)/s);
  assert.equal(routesSrc.includes("/available-teachers"), false);

  const serviceSrc = fs.readFileSync(
    path.resolve(process.cwd(), "src/modules/hub/hub.service.ts"),
    "utf8",
  );
  assert.match(serviceSrc, /deleteHubService[\s\S]*verifyHubRole\(userId,\s*hubId,\s*\["TEACHER",\s*"ADMIN"\]\)/);
  assert.match(serviceSrc, /findActiveTeacherById/);
  assert.match(serviceSrc, /hub\.isArchived/);
  assert.match(serviceSrc, /updateHubLiveClassAtomic/);
  assert.match(serviceSrc, /if \(view === "list"\) \{\s*return \[\];/);
  assert.equal(/\bas any\b/.test(serviceSrc), false);

  const repoSrc = fs.readFileSync(
    path.resolve(process.cwd(), "src/modules/hub/hub.repository.ts"),
    "utf8",
  );
  assert.match(repoSrc, /isRestricted:\s*false/);
  assert.match(repoSrc, /MAX_HUB_LIST_MEMBERSHIPS = 100/);
  assert.match(repoSrc, /MAX_ADMIN_DEFAULT_HUBS = 50/);
  assert.match(repoSrc, /updateHubLiveClassAtomic/);
  assert.equal(repoSrc.includes("findHubMemberById"), false);
  assert.equal(repoSrc.includes("updateHubMemberRole"), false);
  assert.equal(repoSrc.includes("deleteHubMemberById"), false);

  const adminRoutesSrc = fs.readFileSync(
    path.resolve(process.cwd(), "src/modules/admin/admin.routes.ts"),
    "utf8",
  );
  assert.match(adminRoutesSrc, /validateRequest\(adminCourseHubsQuerySchema\)/);

  const adminServiceSrc = fs.readFileSync(
    path.resolve(process.cwd(), "src/modules/admin/admin.service.ts"),
    "utf8",
  );
  assert.equal(adminServiceSrc.includes("classNotices:"), false);
  assert.equal(/\bas any\b/.test(adminServiceSrc), false);
});
