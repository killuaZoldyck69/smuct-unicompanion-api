import {
  createEventSchema,
  updateEventSchema,
  getEventsQuerySchema,
  eventIdParamSchema,
} from "../event.schema";
import { eventCache } from "../event.cache";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

function assertEquals(actual: any, expected: any, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Assertion Failed: ${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`,
    );
  }
}

export function runEventUnitTests() {
  console.log("🧪 Running Campus Event Validation & Cache Unit Tests...\n");

  // 1. Create Event: Valid payload
  console.log("  [1/12] Testing Create Event Schema with valid payload...");
  const validCreatePayload = {
    body: {
      title: "Annual Tech Fest 2026",
      category: "TECH",
      description: "Inter-university robotics and coding contest",
      location: "Main Auditorium & Lab 3",
      organizer: "CSE Club & Robotics Society",
      eventDate: "2026-11-15T09:00:00.000Z",
    },
  };
  const parsedCreate = createEventSchema.safeParse(validCreatePayload);
  assert(parsedCreate.success, "Valid create payload must succeed parsing");
  if (parsedCreate.success) {
    assert(
      parsedCreate.data.body.eventDate instanceof Date,
      "eventDate must be transformed into a JavaScript Date object",
    );
    assertEquals(
      parsedCreate.data.body.title,
      "Annual Tech Fest 2026",
      "Title must match input",
    );
    assertEquals(
      parsedCreate.data.body.category,
      "TECH",
      "Category must match input",
    );
  }

  // 2. Create Event: Missing title & whitespace-only title
  console.log("  [2/12] Testing Create Event Schema rejection of missing and whitespace-only title...");
  const missingTitlePayload = {
    body: {
      location: "Room 402",
      eventDate: "2026-11-15T09:00:00.000Z",
    },
  };
  const parsedMissingTitle = createEventSchema.safeParse(missingTitlePayload);
  assert(!parsedMissingTitle.success, "Payload missing title must fail");

  const whitespaceTitlePayload = {
    body: {
      title: "    ",
      location: "Room 402",
      eventDate: "2026-11-15T09:00:00.000Z",
    },
  };
  const parsedWhitespaceTitle = createEventSchema.safeParse(whitespaceTitlePayload);
  assert(!parsedWhitespaceTitle.success, "Payload with whitespace-only title must fail");

  // 3. Create Event: Title too short (< 3 chars)
  console.log("  [3/12] Testing Create Event Schema rejection of short title (< 3 chars)...");
  const shortTitlePayload = {
    body: {
      title: "Hi",
      location: "Room 402",
      eventDate: "2026-11-15T09:00:00.000Z",
    },
  };
  const parsedShortTitle = createEventSchema.safeParse(shortTitlePayload);
  assert(!parsedShortTitle.success, "Payload with 2-char title must fail");

  // 4. Create Event: Missing & short location
  console.log("  [4/12] Testing Create Event Schema rejection of missing or short location...");
  const missingLocPayload = {
    body: {
      title: "Grand Seminar",
      eventDate: "2026-11-15T09:00:00.000Z",
    },
  };
  assert(!createEventSchema.safeParse(missingLocPayload).success, "Missing location must fail");

  const shortLocPayload = {
    body: {
      title: "Grand Seminar",
      location: "A",
      eventDate: "2026-11-15T09:00:00.000Z",
    },
  };
  assert(!createEventSchema.safeParse(shortLocPayload).success, "1-char location must fail");

  // 5. Create Event: Invalid eventDate string
  console.log("  [5/12] Testing Create Event Schema rejection of invalid date string...");
  const invalidDatePayload = {
    body: {
      title: "Science Fair",
      location: "Auditorium",
      eventDate: "not-a-valid-date-string",
    },
  };
  const parsedInvalidDate = createEventSchema.safeParse(invalidDatePayload);
  assert(
    !parsedInvalidDate.success,
    "Payload with corrupted/invalid date string must be rejected",
  );

  // 6. Update Event: Valid partial update
  console.log("  [6/12] Testing Update Event Schema with partial updates...");
  const validUpdatePayload = {
    body: {
      location: "Permanent Campus Ground",
    },
  };
  const parsedUpdate = updateEventSchema.safeParse(validUpdatePayload);
  assert(parsedUpdate.success, "Partial update with only location must succeed");

  // 7. Update Event: Empty title rejection
  console.log("  [7/12] Testing Update Event Schema rejection of empty title...");
  const emptyTitleUpdate = {
    body: {
      title: "",
    },
  };
  const parsedEmptyTitle = updateEventSchema.safeParse(emptyTitleUpdate);
  assert(
    !parsedEmptyTitle.success,
    "Update with empty string title must be rejected",
  );

  // 8. Event ID Param Schema Validation
  console.log("  [8/12] Testing Event ID Parameter Schema validation...");
  const validParam = { params: { id: "evt-uuid-12345" } };
  assert(eventIdParamSchema.safeParse(validParam).success, "Valid ID param must pass");

  const emptyParam = { params: { id: "   " } };
  assert(!eventIdParamSchema.safeParse(emptyParam).success, "Whitespace ID param must fail");

  // 9. Get Events Query: Default parameters
  console.log("  [9/12] Testing Query Schema default parameters...");
  const emptyQuery = {
    query: {},
  };
  const parsedQuery = getEventsQuerySchema.safeParse(emptyQuery);
  assert(parsedQuery.success, "Empty query must succeed and populate defaults");
  if (parsedQuery.success) {
    assertEquals(parsedQuery.data.query.page, 1, "Default page must be 1");
    assertEquals(parsedQuery.data.query.limit, 10, "Default limit must be 10");
    assertEquals(
      parsedQuery.data.query.tab,
      "upcoming",
      "Default tab must be upcoming",
    );
    assertEquals(
      parsedQuery.data.query.sortBy,
      "eventDate",
      "Default sortBy must be eventDate",
    );
    assertEquals(
      parsedQuery.data.query.sortOrder,
      "asc",
      "Default sortOrder must be asc",
    );
  }

  // 10. Get Events Query: Custom search, pagination, category, and tab
  console.log("  [10/12] Testing Query Schema custom pagination, category, and search...");
  const customQuery = {
    query: {
      page: "3",
      limit: "25",
      tab: "past",
      category: "  WORKSHOP  ",
      search: "  Robotics Exhibition  ",
      sortBy: "title",
      sortOrder: "desc",
    },
  };
  const parsedCustomQuery = getEventsQuerySchema.safeParse(customQuery);
  assert(parsedCustomQuery.success, "Custom query parameters must parse cleanly");
  if (parsedCustomQuery.success) {
    assertEquals(parsedCustomQuery.data.query.page, 3, "Page must be coerced to 3");
    assertEquals(parsedCustomQuery.data.query.limit, 25, "Limit must be coerced to 25");
    assertEquals(
      parsedCustomQuery.data.query.category,
      "WORKSHOP",
      "Category parameter must be trimmed",
    );
    assertEquals(
      parsedCustomQuery.data.query.search,
      "Robotics Exhibition",
      "Search parameter must be trimmed",
    );
    assertEquals(parsedCustomQuery.data.query.tab, "past", "Tab must be past");
  }

  // 11. Event Date Lifecycle Classification
  console.log("  [11/12] Testing Event Date Boundary Classification (Today, Upcoming, Past)...");
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000 * 3); // 3 days ago
  const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000 * 3); // 3 days in future

  assert(pastDate < startOfToday, "3 days ago must be strictly before today");
  assert(futureDate > endOfToday, "3 days from now must be in upcoming window");
  assert(
    now >= startOfToday && now <= endOfToday,
    "Current moment must fall within today's boundaries",
  );

  // 12. Cache Store & Invalidation
  console.log("  [12/12] Testing Event In-Memory Cache Store and Invalidation...");
  const testKey = "events:test-user:upcoming::1:10:eventDate:asc";
  const dummyPayload = { items: [{ id: "ev-1", title: "Test Event" }] };

  eventCache.set(testKey, dummyPayload, 30);
  const retrieved = eventCache.get(testKey);
  assertEquals(retrieved, dummyPayload, "Retrieved cache data must match stored data");

  eventCache.invalidateAll();
  const afterInvalidate = eventCache.get(testKey);
  assert(afterInvalidate === null, "Cache must return null after invalidateAll()");

  console.log("\n✅ All 12 Campus Event Unit Tests Passed Successfully!\n");
}

// Execute tests directly if invoked via CLI
runEventUnitTests();
