import {
  createNoticeSchema,
  updateNoticeSchema,
} from "../notice.schema";

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
  console.log("🧪 Running Campus Notice Validation & Payload Unit Tests...\n");

  // 1. Create Notice: Valid full payload
  console.log("  [1/8] Testing Create Notice Schema with valid full payload...");
  const validCreatePayload = {
    body: {
      referenceNo: "SMUCT/REG/2026/089",
      title: "Revised Mid-Term Examination Schedule",
      body: "All students are hereby informed that the upcoming mid-term examinations have been rescheduled.",
      issuerName: "Dr. Par Mosiur Rahman",
      issuerDesignation: "Registrar",
      copyTo: ["Deans of all Faculties", "Heads of all Departments", "All Noticeboards"],
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

  // 2. Create Notice: Default copyTo
  console.log("  [2/8] Testing Create Notice Schema default empty copyTo array...");
  const minimalCreatePayload = {
    body: {
      title: "Holiday Announcement",
      body: "The university will remain closed on Sunday.",
      issuerName: "Md. Rafiqul Islam",
      issuerDesignation: "Assistant Registrar",
    },
  };
  const parsedMinimal = createNoticeSchema.safeParse(minimalCreatePayload);
  assert(parsedMinimal.success, "Minimal payload must pass");
  if (parsedMinimal.success) {
    assertEquals(parsedMinimal.data.body.copyTo, [], "Default copyTo must be empty array");
  }

  // 3. Create Notice: Missing title
  console.log("  [3/8] Testing Create Notice rejection of missing or empty title...");
  const missingTitle = {
    body: {
      body: "Sample notice body content.",
      issuerName: "Registrar",
      issuerDesignation: "Officer",
    },
  };
  const parsedMissingTitle = createNoticeSchema.safeParse(missingTitle);
  assert(!parsedMissingTitle.success, "Payload missing title must fail");

  const emptyTitle = {
    body: {
      title: "",
      body: "Sample notice body content.",
      issuerName: "Registrar",
      issuerDesignation: "Officer",
    },
  };
  const parsedEmptyTitle = createNoticeSchema.safeParse(emptyTitle);
  assert(!parsedEmptyTitle.success, "Payload with empty title string must fail");

  // 4. Create Notice: Missing body or issuer details
  console.log("  [4/8] Testing Create Notice rejection of missing body or issuer...");
  const missingBody = {
    body: {
      title: "Title without body",
      issuerName: "Registrar",
      issuerDesignation: "Officer",
    },
  };
  assert(!createNoticeSchema.safeParse(missingBody).success, "Missing body must fail");

  const missingIssuer = {
    body: {
      title: "Title with body",
      body: "Body text",
      issuerName: "",
      issuerDesignation: "Officer",
    },
  };
  assert(!createNoticeSchema.safeParse(missingIssuer).success, "Empty issuerName must fail");

  // 5. Update Notice: Valid partial updates
  console.log("  [5/8] Testing Update Notice Schema with partial updates...");
  const validPartialTitle = {
    body: {
      title: "Updated Notice Title",
    },
  };
  const parsedPartialTitle = updateNoticeSchema.safeParse(validPartialTitle);
  assert(parsedPartialTitle.success, "Partial update with only title must succeed");
  if (parsedPartialTitle.success) {
    assertEquals(
      parsedPartialTitle.data.body.title,
      "Updated Notice Title",
      "Parsed title must match",
    );
  }

  // 6. Update Notice: Partial update with body and referenceNo null
  console.log("  [6/8] Testing Update Notice Schema with referenceNo nullable and updated body...");
  const validPartialBody = {
    body: {
      body: "Updated body content text.",
      referenceNo: null,
      copyTo: ["New Recipient 1"],
    },
  };
  const parsedPartialBody = updateNoticeSchema.safeParse(validPartialBody);
  assert(parsedPartialBody.success, "Partial update with body and null referenceNo must succeed");

  // 7. Update Notice: Rejection of empty title or empty body
  console.log("  [7/8] Testing Update Notice Schema rejection of empty title or empty body...");
  const emptyTitleUpdate = {
    body: {
      title: "",
    },
  };
  assert(!updateNoticeSchema.safeParse(emptyTitleUpdate).success, "Empty title in update must fail");

  const emptyBodyUpdate = {
    body: {
      body: "",
    },
  };
  assert(!updateNoticeSchema.safeParse(emptyBodyUpdate).success, "Empty body in update must fail");

  // 8. Update Notice: Empty object update
  console.log("  [8/8] Testing Update Notice Schema with empty payload (no changes)...");
  const emptyUpdate = {
    body: {},
  };
  assert(updateNoticeSchema.safeParse(emptyUpdate).success, "Empty update payload must be valid");

  console.log("\n✅ All 8 Campus Notice Unit Tests Passed Successfully!\n");
}

runNoticeUnitTests();
