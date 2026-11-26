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
  MAX_HUB_RESOURCES_LIST,
  MAX_RESOURCE_ATTACHMENTS,
  MAX_RESOURCE_DESCRIPTION_LENGTH,
  MAX_RESOURCE_LINKS,
  MAX_RESOURCE_TITLE_LENGTH,
  canRoleDeleteResource,
  isSafeResourceHttpUrl,
} from "../src/modules/hub/resources/resources.domain";
import {
  createResourceSchema,
  getResourcesQuerySchema,
  resourceParamSchema,
} from "../src/modules/hub/resources/resources.schema";
import { resourceWriteLimiter } from "../src/modules/hub/resources/resources.routes";
import { googleDriveStatusLimiter } from "../src/modules/user/user.routes";

const VALID_HUB_ID = "11111111-1111-4111-8111-111111111111";
const VALID_RESOURCE_ID = "22222222-2222-4222-8222-222222222222";

function readApiFile(relPath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), "utf8");
}

test("Resources domain: enforces HTTP(S) URLs and Option A deletion matrix", () => {
  assert.equal(isSafeResourceHttpUrl("https://drive.google.com/file/d/abc/view"), true);
  assert.equal(isSafeResourceHttpUrl("http://example.com/slides.pdf"), true);
  assert.equal(isSafeResourceHttpUrl("javascript:alert(1)"), false);
  assert.equal(isSafeResourceHttpUrl("data:text/html,<script>1</script>"), false);
  assert.equal(isSafeResourceHttpUrl("file:///etc/passwd"), false);
  assert.equal(isSafeResourceHttpUrl("not-a-url"), false);

  // TEACHER can delete any official or student-shared resource
  assert.equal(
    canRoleDeleteResource({
      role: "TEACHER",
      userId: "u-teacher",
      uploaderId: "u-other",
      isStudentNote: false,
    }),
    true,
  );
  assert.equal(
    canRoleDeleteResource({
      role: "TEACHER",
      userId: "u-teacher",
      uploaderId: "u-student",
      isStudentNote: true,
    }),
    true,
  );

  // CR can delete own official & any student-shared resource, but NOT teacher's official material
  assert.equal(
    canRoleDeleteResource({
      role: "CR",
      userId: "u-cr",
      uploaderId: "u-cr",
      isStudentNote: false,
    }),
    true,
  );
  assert.equal(
    canRoleDeleteResource({
      role: "CR",
      userId: "u-cr",
      uploaderId: "u-student",
      isStudentNote: true,
    }),
    true,
  );
  assert.equal(
    canRoleDeleteResource({
      role: "CR",
      userId: "u-cr",
      uploaderId: "u-teacher",
      isStudentNote: false,
    }),
    false,
  );

  // STUDENT can only delete their own student-shared resources
  assert.equal(
    canRoleDeleteResource({
      role: "STUDENT",
      userId: "u-student",
      uploaderId: "u-student",
      isStudentNote: true,
    }),
    true,
  );
  assert.equal(
    canRoleDeleteResource({
      role: "STUDENT",
      userId: "u-student",
      uploaderId: "u-other-student",
      isStudentNote: true,
    }),
    false,
  );
  assert.equal(
    canRoleDeleteResource({
      role: "STUDENT",
      userId: "u-student",
      uploaderId: "u-student",
      isStudentNote: false,
    }),
    false,
  );

  // ADMIN is strictly read-only
  assert.equal(
    canRoleDeleteResource({
      role: "ADMIN",
      userId: "u-admin",
      uploaderId: "u-admin",
      isStudentNote: true,
    }),
    false,
  );
});

