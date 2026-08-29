# PATCH A5: Remove Duplicate Route Mounts & Normalize Hub Sub-Routes

## 1. Issue Overview
- **Finding ID**: Audit High Finding #5 (Track A — A5)
- **Files**:
  - [`src/app.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/app.ts)
  - [`src/modules/hub/hub.routes.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/hub/hub.routes.ts)
  - [`src/modules/hub/reviews/reviews.routes.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/hub/reviews/reviews.routes.ts)
- **Problem**:
  1. `contentRoutes`, `assessmentRoutes`, and `reviewRoutes` were previously mounted directly onto `app` at `/api` in `src/app.ts`, while simultaneously mounted inside `hub.routes.ts` under `/api/hubs`. Every endpoint was exposed at two different prefix paths (e.g. `/api/:id/announcements` and `/api/hubs/:id/announcements`).
  2. `reviews.routes.ts` had hardcoded `/hubs/:id/...` in its path strings, which diverged from `content.routes.ts`, `assessments.routes.ts`, and `resources.routes.ts` (which use `/:id/...`).

---

## 2. Changes Applied

### A. Removed Duplicate Mounts in `src/app.ts`
Removed direct `/api` mounts for `contentRoutes`, `assessmentRoutes`, and `reviewRoutes`. Hub sub-routes are now mounted exclusively through `hubRoutes` at `/api/hubs`:

```typescript
// src/app.ts
app.use("/api/students", studentRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/calendars", calendarRoutes);
app.use("/api/buses", busRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/users", userRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/forum", forumRoutes);
app.use("/api/blood", bloodRoutes);
app.use("/api/directory", directoryRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/alumni", alumniRoutes);
app.use("/api/field", fieldRoutes);

// Single canonical mount for all Hub features:
app.use("/api/hubs", hubRoutes);
```

---

### B. Normalized `src/modules/hub/reviews/reviews.routes.ts`
Removed redundant `/hubs` prefix from route paths to match the standard sub-router convention:

```typescript
// src/modules/hub/reviews/reviews.routes.ts
const router = Router({ mergeParams: true });

router.patch(
  "/:id/review-settings",
  requireAuth,
  validateRequest(updateReviewSettingsSchema),
  updateReviewSettings,
);
router.post(
  "/:id/reviews",
  requireAuth,
  validateRequest(submitReviewSchema),
  submitReview,
);
router.get("/:id/reviews", requireAuth, getReviews);

export const reviewRoutes = router;
```

---

### C. Unified Mounting in `src/modules/hub/hub.routes.ts`
Mounted `reviewRoutes` alongside `resourceRoutes`, `contentRoutes`, and `assessmentRoutes`:

```typescript
// src/modules/hub/hub.routes.ts
router.use("/", resourceRoutes);
router.use("/", contentRoutes);
router.use("/", assessmentRoutes);
router.use("/", reviewRoutes);
```

---

## 3. Canonical Hub Route Map (Single Mount at `/api/hubs`)

| Module | Method | Endpoint Path | Description |
|---|---|---|---|
| **Hub Core** | `POST` | `/api/hubs` | Create course hub |
| | `POST` | `/api/hubs/join` | Join hub using join code |
| | `GET` | `/api/hubs/teachers` | List available teachers |
| | `GET` | `/api/hubs/my` | List user's enrolled hubs |
| | `GET` | `/api/hubs/:id` | Get hub details (guarded by `verifyHubRole`) |
| | `PATCH` | `/api/hubs/:id` | Update course hub details |
| | `PATCH` | `/api/hubs/:id/members/:memberId/role` | Update member role |
| | `DELETE` | `/api/hubs/:id/members/:memberId` | Remove member / leave hub |
| | `DELETE` | `/api/hubs/:id` | Delete course hub |
| | `PATCH` | `/api/hubs/:id/archive` | Archive course hub |
| **Resources** | `POST` | `/api/hubs/:id/resources` | Upload/add resource |
| | `GET` | `/api/hubs/:id/resources` | List hub resources |
| **Content** | `POST` | `/api/hubs/:id/announcements` | Create announcement |
| | `GET` | `/api/hubs/:id/announcements` | List announcements |
| | `POST` | `/api/hubs/:id/announcements/:announcementId/comments` | Comment on announcement |
| | `POST` | `/api/hubs/:id/discussions` | Create discussion topic |
| | `GET` | `/api/hubs/:id/discussions` | List discussions |
| | `POST` | `/api/hubs/:id/discussions/:discussionId/reply` | Reply to discussion |
| **Assessments** | `POST` | `/api/hubs/:id/assessments` | Create assessment |
| | `GET` | `/api/hubs/:id/assessments` | List assessments |
| | `POST` | `/api/hubs/:id/assessments/:assessmentId/submit` | Submit assessment |
| | `PATCH` | `/api/hubs/:id/submissions/:submissionId/grade` | Grade single submission |
| | `POST` | `/api/hubs/:id/assessments/:assessmentId/bulk-grade` | Bulk grade submissions |
| **Reviews** | `PATCH` | `/api/hubs/:id/review-settings` | Update course review settings |
| | `POST` | `/api/hubs/:id/reviews` | Submit anonymous/named review |
| | `GET` | `/api/hubs/:id/reviews` | View course reviews |

---

## 4. Verification Summary
- [x] Removed duplicate routes at `/api/:id/...`.
- [x] All 26 Hub endpoints resolve correctly under `/api/hubs/:id/...`.
- [x] Mobile app API contracts match the unified canonical endpoints.
