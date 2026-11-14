import {
  parseCsvTokens,
  validateIsoDateString,
  parseBooleanValue,
  normalizeCategory,
  validateAndParseCsv,
  generateCsvFromEvents,
  generateCsvTemplate,
} from "../calendar.csv";
import {
  normalizePagination,
  isCalendarVisibleToUser,
  expandProgramAliases,
  expandFacultyAliases,
} from "../calendar.service";
import {
  calendarIdParamSchema,
  calendarEventParamSchema,
  calendarEventInputSchema,
  updateEventInputSchema,
  createCalendarBodySchema,
  updateCalendarBodySchema,
  validateCsvSchema,
  upcomingEventsQuerySchema,
} from "../calendar.schema";
import { formatErrorResponse } from "../../../middleware/globalErrorHandler";

// Simple test assertion helper
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

export function runCalendarUnitTests() {
  console.log("🧪 Running Calendar & CSV Unit Tests...\n");

  // 1. Test CSV Tokenizer
  console.log("  [1/8] Testing RFC 4180 CSV Tokenizer & BOM Handling...");
  const sampleCsvWithBom = `\uFEFFtitle,description,category,startDate,endDate,weekNumber,isHoliday,isAllDay,remarks\r\n"Classes, Commencement","Classes start from 22.08.2026",CLASS,2026-08-22,,1,false,true,"Note with ""quotes"""\r\n`;
  const tokens = parseCsvTokens(sampleCsvWithBom);
  assertEquals(tokens.length, 2, "Should parse 2 rows (header + 1 data row)");
  assertEquals(tokens[1][0], "Classes, Commencement", "Should handle commas in quotes");
  assertEquals(tokens[1][8], 'Note with "quotes"', "Should unescape double quotes");

  // 2. Test Date Validation
  console.log("  [2/8] Testing Date Format Validation (Strict YYYY-MM-DD)...");
  assert(validateIsoDateString("2026-08-22").valid, "2026-08-22 must be valid");
  assert(validateIsoDateString("2026-02-28").valid, "2026-02-28 must be valid");
  assert(!validateIsoDateString("not-a-date").valid, "not-a-date must be rejected");
  assert(!validateIsoDateString("2026-02-31").valid, "2026-02-31 non-existent date must be rejected");

  // 3. Test Category Validation
  console.log("  [3/8] Testing Category Normalization & Validation...");
  assertEquals(normalizeCategory("CLASS").category, "CLASS", "CLASS should be CLASS");
  assertEquals(normalizeCategory("exam").category, "EXAM", "exam (lowercase) should be EXAM");
  assertEquals(normalizeCategory("Due_Date").category, "DEADLINE", "Due_Date alias should be DEADLINE");
  assertEquals(normalizeCategory("Makeup_Class").category, "MAKEUP_CLASS", "Makeup_Class should be MAKEUP_CLASS");
  assert(!normalizeCategory("UNKNOWN_CAT_123").valid, "UNKNOWN_CAT_123 must be invalid");

  // 4. Test Boolean Parser
  console.log("  [4/8] Testing Boolean Value Parser...");
  assertEquals(parseBooleanValue("true", false).value, true, "true should be true");
  assertEquals(parseBooleanValue("1", false).value, true, "1 should be true");
  assertEquals(parseBooleanValue("false", true).value, false, "false should be false");
  assertEquals(parseBooleanValue("", true).value, true, "empty should use default");

  // 5. Test CSV Full Validation with Errors
  console.log("  [5/8] Testing Error Reporting for Malformed CSV...");
  const invalidCsv = `title,description,category,startDate,endDate,weekNumber,isHoliday,isAllDay,remarks
,Missing title event,CLASS,2026-08-22,,1,false,true,
Valid Event,,CLASS,31/08/2026,,2,false,true,
End Before Start,,CLASS,2026-09-10,2026-09-01,3,false,true,
Invalid Cat,,UNKNOWN_CAT,2026-09-15,,4,false,true,`;

  const invalidResult = validateAndParseCsv(invalidCsv);
  assert(!invalidResult.isValid, "Malformed CSV must be marked invalid");
  assert(invalidResult.errors.length >= 4, "Should report at least 4 row-level errors");
  assert(invalidResult.errors.some((e) => e.rowNumber === 2 && e.field === "title"), "Row 2 missing title error");
  assert(invalidResult.errors.some((e) => e.rowNumber === 3 && e.field === "startDate"), "Row 3 invalid date error");
  assert(invalidResult.errors.some((e) => e.rowNumber === 4 && e.field === "endDate"), "Row 4 endDate before startDate error");
  assert(invalidResult.errors.some((e) => e.rowNumber === 5 && e.field === "category"), "Row 5 unknown category error");

  // 6. Test Valid CSV with Diff Calculation
  console.log("  [6/8] Testing Valid CSV Import with Diff Preview...");
  const validCsv = `title,description,category,startDate,endDate,weekNumber,isHoliday,isAllDay,remarks
Classes will start,Classes start 22.08,CLASS,2026-08-22,,1,false,true,
Semester Registration,Week 01,REGISTRATION,2026-08-22,2026-08-28,1,false,true,
Mid-term Examination,Offline Mode,EXAM,2026-09-30,2026-10-15,8,false,true,Offline Mode`;

  const existingDbEvents = [
    {
      title: "Classes will start",
      category: "CLASS",
      startDate: "2026-08-22",
      endDate: null,
      weekNumber: 1,
      isHoliday: false,
      remarks: null,
    },
    {
      title: "Semester Registration",
      category: "REGISTRATION",
      startDate: "2026-08-22",
      endDate: "2026-08-25", // Old date: will trigger UPDATED diff!
      weekNumber: 1,
      isHoliday: false,
      remarks: null,
    },
  ];

  const validResult = validateAndParseCsv(validCsv, existingDbEvents);
  assert(validResult.isValid, "Valid CSV must pass validation");
  assertEquals(validResult.validRowsCount, 3, "Should have 3 parsed events");
  assert(!!validResult.diffSummary, "Diff summary should be generated");
  assertEquals(validResult.diffSummary?.newCount, 1, "Should detect 1 NEW event (Mid-term)");
  assertEquals(validResult.diffSummary?.updatedCount, 1, "Should detect 1 UPDATED event (Registration with changed endDate)");
  assertEquals(validResult.diffSummary?.unchangedCount, 1, "Should detect 1 UNCHANGED event (Classes will start)");

  // 7. Test CSV Generator & Template
  console.log("  [7/8] Testing CSV Export & Round-Trip Generation...");
  const exportedCsv = generateCsvFromEvents(validResult.parsedEvents);
  assert(exportedCsv.includes("Classes will start"), "Exported CSV must contain event titles");
  assert(exportedCsv.includes("REGISTRATION"), "Exported CSV must contain categories");

  // Round-trip validation: feed exported CSV back to parser
  const roundTripResult = validateAndParseCsv(exportedCsv);
  assert(roundTripResult.isValid, "Exported CSV must be re-parseable without errors");
  assertEquals(roundTripResult.validRowsCount, 3, "Round trip must preserve all 3 rows");

  // 8. Test Template Generation
  console.log("  [8/9] Testing Template CSV Generator...");
  const template = generateCsvTemplate();
  assert(template.startsWith("title,description,category,startDate,endDate,weekNumber,isHoliday,isAllDay,remarks"), "Template has canonical header");
  const parsedTemplate = validateAndParseCsv(template);
  assert(parsedTemplate.isValid, "Template must be 100% valid CSV");

  // 9. Test Pagination Normalization
  console.log("  [9/10] Testing Calendar Pagination Normalization...");
  assertEquals(normalizePagination(undefined, undefined), { page: 1, limit: 25 }, "Defaults must be page 1 / limit 25");
  assertEquals(normalizePagination("3", "12"), { page: 3, limit: 12 }, "Positive numeric params should be preserved");
  assertEquals(normalizePagination("0", "200"), { page: 1, limit: 50 }, "Invalid values should clamp to safe defaults");

  // 10. Test Audience Visibility Normalization
  console.log("  [10/10] Testing Case-Normalized Calendar Visibility...");
  const mixedCaseCalendar = {
    status: "PUBLISHED",
    isActive: true,
    targetFaculties: ["Engineering"],
    targetPrograms: ["CSE"],
    targetBatch: "Batch 24",
  };
  const student = {
    role: "STUDENT",
    studentProfile: {
      faculty: "engineering",
      department: "Computer Science",
      program: "cse",
      batch: "batch 24",
    },
  };

  assert(
    isCalendarVisibleToUser(mixedCaseCalendar, student),
    "User should match target faculty, program, and batch regardless of case",
  );

  // 11. Test Calendar Cloner Payload Transformation
  console.log("  [11/11] Testing Calendar Clone & Duplicate Data Transformation...");
  const sampleOriginal = {
    title: "Summer 2026",
    semester: "Summer",
    academicYear: 2026,
    events: [
      {
        title: "Class Start",
        category: "CLASS" as const,
        startDate: new Date("2026-08-22T00:00:00.000Z"),
        endDate: null,
        weekNumber: 1,
        isHoliday: false,
        isAllDay: true,
        remarks: null,
      },
    ],
  };

  const clonedData = {
    title: `${sampleOriginal.title} (Copy)`,
    semester: sampleOriginal.semester,
    status: "DRAFT",
    events: sampleOriginal.events.map((e) => ({ ...e })),
  };

  assertEquals(clonedData.title, "Summer 2026 (Copy)", "Cloned calendar title should have copy suffix");
  assertEquals(clonedData.status, "DRAFT", "Cloned calendar must be in DRAFT status");
  assertEquals(clonedData.events.length, 1, "Cloned calendar must replicate events");

  // 12. Test Canonical SMUCT Program & Faculty Alias Matching
  console.log("  [12/15] Testing Canonical SMUCT Program & Faculty Alias Matching...");
  const cseTerms = expandProgramAliases("B.Sc (Hons) in Computer Science and Engineering", false);
  assert(cseTerms.includes("CSE"), "Program alias expansion should include CSE department code");
  assert(cseTerms.includes("cse"), "Program alias expansion should include lowercase cse");

  const facTerms = expandFacultyAliases("FACULTY OF ENGINEERING & TECHNOLOGY");
  assert(
    facTerms.includes("Faculty of Engineering & Technology (E&T)"),
    "Faculty alias expansion should include mobile display label",
  );

  const cseStudentProfile = {
    role: "STUDENT",
    studentProfile: {
      faculty: "FACULTY OF ENGINEERING & TECHNOLOGY",
      department: "CSE",
      program: "B.Sc (Hons) in Computer Science and Engineering",
      batch: "64",
    },
  };

  assert(
    isCalendarVisibleToUser(
      {
        status: "PUBLISHED",
        isActive: true,
        targetFaculties: [],
        targetPrograms: ["CSE"],
        targetBatch: "Batch 64",
      },
      cseStudentProfile,
    ),
    "Canonical CSE student must see batch calendar targeted by CSE department code",
  );

  assert(
    isCalendarVisibleToUser(
      {
        status: "PUBLISHED",
        isActive: true,
        targetFaculties: ["Faculty of Engineering & Technology (E&T)"],
        targetPrograms: [],
        targetBatch: null,
      },
      cseStudentProfile,
    ),
    "Canonical Engineering student must see non-batch calendar targeted by UI faculty label",
  );

  const fdtUgStudent = {
    role: "STUDENT",
    studentProfile: {
      faculty: "FACULTY OF DESIGN & TECHNOLOGY",
      department: "FDT",
      program: "BA (Hons) in Fashion Design and Technology",
      batch: "55",
    },
  };
  assert(
    !isCalendarVisibleToUser(
      {
        status: "PUBLISHED",
        isActive: true,
        targetFaculties: [],
        targetPrograms: ["M.A. in Fashion Design"],
        targetBatch: null,
      },
      fdtUgStudent,
    ),
    "UG FDT student must NOT see PG M.A. in Fashion Design calendar",
  );

  const cseTeacher = {
    role: "TEACHER",
    teacherProfile: {
      faculty: "FACULTY OF ENGINEERING & TECHNOLOGY",
      department: "CSE",
      advisoryBatch: 64,
    },
  };
  assert(
    isCalendarVisibleToUser(
      {
        status: "PUBLISHED",
        isActive: true,
        targetFaculties: [],
        targetPrograms: ["B.Sc (Hons) in Computer Science and Engineering"],
        targetBatch: "Batch 64",
      },
      cseTeacher,
    ),
    "Advisory teacher of CSE batch 64 must see CSE program batch calendar",
  );

  // 13. Test UUID Param Validation Schemas
  console.log("  [13/15] Testing UUID Route Param Schemas...");
  const sampleUuid = "550e8400-e29b-41d4-a716-446655440000";
  assert(
    calendarIdParamSchema.safeParse({ params: { id: sampleUuid } }).success,
    "Valid UUID param should pass calendarIdParamSchema",
  );
  assert(
    !calendarIdParamSchema.safeParse({ params: { id: "not-a-uuid" } }).success,
    "Invalid UUID param must fail calendarIdParamSchema",
  );
  assert(
    calendarEventParamSchema.safeParse({
      params: { id: sampleUuid, eventId: sampleUuid },
    }).success,
    "Valid event params should pass calendarEventParamSchema",
  );
  assert(
    !calendarEventParamSchema.safeParse({
      params: { id: sampleUuid, eventId: "bad-id" },
    }).success,
    "Invalid eventId must fail calendarEventParamSchema",
  );

  // 14. Test Event Input Schema Refinements
  console.log("  [14/15] Testing Event Input Bounds & Date Ordering...");
  assert(
    calendarEventInputSchema.safeParse({
      title: "Midterm Exam",
      category: "EXAM",
      startDate: "2026-09-10",
      endDate: "2026-09-15",
      weekNumber: 6,
    }).success,
    "Valid event payload should pass",
  );
  assert(
    !calendarEventInputSchema.safeParse({
      title: "Backwards Dates",
      category: "EXAM",
      startDate: "2026-09-15",
      endDate: "2026-09-10",
    }).success,
    "endDate earlier than startDate must fail",
  );
  assert(
    !calendarEventInputSchema.safeParse({
      title: "Leap/Calendar Invalid",
      category: "OTHER",
      startDate: "2026-02-31",
    }).success,
    "Non-existent calendar date must fail",
  );
  assert(
    !calendarEventInputSchema.safeParse({
      title: "Week Too High",
      category: "ACADEMIC",
      startDate: "2026-09-10",
      weekNumber: 53,
    }).success,
    "weekNumber > 52 must fail",
  );
  assert(
    !updateEventInputSchema.safeParse({
      startDate: "2026-10-10",
      endDate: "2026-10-05",
    }).success,
    "Partial update with endDate < startDate must fail",
  );

  // 15. Test CSV & Upcoming Query Bounds
  console.log("  [15/15] Testing CSV Payload & Upcoming Query Bounds...");
  assert(
    !validateCsvSchema.safeParse({
      body: { csvContent: "a".repeat(500_001) },
    }).success,
    "Oversized CSV payload (> 500KB) must fail",
  );
  assert(
    upcomingEventsQuerySchema.safeParse({ query: { limit: "25" } }).success,
    "Valid upcoming limit should pass",
  );
  assert(
    !upcomingEventsQuerySchema.safeParse({ query: { limit: "999" } }).success,
    "Upcoming limit > 50 must fail",
  );

  // 16. Test Security & Reliability Audit Fixes
  console.log("  [16/16] Testing Audience Item Validation, CSV Column Bounds & 413 Error Mapping...");
  assert(
    !createCalendarBodySchema.safeParse({
      title: "Spring 2027",
      semester: "Spring",
      academicYear: 2027,
      targetPrograms: [""],
      targetBatch: "22",
    }).success,
    "createCalendarBodySchema must reject empty-string targetPrograms items",
  );
  assert(
    !updateCalendarBodySchema.safeParse({
      targetPrograms: ["  "],
    }).success,
    "updateCalendarBodySchema must reject whitespace-only targetPrograms items",
  );
  const parsedUpdate = updateCalendarBodySchema.parse({
    targetBatch: "   ",
    semesterDuration: "",
  });
  assertEquals(parsedUpdate.targetBatch, null, "Empty targetBatch should normalize to null");
  assertEquals(parsedUpdate.semesterDuration, null, "Empty semesterDuration should normalize to null");

  const oversizedCsvResult = validateAndParseCsv(
    `title,description,category,startDate,endDate,weekNumber,isHoliday,isAllDay,remarks\n${"T".repeat(201)},desc,CLASS,2026-08-22,,1,false,true,\nOk,${"D".repeat(2001)},CLASS,2026-08-22,,1,false,true,\nOk2,desc,CLASS,2026-08-22,,1,false,true,${"R".repeat(501)}`,
  );
  assert(!oversizedCsvResult.isValid, "CSV rows exceeding field length limits must fail");
  assert(
    oversizedCsvResult.errors.some((e) => e.rowNumber === 2 && e.field === "title") &&
      oversizedCsvResult.errors.some((e) => e.rowNumber === 3 && e.field === "description") &&
      oversizedCsvResult.errors.some((e) => e.rowNumber === 4 && e.field === "remarks"),
    "CSV parser must report title (>200), description (>2000), and remarks (>500) errors",
  );

  const payloadError = formatErrorResponse(
    { type: "entity.too.large", statusCode: 413, message: "request entity too large" },
    { method: "POST", originalUrl: "/api/calendars/validate-csv" } as any,
    "production",
  );
  assertEquals(payloadError.statusCode, 413, "entity.too.large must return HTTP 413");
  assertEquals(
    payloadError.body.message,
    "Request payload exceeds the maximum allowed size limit.",
    "413 response must return safe normalized message",
  );

  console.log("\n✅ All 16 Calendar & CSV Unit Tests Passed Successfully!\n");
}

if (process.argv[1]?.includes("calendar.test.ts")) {
  runCalendarUnitTests();
}