test("API-16: Resources Zod schemas enforce strict UUID params, safe URLs, and 10-item caps", () => {
  assert.equal(
    getResourcesQuerySchema.safeParse({
      params: { id: "not-a-uuid" },
      query: {},
    }).success,
    false,
  );
  assert.equal(
    getResourcesQuerySchema.safeParse({
      params: { id: VALID_HUB_ID },
      query: { isStudentNote: "true", category: "Slides" },
    }).success,
    true,
  );
  assert.equal(
    getResourcesQuerySchema.safeParse({
      params: { id: VALID_HUB_ID },
      query: { isStudentNote: "maybe" },
    }).success,
    false,
  );

  assert.equal(
    resourceParamSchema.safeParse({
      params: { id: VALID_HUB_ID, resourceId: "bad-id" },
    }).success,
    false,
  );
  assert.equal(
    resourceParamSchema.safeParse({
      params: { id: VALID_HUB_ID, resourceId: VALID_RESOURCE_ID },
    }).success,
    true,
  );

  assert.equal(
    createResourceSchema.safeParse({
      params: { id: VALID_HUB_ID },
      body: {
        title: "Week 1 Slides",
        driveUrl: "javascript:alert(1)",
      },
    }).success,
    false,
  );

  assert.equal(
    createResourceSchema.safeParse({
      params: { id: VALID_HUB_ID },
      body: {
        title: "x".repeat(MAX_RESOURCE_TITLE_LENGTH + 1),
      },
    }).success,
    false,
  );

  assert.equal(
    createResourceSchema.safeParse({
      params: { id: VALID_HUB_ID },
      body: {
        title: "Notes",
        description: "x".repeat(MAX_RESOURCE_DESCRIPTION_LENGTH + 1),
      },
    }).success,
    false,
  );

  const tooManyAttachments = Array.from(
    { length: MAX_RESOURCE_ATTACHMENTS + 1 },
    (_, i) => ({ url: `https://drive.google.com/file/d/${i}/view` }),
  );
  assert.equal(
    createResourceSchema.safeParse({
      params: { id: VALID_HUB_ID },
      body: {
        title: "Valid Title",
        attachments: tooManyAttachments,
      },
    }).success,
    false,
  );

  const tooManyLinks = Array.from(
    { length: MAX_RESOURCE_LINKS + 1 },
    (_, i) => ({ url: `https://example.com/${i}` }),
  );
  assert.equal(
    createResourceSchema.safeParse({
      params: { id: VALID_HUB_ID },
      body: {
        title: "Valid Title",
        links: tooManyLinks,
      },
    }).success,
    false,
  );

  assert.equal(
    createResourceSchema.safeParse({
      params: { id: VALID_HUB_ID },
      body: {
        title: "Midterm Pack",
        isStudentNote: true,
        attachments: [{ url: "https://drive.google.com/file/d/123/view", name: "midterm.pdf" }],
        links: [{ url: "https://github.com/example/repo", title: "Sample Repo" }],
      },
    }).success,
    true,
  );
});

test("API-8: resourceWriteLimiter and googleDriveStatusLimiter isolate per-user quotas behind campus NAT", async () => {
  const makeReq = (userId: string) =>
    ({
      ip: "203.0.113.40",
      user: { id: userId },
      headers: {},
      app: { get: () => false },
    }) as any;

  for (const [limiter, cap, prefix] of [
    [resourceWriteLimiter, 25, "res"],
    [googleDriveStatusLimiter, 30, "gdrive"],
  ] as const) {
    let blockedStatus = 0;
    for (let i = 0; i < cap + 1; i += 1) {
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
        (limiter as any)(makeReq(`${prefix}-user-1`), res, () => resolve());
      });
    }
    assert.equal(blockedStatus, 429);

    let otherAllowed = false;
    await new Promise<void>((resolve) => {
      const res = {
        setHeader: () => res,
        status: () => res,
        json: () => {
          resolve();
          return res;
        },
      } as any;
      (limiter as any)(makeReq(`${prefix}-user-2`), res, () => {
        otherAllowed = true;
        resolve();
      });
    });
    assert.equal(otherAllowed, true);
  }
});

test("API-6 & Resources contract: read/write RBAC, archived lock, upload rollback, and index", () => {
  const routesSrc = readApiFile("src/modules/hub/resources/resources.routes.ts");
  const serviceSrc = readApiFile("src/modules/hub/resources/resources.service.ts");
  const repoSrc = readApiFile("src/modules/hub/resources/resources.repository.ts");
  const uploadControllerSrc = readApiFile("src/modules/upload/upload.controller.ts");
  const uploadServiceSrc = readApiFile("src/modules/upload/upload.service.ts");
  const prismaSrc = readApiFile("prisma/schema/hub.prisma");

  assert.equal(routesSrc.includes("hub.routes"), false);
  assert.match(routesSrc, /validateRequest\(getResourcesQuerySchema\)/);
  assert.match(routesSrc, /validateRequest\(resourceParamSchema\)/);

  assert.match(
    serviceSrc,
    /getResourcesService[\s\S]*?verifyHubRole\(userId,\s*hubId,\s*\["TEACHER",\s*"CR",\s*"STUDENT",\s*"ADMIN",?\s*\]\)/,
  );
  assert.match(
    serviceSrc,
    /createResourceService[\s\S]*?verifyHubRole\(userId,\s*hubId,\s*\[\s*"TEACHER",\s*"CR",\s*"STUDENT",?\s*\]\)/,
  );
  assert.match(
    serviceSrc,
    /deleteResourceService[\s\S]*?verifyHubRole\(userId,\s*hubId,\s*\[\s*"TEACHER",\s*"CR",\s*"STUDENT",?\s*\]\)/,
  );
  assert.equal((serviceSrc.match(/assertActiveHub\(/g) || []).length, 2);
  assert.match(serviceSrc, /canRoleDeleteResource/);
  assert.match(serviceSrc, /invalidateHubCaches\(hubId\)/);

  assert.ok(repoSrc.includes(String(MAX_HUB_RESOURCES_LIST)) || repoSrc.includes("MAX_HUB_RESOURCES_LIST"));
  assert.equal(repoSrc.includes("as any"), false);
  assert.equal(uploadControllerSrc.includes('await import("./upload.service")'), false);
  assert.match(uploadServiceSrc, /uploadMultipleFilesService[\s\S]*Promise\.allSettled/);
  assert.match(prismaSrc, /model Resource[\s\S]*@@index\(\[hubId, createdAt\]\)/);
});
