# PATCH_A7: Database & Query Optimization Pass

## Overview
Comprehensive database and service-layer optimizations covering missing foreign key indexes, cascade safety rules, bounded pagination, and eager-loading query overhead reduction across `sumct-unicompanion-api`.

---

## 1. Schema & Database Configuration

### Prisma 7 Configuration Note
- The project uses **Prisma v7.8.0**, which moved connection strings (`DATABASE_URL`, `DIRECT_URL`) from `schema.prisma` into [`prisma.config.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/prisma.config.ts) (`datasource.url = process.env["DIRECT_URL"] || process.env["DATABASE_URL"]`).
- Placing `url` / `directUrl` directly in the `datasource db` block in Prisma 7 generates schema validation error `P1012`. The configuration was verified in `prisma.config.ts` and `prisma/schema.prisma` for standardized CLI invocation.

### Added Performance Indexes (`@@index`)
Added missing database indexes on foreign keys and frequently filtered columns:
- **`HubMember`**: `@@index([hubId])`, `@@index([userId])`
- **`HubAnnouncement`**: `@@index([hubId])`
- **`AnnouncementComment`**: `@@index([announcementId])`
- **`HubDiscussion`**: `@@index([hubId])`
- **`HubDiscussionReply`**: `@@index([discussionId])`
- **`Assessment`**: `@@index([hubId])`
- **`Submission`**: `@@index([assessmentId])`
- **`Resource`**: `@@index([hubId])`
- **`HelpPost`**: `@@index([authorId])`
- **`BloodPost`**: `@@index([authorId])`
- **`BloodResponse`**: `@@index([postId])`, `@@index([responderId])`
- **`CourseReview`**: `@@index([hubId])`
- **`Complaint`**: `@@index([userId])`
- **`FieldBooking`**: `@@index([userId])`, `@@index([status, bookingDate])`

### Cascade Safety: `Assessment.creator`
- Set `creatorId` as nullable (`String?`) on `Assessment`.
- Configured `onDelete: SetNull` on `creator User? @relation("CreatedAssessments", fields: [creatorId], references: [id], onDelete: SetNull)` to prevent foreign key constraint failures if a teacher account is removed.

---

## 2. Migration Applied
- **Migration SQL**: [`prisma/migrations/20260824202200_add_performance_indexes_and_cascade_rules/migration.sql`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/prisma/migrations/20260824202200_add_performance_indexes_and_cascade_rules/migration.sql)
- Regenerated Prisma Client to `./generated/prisma`.

---

## 3. Query & Service Optimizations

### Assessments List & Submissions Isolation
- **File**: [`src/modules/hub/assessments/assessments.service.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/hub/assessments/assessments.service.ts)
- Replaced `include: { submissions: true }` with `include: { _count: { select: { submissions: true } } }` on `getAssessments`.
- Added dedicated `getAssessmentSubmissions` service and controller endpoint (`GET /api/hubs/:id/assessments/:assessmentId/submissions`) to load detailed submission lists on demand.

### Users List Pagination & Filtering
- **Files**: [`src/modules/user/user.service.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/user/user.service.ts), [`src/modules/user/user.controller.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/user/user.controller.ts)
- Implemented `take` / `skip` pagination with default page size of 25 (max 100).
- Supports `page`, `limit`, `role`, and `search` query parameters.
- Returns `{ data: User[], meta: { page, limit, total, totalPages } }`.

### Forum Feed Optimization & Narrowed Select
- **Files**: [`src/modules/forum/forum.service.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/forum/forum.service.ts), [`src/modules/forum/forum.controller.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/forum/forum.controller.ts)
- Narrowed `author` select to `{ id, name, image, role }` (eliminating N+1 eager queries for `studentProfile` and `teacherProfile`).
- Added pagination (`page`, `limit`, `filter`, `search`) returning `{ data: HelpPost[], meta: { page, limit, total, totalPages } }`.

---

## 4. Verification Results
1. **TypeScript compilation (`tsc --noEmit`)**: **0 errors**.
2. **Prisma Generation**: Generated client to `./generated/prisma` successfully.
3. **Automated Query Execution**:
   - `getAllPostsService({ page: 1, limit: 10 })` verified: returns paginated posts with only necessary author fields and `_count.responses`.
   - `getAllUsersService({ page: 1, limit: 5 })` verified: returns 5 users out of 8 with pagination metadata.
   - `getAssessments(hubId)` verified: loads assessments with `_count.submissions`.
