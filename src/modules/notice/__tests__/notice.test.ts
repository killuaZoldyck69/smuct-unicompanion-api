import {
  createNoticeSchema,
  updateNoticeSchema,
  getNoticesQuerySchema,
  noticeIdParamSchema,
} from "../notice.schema";
import { NoticeMemoryCache } from "../notice.cache";

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

export function runNoticeUnitTests() {
  console.log("🧪 Running Campus Notice Validation & Cache Unit Tests...\n");

  // 1. Create Notice: Valid full payload
  console.log("  [1/13] Testing Create Notice Schema with valid full payload...");
  const validCreatePayload = {
    body: {
      referenceNo: "SMUCT/REG/2026/089",
      title: "Revised Mid-Term Examination Schedule",
      body: "All students are hereby informed that the upcoming mid-term examinations have been rescheduled.",
      issuerName: "Dr. Par Mosiur Rahman",
      issuerDesignation: "Registrar",
      copyTo: [
        "Deans of all Faculties",
        "Heads of all Departments",
        "All Noticeboards",
      ],
    },
  };
  const parsedCreate = createNoticeSchema.safeParse(validCreatePayload);
  assert(parsedCreate.success, "Valid create notice payload must pass");
  if (parsedCreate.success) {
    assertEquals(
      parsedCreate.data.body.referenceNo,
      "SMUCT/REG/2026/089",
      "Reference number must match",
    );
    assertEquals(
      parsedCreate.data.body.copyTo.length,
      3,
      "copyTo array must preserve all 3 recipients",
    );
  }

  // 2. Create Notice: Default empty copyTo array
  console.log(
    "  [2/13] Testing Create Notice Schema default empty copyTo array...",
  );
  const minimalCreatePayload = {
    body: {
      referenceNo: "SMUCT/HOLIDAY/2026/01",
      title: "Holiday Announcement",
      body: "The university will remain closed on Sunday.",
      issuerName: "Md. Rafiqul Islam",
      issuerDesignation: "Assistant Registrar",
    },
  };
  const parsedMinimal = createNoticeSchema.safeParse(minimalCreatePayload);
  assert(parsedMinimal.success, "Minimal payload with referenceNo must pass");
  if (parsedMinimal.success) {
    assertEquals(
      parsedMinimal.data.body.copyTo,
      [],
      "Default copyTo must be empty array",
    );
  }

  // 3. Create Notice: Missing or empty referenceNo rejection
  console.log(
    "  [3/13] Testing Create Notice rejection of missing or empty referenceNo...",
  );
  const missingRefPayload = {
    body: {
      title: "Notice without memo",
      body: "Body content",
      issuerName: "Registrar",
      issuerDesignation: "Officer",
    },
  };
  assert(
    !createNoticeSchema.safeParse(missingRefPayload).success,
    "Payload missing referenceNo must fail",
  );

  const emptyRefPayload = {
    body: {
      referenceNo: "   ",
      title: "Notice with blank memo",
      body: "Body content",
      issuerName: "Registrar",
      issuerDesignation: "Officer",
    },
  };
  assert(
    !createNoticeSchema.safeParse(emptyRefPayload).success,
    "Payload with whitespace referenceNo must fail",
  );

  // 4. Create Notice: Missing or empty title rejection
  console.log(
    "  [4/13] Testing Create Notice rejection of missing or empty title...",
  );
  const missingTitle = {
    body: {
      referenceNo: "SMUCT/2026/001",
      body: "Sample notice body content.",
      issuerName: "Registrar",
      issuerDesignation: "Officer",
    },
  };
  assert(
    !createNoticeSchema.safeParse(missingTitle).success,
    "Payload missing title must fail",
  );

  const emptyTitle = {
    body: {
      referenceNo: "SMUCT/2026/001",
      title: "   ",
      body: "Sample notice body content.",
      issuerName: "Registrar",
      issuerDesignation: "Officer",
    },
  };
  assert(
    !createNoticeSchema.safeParse(emptyTitle).success,
    "Payload with empty title string must fail",
  );

  // 5. Create Notice: Missing body or issuer details rejection
  console.log(
    "  [5/13] Testing Create Notice rejection of missing body or issuer...",
  );
  const missingBody = {
    body: {
      referenceNo: "SMUCT/2026/002",
      title: "Title without body",
      issuerName: "Registrar",
      issuerDesignation: "Officer",
    },
  };
  assert(
    !createNoticeSchema.safeParse(missingBody).success,
    "Missing body must fail",
  );

  const missingIssuer = {
    body: {
      referenceNo: "SMUCT/2026/003",
      title: "Title with body",
      body: "Body text",
      issuerName: "",
      issuerDesignation: "Officer",
    },
  };
  assert(
    !createNoticeSchema.safeParse(missingIssuer).success,
    "Empty issuerName must fail",
  );

  // 6. Update Notice: Valid partial updates
  console.log("  [6/13] Testing Update Notice Schema with partial updates...");
  const validPartialTitle = {
    body: {
      title: "Updated Notice Title",
    },
  };
  const parsedPartialTitle = updateNoticeSchema.safeParse(validPartialTitle);
  assert(
    parsedPartialTitle.success,
    "Partial update with only title must succeed",
  );
  if (parsedPartialTitle.success) {
    assertEquals(
      parsedPartialTitle.data.body.title,
      "Updated Notice Title",
      "Parsed title must match",
    );
  }

  // 7. Update Notice: Partial update with body and referenceNo null
  console.log(
    "  [7/13] Testing Update Notice Schema with referenceNo nullable and updated body...",
  );
  const validPartialBody = {
    body: {
      body: "Updated body content text.",
      referenceNo: null,
      copyTo: ["New Recipient 1"],
    },
  };
  const parsedPartialBody = updateNoticeSchema.safeParse(validPartialBody);
  assert(
    parsedPartialBody.success,
    "Partial update with body and null referenceNo must succeed",
  );

  // 8. Update Notice: Rejection of empty title or empty body
  console.log(
    "  [8/13] Testing Update Notice Schema rejection of empty title or empty body...",
  );
  const emptyTitleUpdate = {
    body: {
      title: "   ",
    },
  };
  assert(
    !updateNoticeSchema.safeParse(emptyTitleUpdate).success,
    "Empty title in update must fail",
  );

  const emptyBodyUpdate = {
    body: {
      body: "   ",
    },
  };
  assert(
    !updateNoticeSchema.safeParse(emptyBodyUpdate).success,
    "Empty body in update must fail",
  );

  // 9. Update Notice: Empty object update
  console.log(
    "  [9/13] Testing Update Notice Schema with empty payload (no changes)...",
  );
  const emptyUpdate = {
    body: {},
  };
  assert(
    updateNoticeSchema.safeParse(emptyUpdate).success,
    "Empty update payload must be valid",
  );

  // 10. Query Schema: Default parameters
  console.log("  [10/13] Testing Notice Query Schema default parameters...");
  const defaultQuery = {
    query: {},
  };
  const parsedDefaultQuery = getNoticesQuerySchema.safeParse(defaultQuery);
  assert(parsedDefaultQuery.success, "Default query parameters must pass");
  if (parsedDefaultQuery.success) {
    assertEquals(parsedDefaultQuery.data.query.page, 1, "Default page is 1");
    assertEquals(parsedDefaultQuery.data.query.limit, 20, "Default limit is 20");
    assertEquals(
      parsedDefaultQuery.data.query.sortBy,
      "createdAt",
      "Default sortBy is createdAt",
    );
    assertEquals(
      parsedDefaultQuery.data.query.sortOrder,
      "desc",
      "Default sortOrder is desc",
    );
  }

  // 11. Query Schema: Custom pagination and search filter
  console.log(
    "  [11/13] Testing Notice Query Schema custom pagination and search...",
  );
  const customQuery = {
    query: {
      page: "2",
      limit: "15",
      search: "examination routine",
      category: "EXAM",
      sortBy: "title",
      sortOrder: "asc",
    },
  };
  const parsedCustomQuery = getNoticesQuerySchema.safeParse(customQuery);
  assert(parsedCustomQuery.success, "Custom query must be coerced and validated");
  if (parsedCustomQuery.success) {
    assertEquals(parsedCustomQuery.data.query.page, 2, "Page coerced to 2");
    assertEquals(parsedCustomQuery.data.query.limit, 15, "Limit coerced to 15");
    assertEquals(
      parsedCustomQuery.data.query.search,
      "examination routine",
      "Search term preserved",
    );
    assertEquals(parsedCustomQuery.data.query.category, "EXAM", "Category preserved");
    assertEquals(parsedCustomQuery.data.query.sortBy, "title", "SortBy title preserved");
    assertEquals(parsedCustomQuery.data.query.sortOrder, "asc", "SortOrder asc preserved");
  }

  // 12. Notice ID Param Schema: UUID validation
  console.log("  [12/13] Testing Notice ID Param Schema UUID validation...");
  const validUUID = {
    params: {
      id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    },
  };
  assert(
    noticeIdParamSchema.safeParse(validUUID).success,
    "Valid UUID in params must pass",
  );

  const invalidUUID = {
    params: {
      id: "invalid-uuid-string-1234",
    },
  };
  assert(
    !noticeIdParamSchema.safeParse(invalidUUID).success,
    "Malformed UUID in params must be rejected",
  );

  // 13. Notice In-Memory Cache Store and Invalidation
  console.log("  [13/13] Testing Notice In-Memory Cache Store and Invalidation...");
  const cache = new NoticeMemoryCache(10, 1); // 10 entries max, 1 second TTL
  cache.set("notices:all:1:20", [{ id: "n1", title: "Notice 1" }]);
  assertEquals(
    cache.get<any[]>("notices:all:1:20")?.length,
    1,
    "Cache item must be retrievable",
  );

  cache.invalidateAll();
  assertEquals(cache.get("notices:all:1:20"), null, "Cache must be cleared on invalidateAll");

  console.log("\n✅ All 13 Campus Notice Unit Tests Passed Successfully!\n");
}

runNoticeUnitTests();
