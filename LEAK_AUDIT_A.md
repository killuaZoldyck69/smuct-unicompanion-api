# Express/Node API Memory & Resource Leak Audit Report (Pass A8)

## Executive Summary
A dedicated memory-leak and long-running process resource audit was conducted across the entire `sumct-unicompanion-api` codebase. The audit inspected database connection pooling, in-memory data structures, timer lifecycles, event listener registrations, stream/file descriptor lifecycles, and database response payload bounds.

All identified vulnerabilities have been remediated, and the backend has been validated with clean TypeScript compilation (`tsc --noEmit` exit code 0).

---

## Detailed Findings by Category

### 1. Prisma Client Singleton Verification
- **Status**: ✅ **CLEAN / VERIFIED**
- **File**: [`src/lib/prisma.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/lib/prisma.ts)
- **Audit Findings**:
  - `new PrismaClient({ adapter })` is instantiated exactly **once** at the module level in `src/lib/prisma.ts`.
  - A global regex search across all files confirmed zero rogue `new PrismaClient()` instantiations.
  - All database queries across all route modules import and share the single exported `prisma` instance, preventing connection pool multiplication or database connection leaks.

---

### 2. Timers (`setInterval` / `setTimeout`) Lifecycle
- **Status**: 🛡️ **AUDITED & HARDENED**
- **File**: [`src/middleware/rateLimit.middleware.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/middleware/rateLimit.middleware.ts)
- **Audit Findings**:
  - Exactly one `setInterval` was identified across the codebase in `rateLimit.middleware.ts` (line 18).
  - The interval is configured with `.unref()`, preventing it from keeping the Node.js event loop active when all other tasks finish.
  - The rate limiters (`globalLimiter`, `authLimiter`) are instantiated as module singletons; no dynamic timers are spawned per request.
  - **Risk**: During high-volume traffic bursts (e.g. distributed IP flood), the in-memory `hits` map could grow before the 15-minute interval timer runs.
- **Fix Applied**: Added a maximum capacity cap (`MAX_ENTRIES = 50_000`) and proactive FIFO/TTL eviction inside the request pipeline when capacity threshold is reached.

---

### 3. Module-Level In-Memory Stores & Caches
- **Status**: 🛡️ **AUDITED & HARDENED**
- **File**: [`src/middleware/rateLimit.middleware.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/middleware/rateLimit.middleware.ts)
- **Audit Findings**:
  - The only module-level growing store identified was the IP tracking `Map<string, ClientRecord>()` in `rateLimit.middleware.ts`.
  - No unbounded arrays, Sets, or plain objects exist in services or controllers.
- **Fix Applied**: Implemented bounded capacity protection:
  ```typescript
  const MAX_ENTRIES = 50000;
  if (hits.size >= MAX_ENTRIES) {
    for (const [key, val] of hits.entries()) {
      if (now > val.resetTime || hits.size >= MAX_ENTRIES) {
        hits.delete(key);
      }
      if (hits.size < MAX_ENTRIES * 0.9) break;
    }
  }
  ```

---

### 4. Event Listeners & Process Lifecycle
- **Status**: 🛡️ **AUDITED & FIXED**
- **File**: [`src/server.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/server.ts)
- **Audit Findings**:
  - No per-request event listeners (`EventEmitter`, `.on`, `addListener`) exist in the codebase.
  - No dangling WebSocket connections or unhandled socket subscriptions exist.
  - However, `server.ts` lacked standard process-level termination listeners (`SIGINT`, `SIGTERM`), which could leave lingering active PostgreSQL backend client connections during container restarts or deployments until TCP timeouts expire.
- **Fix Applied**: Added graceful shutdown orchestration in `src/server.ts`:
  ```typescript
  const handleShutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
    if (server) {
      server.close(async () => {
        console.log("🔌 HTTP server closed.");
        await prisma.$disconnect();
        console.log("🗄️ Database disconnected cleanly.");
        process.exit(0);
      });
    } else {
      await prisma.$disconnect();
      process.exit(0);
    }
  };

  process.on("SIGINT", () => handleShutdown("SIGINT"));
  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  ```

---

### 5. Streams, Raw DB Clients & File Descriptors
- **Status**: ✅ **CLEAN / VERIFIED**
- **Files**: Entire `src/` directory.
- **Audit Findings**:
  - No unclosed `fs.createReadStream` / `createWriteStream` handles exist.
  - No raw `pg` checkouts outside Prisma's connection pool.
  - External network communications (such as transactional emails in [`src/lib/email.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/lib/email.ts)) utilize native `fetch()`, which properly releases connection handles upon request completion.

---

### 6. Unbounded Response Payloads & Query Bounding
- **Status**: 🛡️ **AUDITED & BOUNDED**
- **Files**:
  - [`src/modules/alumni/alumni.service.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/alumni/alumni.service.ts)
  - [`src/modules/event/event.service.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/event/event.service.ts)
  - [`src/modules/notice/notice.service.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/notice/notice.service.ts)
  - [`src/modules/complaint/complaint.service.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/complaint/complaint.service.ts)
  - [`src/modules/bus/bus.service.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/bus/bus.service.ts)
  - [`src/modules/blood/blood.service.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/blood/blood.service.ts)
  - [`src/modules/field/field.service.ts`](file:///d:/Mobile%20APP%20Development/All%20Projects/smuct-unicompanion/sumct-unicompanion-api/src/modules/field/field.service.ts)
- **Audit Findings**:
  - Main high-volume feeds (`/api/users`, `/api/forum`) were already paginated in Track A pass A7.
  - Secondary listing endpoints previously called `findMany()` without upper constraints. While acceptable for small tables, uncontrolled table growth could cause heavy heap allocation and response backpressure under concurrent load.
- **Fixes Applied**:
  - Added safe upper bound constraints (`take: 100`) to `getAllAlumniService`, `getAllEventsService`, `getAllNoticesService`, `getMyComplaintsService`, `getAllComplaintsService`, `getAllBusRoutesService`, `getBloodFeedService`, `getMyBookingsService`, `getAllBookingsService`, and `getApprovedScheduleService`.

---

## 7. Architectural Decisions & Tradeoffs (Distributed Caching)

### In-Memory Map vs. Redis/Upstash for Rate Limiting & Transient Cache
- **Current Approach**: In-memory `Map` with capacity-capped FIFO/TTL eviction (`MAX_ENTRIES = 50,000`).
- **Tradeoff Analysis**:
  - *Advantages*: Zero external infrastructure dependency, 0ms network latency overhead, ideal for single-instance Node deployments.
  - *Tradeoffs*: State is local to the Node process. If scaled horizontally across multiple container replicas or serverless instances behind a load balancer, rate limits are tracked per-instance rather than globally.
- **Recommendation for Future Scale**: When horizontal auto-scaling (multiple Docker containers/PM2 cluster) is introduced, migrate `rateLimit.middleware.ts` to Redis / Upstash (`ioredis` or `@upstash/ratelimit`).
