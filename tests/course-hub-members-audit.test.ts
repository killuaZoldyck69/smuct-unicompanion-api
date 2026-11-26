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
  hubMembersParamSchema,
  memberRouteParamsSchema,
  updateMemberRoleSchema,
} from "../src/modules/hub/members/members.schema";
import { MAX_HUB_MEMBERS_LIST } from "../src/modules/hub/members/members.repository";
import { memberWriteLimiter } from "../src/modules/hub/members/members.routes";

const VALID_HUB_ID = "11111111-1111-4111-8111-111111111111";
const VALID_MEMBER_ID = "22222222-2222-4222-8222-222222222222";

function readApiFile(relPath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), "utf8");
}

test("API-16: member schemas strictly validate UUID params and role enums", () => {
  assert.equal(
    hubMembersParamSchema.safeParse({ params: { id: VALID_HUB_ID } }).success,
    true,
  );
  assert.equal(
    hubMembersParamSchema.safeParse({ params: { id: "not-a-uuid" } }).success,
    false,
  );

  assert.equal(
    memberRouteParamsSchema.safeParse({
      params: { id: VALID_HUB_ID, memberId: VALID_MEMBER_ID },
    }).success,
    true,
  );
  assert.equal(
    memberRouteParamsSchema.safeParse({
      params: { id: VALID_HUB_ID, memberId: "invalid-id" },
    }).success,
    false,
  );

  for (const role of ["TEACHER", "CR", "STUDENT"] as const) {
    assert.equal(
      updateMemberRoleSchema.safeParse({
        params: { id: VALID_HUB_ID, memberId: VALID_MEMBER_ID },
        body: { role },
      }).success,
      true,
    );
  }
  assert.equal(
    updateMemberRoleSchema.safeParse({
      params: { id: VALID_HUB_ID, memberId: VALID_MEMBER_ID },
      body: { role: "CO_TEACHER" },
    }).success,
    false,
  );
});

test("API-8: memberWriteLimiter isolates per-user quotas behind shared campus NAT IP", async () => {
  const makeReq = (userId: string) =>
    ({
      ip: "203.0.113.20",
      user: { id: userId },
      headers: {},
      app: { get: () => false },
    }) as any;

  const keyGen = (
    memberWriteLimiter as unknown as {
      options?: { keyGenerator?: (req: any) => string };
    }
  ).options?.keyGenerator;

  if (typeof keyGen === "function") {
    assert.notEqual(keyGen(makeReq("user-a")), keyGen(makeReq("user-b")));
  }

  let blockedStatus = 0;
  for (let i = 0; i < 31; i += 1) {
    await new Promise<void>((resolve) => {
      const res = {
        setHeader: () => res,
        status: (code: number) => {
          blockedStatus = code;
          return res;
        },
        json: () => {
          resolve();
          return res;
        },
      } as any;
      (memberWriteLimiter as any)(
        makeReq("nat-member-user-1"),
        res,
        () => resolve(),
      );
    });
  }
  assert.equal(blockedStatus, 429);

  let otherUserAllowed = false;
  await new Promise<void>((resolve) => {
    const res = {
      setHeader: () => res,
      status: () => res,
      json: () => {
        resolve();
        return res;
      },
    } as any;
    (memberWriteLimiter as any)(makeReq("nat-member-user-2"), res, () => {
      otherUserAllowed = true;
      resolve();
    });
  });
  assert.equal(otherUserAllowed, true);
});

test("Sub-cycle 2 backend source & authorization guards hold across routes, service, and repository", () => {
  assert.equal(MAX_HUB_MEMBERS_LIST, 300);

  const routesSrc = readApiFile("src/modules/hub/members/members.routes.ts");
  assert.match(routesSrc, /validateRequest\(hubMembersParamSchema\)/);
  assert.match(routesSrc, /memberWriteLimiter/);
  assert.equal(/router\.patch\(\s*["']\/:id\/members\/:memberId["']/.test(routesSrc), false);

  const serviceSrc = readApiFile("src/modules/hub/members/members.service.ts");
  assert.match(serviceSrc, /verifyHubRole/);
  assert.match(serviceSrc, /assertActiveHub/);
  assert.match(serviceSrc, /deactivateMember/);
  assert.match(serviceSrc, /leaveHubMemberAtomic/);
  assert.equal(/\bverifyMembershipRole\b/.test(serviceSrc), false);
  assert.equal(/\bas any\b/.test(serviceSrc), false);
  assert.equal(/\breturn await\b/.test(serviceSrc), false);

  const repoSrc = readApiFile("src/modules/hub/members/members.repository.ts");
  assert.match(repoSrc, /export const MAX_HUB_MEMBERS_LIST = 300;/);
  assert.match(repoSrc, /isActive:\s*true/);
  assert.match(repoSrc, /isActive:\s*false/);
  assert.match(repoSrc, /FOR UPDATE/);
  assert.equal(/\bfindMemberById\b/.test(repoSrc), false);
  assert.equal(/\breturn await\b/.test(repoSrc), false);
});
