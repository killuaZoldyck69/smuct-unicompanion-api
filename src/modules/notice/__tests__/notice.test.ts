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

  // 1. Create Notice: Valid full payload with explicit category
  console.log("  [1/16] Testing Create Notice Schema with valid full payload (explicit category)...");
  const validCreatePayload = {
    body: {
      referenceNo: "SMUCT/REG/2026/089",
      title: "Revised Mid-Term Examination Schedule",
      category: "ACADEMIC",
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
      parsedCreate.data.body.category,
      "ACADEMIC",
      "Category must be ACADEMIC",
    );
    assertEquals(
      parsedCreate.data.body.copyTo.length,
      3,
      "copyTo array must preserve all 3 recipients",
    );
  }

  // 2. Create Notice: Default category to GENERAL when omitted
  console.log(
    "  [2/16] Testing Create Notice Schema defaults category to GENERAL when omitted...",
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
  assert(parsedMinimal.success, "Minimal payload without category must pass");
  if (parsedMinimal.success) {
    assertEquals(
      parsedMinimal.data.body.category,
      "GENERAL",
      "Default category must be GENERAL",
    );
    assertEquals(
      parsedMinimal.data.body.copyTo,
      [],
      "Default copyTo must be empty array",
    );
  }

  // 3. Create Notice: Category is normalized to uppercase
  console.log(
    "  [3/16] Testing Create Notice Schema normalizes category to uppercase...",
  );
  const lowercaseCategoryPayload = {
    body: {
      referenceNo: "SMUCT/2026/003",
      title: "Transport Notice",
      category: "transport",
      body: "Bus schedule updated.",
      issuerName: "Admin",
      issuerDesignation: "Officer",
    },
  };
  const parsedLower = createNoticeSchema.safeParse(lowercaseCategoryPayload);
  assert(parsedLower.success, "Lowercase category must be normalized and accepted");
  if (parsedLower.success) {
    assertEquals(
      parsedLower.data.body.category,
      "TRANSPORT",
      "Category must be uppercased to TRANSPORT",
    );
  }

  // 4. Create Notice: Invalid category is rejected
  console.log(
    "  [4/16] Testing Create Notice Schema rejects invalid category...",
  );
  const invalidCategoryPayload = {
    body: {
      referenceNo: "SMUCT/2026/004",
      title: "Invalid Category Notice",
      category: "EXAM",
      body: "Some content here.",
      issuerName: "Registrar",
      issuerDesignation: "Officer",
    },
  };
  assert(
    !createNoticeSchema.safeParse(invalidCategoryPayload).success,
    "Invalid category 'EXAM' must be rejected",
  );

  // 5. Create Notice: Missing or empty referenceNo rejection
  console.log(
    "  [5/16] Testing Create Notice rejection of missing or empty referenceNo...",
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

  // 6. Create Notice: Missing or empty title rejection
  console.log(
    "  [6/16] Testing Create Notice rejection of missing or empty title...",
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

  // 7. Create Notice: Missing body or issuer details rejection
  console.log(
    "  [7/16] Testing Create Notice rejection of missing body or issuer...",
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

  // 8. Update Notice: Valid partial updates including category
  console.log("  [8/16] Testing Update Notice Schema with partial updates including category...");
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

  // 9. Update Notice: Category update accepted
  console.log(
    "  [9/16] Testing Update Notice Schema with category update...",
  );
  const categoryUpdate = {
    body: {
      category: "HOLIDAY",
    },
  };
  const parsedCategoryUpdate = updateNoticeSchema.safeParse(categoryUpdate);
  assert(parsedCategoryUpdate.success, "Category-only update must succeed");
  if (parsedCategoryUpdate.success) {
    assertEquals(
      parsedCategoryUpdate.data.body.category,
      "HOLIDAY",
      "Updated category must be HOLIDAY",
    );
  }

  // 10. Update Notice: Partial update with body and referenceNo null
  console.log(
    "  [10/16] Testing Update Notice Schema with referenceNo nullable and updated body...",
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

  // 11. Update Notice: Rejection of empty title or empty body
  console.log(
    "  [11/16] Testing Update Notice Schema rejection of empty title or empty body...",
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

  // 12. Update Notice: Invalid category rejected
  console.log(
    "  [12/16] Testing Update Notice Schema rejects invalid category...",
  );
  const invalidCategoryUpdate = {
    body: {
      category: "SPORTS",
    },
  };
  assert(
    !updateNoticeSchema.safeParse(invalidCategoryUpdate).success,
    "Invalid category 'SPORTS' in update must fail",
  );

  // 13. Update Notice: Empty object update
  console.log(
    "  [13/16] Testing Update Notice Schema with empty payload (no changes)...",
  );
  const emptyUpdate = {
    body: {},
  };
  assert(
    updateNoticeSchema.safeParse(emptyUpdate).success,
    "Empty update payload must be valid",
  );

  // 14. Query Schema: Default parameters
  console.log("  [14/16] Testing Notice Query Schema default parameters...");
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

  // 15. Query Schema: Custom pagination, search, and category filter
  console.log(
    "  [15/16] Testing Notice Query Schema custom pagination, search, and category...",
  );
  const customQuery = {
    query: {
      page: "2",
      limit: "15",
      search: "examination routine",
      category: "ACADEMIC",
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
    assertEquals(parsedCustomQuery.data.query.category, "ACADEMIC", "Category ACADEMIC preserved");
    assertEquals(parsedCustomQuery.data.query.sortBy, "title", "SortBy title preserved");
    assertEquals(parsedCustomQuery.data.query.sortOrder, "asc", "SortOrder asc preserved");
  }

  // 16. Notice In-Memory Cache Store and Invalidation
  console.log("  [16/16] Testing Notice In-Memory Cache Store and Invalidation...");
  const cache = new NoticeMemoryCache(10, 1); // 10 entries max, 1 second TTL
  cache.set("notices:ACADEMIC:search:1:20", [{ id: "n1", title: "Academic Notice" }]);
  assertEquals(
    cache.get<any[]>("notices:ACADEMIC:search:1:20")?.length,
    1,
    "Cache item must be retrievable",
  );

  cache.invalidateAll();
  assertEquals(cache.get("notices:ACADEMIC:search:1:20"), null, "Cache must be cleared on invalidateAll");

  console.log("\n✅ All 16 Campus Notice Unit Tests Passed Successfully!\n");
}

runNoticeUnitTests();
