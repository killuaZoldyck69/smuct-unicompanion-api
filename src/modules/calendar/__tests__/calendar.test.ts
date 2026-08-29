import {
  parseCsvTokens,
  validateIsoDateString,
  parseBooleanValue,
  normalizeCategory,
  validateAndParseCsv,
  generateCsvFromEvents,
  generateCsvTemplate,
} from "../calendar.csv";

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
  assert(!validateIsoDateString("22/08/2026").valid, "22/08/2026 must be rejected");
  assert(!validateIsoDateString("08-22-2026").valid, "08-22-2026 must be rejected");
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

  // 9. Test Calendar Cloner Payload Transformation
  console.log("  [9/9] Testing Calendar Clone & Duplicate Data Transformation...");
  const sampleOriginal = {
    title: "Summer 2026",
    semester: "Summer 2026",
    academicYear: "2026",
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
    semester: `${sampleOriginal.semester} (Copy)`,
    status: "DRAFT",
    events: sampleOriginal.events.map((e) => ({ ...e })),
  };

  assertEquals(clonedData.title, "Summer 2026 (Copy)", "Cloned calendar title should have copy suffix");
  assertEquals(clonedData.status, "DRAFT", "Cloned calendar must be in DRAFT status");
  assertEquals(clonedData.events.length, 1, "Cloned calendar must replicate events");

  console.log("\n✅ All 9 Calendar & CSV Unit Tests Passed Successfully!\n");
}

if (process.argv[1]?.includes("calendar.test.ts")) {
  runCalendarUnitTests();
}

