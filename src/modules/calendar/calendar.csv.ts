import { EventCategory } from "../../../generated/prisma/client";

export interface CsvEventRow {
  rowNumber: number;
  title: string;
  description?: string | null;
  category: EventCategory;
  startDate: string; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD or null
  weekNumber?: number | null;
  isHoliday: boolean;
  isAllDay: boolean;
  remarks?: string | null;
}

export interface CsvValidationError {
  rowNumber: number;
  field: string;
  message: string;
  rawValue?: string;
}

export interface CsvValidationWarning {
  rowNumber: number;
  field: string;
  message: string;
}

export interface CsvValidationResult {
  isValid: boolean;
  totalRows: number;
  validRowsCount: number;
  errorCount: number;
  warningCount: number;
  errors: CsvValidationError[];
  warnings: CsvValidationWarning[];
  parsedEvents: CsvEventRow[];
  diffSummary?: {
    newCount: number;
    updatedCount: number;
    unchangedCount: number;
    diffs: Array<{
      status: "NEW" | "UPDATED" | "UNCHANGED";
      title: string;
      category: string;
      startDate: string;
      endDate?: string | null;
      details?: string;
    }>;
  };
}

export const VALID_EVENT_CATEGORIES: EventCategory[] = [
  "CLASS",
  "REGISTRATION",
  "DEADLINE",
  "EXAM",
  "HOLIDAY",
  "MAKEUP_CLASS",
  "RESULT",
  "ACADEMIC",
  "OTHER",
];

const CSV_CANONICAL_HEADERS = [
  "title",
  "description",
  "category",
  "startDate",
  "endDate",
  "weekNumber",
  "isHoliday",
  "isAllDay",
  "remarks",
];

/**
 * Robust RFC 4180 CSV tokenizer and parser.
 * Handles UTF-8 BOM, quoted fields, multiline cells, and escaped quotes ("").
 */
export function parseCsvTokens(csvText: string): string[][] {
  // Strip UTF-8 BOM if present
  let text = csvText.replace(/^\uFEFF/, "");

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i++; // Skip the second quote
        } else {
          // End of quote
          insideQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentField);
        currentField = "";
      } else if (char === "\r") {
        if (nextChar === "\n") {
          i++; // Skip \n
        }
        currentRow.push(currentField);
        currentField = "";
        rows.push(currentRow);
        currentRow = [];
      } else if (char === "\n") {
        currentRow.push(currentField);
        currentField = "";
        rows.push(currentRow);
        currentRow = [];
      } else {
        currentField += char;
      }
    }
  }

  // Push last field & row if not empty
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  // Filter out completely empty rows
  return rows.filter((row) =>
    row.some((cell) => cell.trim().length > 0),
  );
}

/**
 * Validates YYYY-MM-DD format strictly.
 * Rejects DD/MM/YYYY, MM/DD/YYYY, or impossible dates like 2026-02-31.
 */
export function validateIsoDateString(dateStr: string): {
  valid: boolean;
  formatted?: string;
  error?: string;
} {
  const trimmed = dateStr.trim();
  const isoRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = trimmed.match(isoRegex);

  if (!match) {
    return {
      valid: false,
      error: `Invalid date format "${dateStr}". Strict format required: YYYY-MM-DD (e.g. 2026-08-22). Ambiguous formats like DD/MM/YYYY are not allowed.`,
    };
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12) {
    return { valid: false, error: `Invalid month "${month}" in date "${dateStr}".` };
  }

  const dateObj = new Date(Date.UTC(year, month - 1, day));
  if (
    dateObj.getUTCFullYear() !== year ||
    dateObj.getUTCMonth() !== month - 1 ||
    dateObj.getUTCDate() !== day
  ) {
    return { valid: false, error: `Calendar date "${dateStr}" does not exist.` };
  }

  return { valid: true, formatted: trimmed };
}

/**
 * Normalizes boolean strings (true/false, 1/0, yes/no).
 */
export function parseBooleanValue(
  value: string | undefined | null,
  defaultValue: boolean,
): { valid: boolean; value: boolean; error?: string } {
  if (value === undefined || value === null || value.trim() === "") {
    return { valid: true, value: defaultValue };
  }

  const lower = value.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(lower)) {
    return { valid: true, value: true };
  }
  if (["false", "0", "no", "n"].includes(lower)) {
    return { valid: true, value: false };
  }

  return {
    valid: false,
    value: defaultValue,
    error: `Invalid boolean value "${value}". Allowed: true, false, yes, no, 1, 0.`,
  };
}

/**
 * Normalizes category string to EventCategory enum.
 */
export function normalizeCategory(categoryStr: string): {
  valid: boolean;
  category: EventCategory;
  error?: string;
} {
  if (!categoryStr || categoryStr.trim() === "") {
    return { valid: true, category: "ACADEMIC" };
  }

  const upper = categoryStr.trim().toUpperCase().replace(/[-\s]/g, "_");

  // Category synonyms mapping for robustness
  const aliases: Record<string, EventCategory> = {
    CLASS: "CLASS",
    CLASSES: "CLASS",
    REGULAR_CLASS: "CLASS",
    REGISTRATION: "REGISTRATION",
    SEMESTER_REGISTRATION: "REGISTRATION",
    DEADLINE: "DEADLINE",
    DUE_DATE: "DEADLINE",
    PAYMENT_DEADLINE: "DEADLINE",
    EXAM: "EXAM",
    EXAMINATION: "EXAM",
    MIDTERM: "EXAM",
    FINAL_EXAM: "EXAM",
    HOLIDAY: "HOLIDAY",
    VACATION: "HOLIDAY",
    MAKEUP_CLASS: "MAKEUP_CLASS",
    MAKEUP: "MAKEUP_CLASS",
    RESULT: "RESULT",
    RESULT_PUBLICATION: "RESULT",
    ACADEMIC: "ACADEMIC",
    OTHER: "OTHER",
  };

  if (aliases[upper]) {
    return { valid: true, category: aliases[upper] };
  }

  return {
    valid: false,
    category: "ACADEMIC",
    error: `Unknown category "${categoryStr}". Allowed categories: ${VALID_EVENT_CATEGORIES.join(", ")}.`,
  };
}

/**
 * Validates and parses raw CSV string into validated CsvEventRow list.
 */
export function validateAndParseCsv(
  csvContent: string,
  existingEvents?: Array<{
    title: string;
    category: string;
    startDate: Date | string;
    endDate?: Date | string | null;
    weekNumber?: number | null;
    isHoliday?: boolean;
    remarks?: string | null;
  }>,
): CsvValidationResult {
  const errors: CsvValidationError[] = [];
  const warnings: CsvValidationWarning[] = [];
  const parsedEvents: CsvEventRow[] = [];

  const rawRows = parseCsvTokens(csvContent);

  if (rawRows.length === 0) {
    return {
      isValid: false,
      totalRows: 0,
      validRowsCount: 0,
      errorCount: 1,
      warningCount: 0,
      errors: [
        {
          rowNumber: 1,
          field: "file",
          message: "The provided CSV file is empty or could not be read.",
        },
      ],
      warnings: [],
      parsedEvents: [],
    };
  }

  // Header Validation
  const headerRow = rawRows[0].map((h) => h.trim().toLowerCase());
  const headerMap: Record<string, number> = {};

  headerRow.forEach((header, index) => {
    // Normalize header names (e.g. "start_date" -> "startdate", "is_holiday" -> "isholiday")
    const cleanHeader = header.replace(/[_\s-]/g, "");
    headerMap[cleanHeader] = index;
  });

  // Check required headers
  if (!("title" in headerMap)) {
    errors.push({
      rowNumber: 1,
      field: "headers",
      message: 'Missing required header "title".',
    });
  }
  if (!("startdate" in headerMap)) {
    errors.push({
      rowNumber: 1,
      field: "headers",
      message: 'Missing required header "startDate".',
    });
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      totalRows: rawRows.length - 1,
      validRowsCount: 0,
      errorCount: errors.length,
      warningCount: 0,
      errors,
      warnings,
      parsedEvents: [],
    };
  }

  const getCell = (row: string[], colName: string): string => {
    const idx = headerMap[colName.toLowerCase().replace(/[_\s-]/g, "")];
    return idx !== undefined && idx < row.length ? row[idx].trim() : "";
  };

  // Row by row validation (1-indexed, skipping header which is row 1)
  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    const rowNumber = i + 1; // 1-based index in Excel/file

    const rawTitle = getCell(row, "title");
    const rawDescription = getCell(row, "description");
    const rawCategory = getCell(row, "category");
    const rawStartDate = getCell(row, "startDate");
    const rawEndDate = getCell(row, "endDate");
    const rawWeekNumber = getCell(row, "weekNumber");
    const rawIsHoliday = getCell(row, "isHoliday");
    const rawIsAllDay = getCell(row, "isAllDay");
    const rawRemarks = getCell(row, "remarks");

    let rowHasError = false;

    // 1. Title validation
    if (!rawTitle) {
      errors.push({
        rowNumber,
        field: "title",
        message: 'Missing required field "title".',
      });
      rowHasError = true;
    }

    // 2. StartDate validation
    if (!rawStartDate) {
      errors.push({
        rowNumber,
        field: "startDate",
        message: 'Missing required field "startDate". Expected format: YYYY-MM-DD.',
      });
      rowHasError = true;
    }

    const startDateValidation = validateIsoDateString(rawStartDate);
    if (!startDateValidation.valid) {
      errors.push({
        rowNumber,
        field: "startDate",
        message: startDateValidation.error || "Invalid startDate.",
        rawValue: rawStartDate,
      });
      rowHasError = true;
    }

    // 3. EndDate validation (optional)
    let validatedEndDate: string | null = null;
    if (rawEndDate) {
      const endDateValidation = validateIsoDateString(rawEndDate);
      if (!endDateValidation.valid) {
        errors.push({
          rowNumber,
          field: "endDate",
          message: endDateValidation.error || "Invalid endDate.",
          rawValue: rawEndDate,
        });
        rowHasError = true;
      } else {
        validatedEndDate = endDateValidation.formatted || null;

        if (
          startDateValidation.valid &&
          validatedEndDate &&
          validatedEndDate < (startDateValidation.formatted || "")
        ) {
          errors.push({
            rowNumber,
            field: "endDate",
            message: `endDate "${validatedEndDate}" cannot be earlier than startDate "${startDateValidation.formatted}".`,
          });
          rowHasError = true;
        }
      }
    }

    // 4. Category validation
    const categoryValidation = normalizeCategory(rawCategory);
    if (!categoryValidation.valid) {
      errors.push({
        rowNumber,
        field: "category",
        message: categoryValidation.error || "Invalid category.",
        rawValue: rawCategory,
      });
      rowHasError = true;
    }

    // 5. Week number validation
    let parsedWeekNumber: number | null = null;
    if (rawWeekNumber) {
      const parsed = parseInt(rawWeekNumber, 10);
      if (isNaN(parsed) || parsed <= 0 || parsed > 52) {
        warnings.push({
          rowNumber,
          field: "weekNumber",
          message: `Unusual or invalid weekNumber "${rawWeekNumber}". Must be an integer between 1 and 52.`,
        });
      } else {
        parsedWeekNumber = parsed;
      }
    }

    // 6. Boolean fields validation
    const isHolidayValidation = parseBooleanValue(rawIsHoliday, false);
    if (!isHolidayValidation.valid) {
      warnings.push({
        rowNumber,
        field: "isHoliday",
        message: isHolidayValidation.error || "Invalid isHoliday value, defaulting to false.",
      });
    }

    const isAllDayValidation = parseBooleanValue(rawIsAllDay, true);
    if (!isAllDayValidation.valid) {
      warnings.push({
        rowNumber,
        field: "isAllDay",
        message: isAllDayValidation.error || "Invalid isAllDay value, defaulting to true.",
      });
    }

    if (!rowHasError) {
      parsedEvents.push({
        rowNumber,
        title: rawTitle,
        description: rawDescription || null,
        category: categoryValidation.category,
        startDate: startDateValidation.formatted!,
        endDate: validatedEndDate,
        weekNumber: parsedWeekNumber,
        isHoliday: isHolidayValidation.value,
        isAllDay: isAllDayValidation.value,
        remarks: rawRemarks || null,
      });
    }
  }

  // Calculate Diff if existing events are supplied
  let diffSummary: CsvValidationResult["diffSummary"] = undefined;
  if (existingEvents) {
    const diffs: NonNullable<CsvValidationResult["diffSummary"]>["diffs"] = [];
    let newCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;

    const formatDateStr = (d: Date | string | null | undefined): string => {
      if (!d) return "";
      if (typeof d === "string") return d.split("T")[0];
      return d.toISOString().split("T")[0];
    };

    for (const newEv of parsedEvents) {
      const match = existingEvents.find(
        (ex) =>
          ex.title.trim().toLowerCase() === newEv.title.trim().toLowerCase() &&
          formatDateStr(ex.startDate) === newEv.startDate,
      );

      if (!match) {
        newCount++;
        diffs.push({
          status: "NEW",
          title: newEv.title,
          category: newEv.category,
          startDate: newEv.startDate,
          endDate: newEv.endDate,
          details: "New event to be created",
        });
      } else {
        const matchEnd = formatDateStr(match.endDate);
        const matchCat = match.category;
        const matchRem = match.remarks || "";

        const hasChanged =
          matchEnd !== (newEv.endDate || "") ||
          matchCat !== newEv.category ||
          matchRem !== (newEv.remarks || "") ||
          (match.weekNumber ?? null) !== (newEv.weekNumber ?? null) ||
          !!match.isHoliday !== newEv.isHoliday;

        if (hasChanged) {
          updatedCount++;
          diffs.push({
            status: "UPDATED",
            title: newEv.title,
            category: newEv.category,
            startDate: newEv.startDate,
            endDate: newEv.endDate,
            details: "Updated dates/category/remarks",
          });
        } else {
          unchangedCount++;
          diffs.push({
            status: "UNCHANGED",
            title: newEv.title,
            category: newEv.category,
            startDate: newEv.startDate,
            endDate: newEv.endDate,
            details: "Identical to existing event",
          });
        }
      }
    }

    diffSummary = {
      newCount,
      updatedCount,
      unchangedCount,
      diffs,
    };
  }

  const totalDataRows = rawRows.length - 1;
  const isValid = errors.length === 0 && parsedEvents.length > 0;

  return {
    isValid,
    totalRows: totalDataRows,
    validRowsCount: parsedEvents.length,
    errorCount: errors.length,
    warningCount: warnings.length,
    errors,
    warnings,
    parsedEvents,
    diffSummary,
  };
}

/**
 * Escapes a cell value for RFC 4180 CSV output.
 */
function escapeCsvCell(value: any): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates RFC 4180 CSV content from a list of events.
 */
export function generateCsvFromEvents(
  events: Array<{
    title: string;
    description?: string | null;
    category: string;
    startDate: Date | string;
    endDate?: Date | string | null;
    weekNumber?: number | null;
    isHoliday?: boolean;
    isAllDay?: boolean;
    remarks?: string | null;
  }>,
): string {
  const formatDateStr = (d: Date | string | null | undefined): string => {
    if (!d) return "";
    if (typeof d === "string") return d.split("T")[0];
    return d.toISOString().split("T")[0];
  };

  const headerLine = CSV_CANONICAL_HEADERS.join(",");

  const lines = events.map((ev) => {
    const row = [
      escapeCsvCell(ev.title),
      escapeCsvCell(ev.description || ""),
      escapeCsvCell(ev.category),
      escapeCsvCell(formatDateStr(ev.startDate)),
      escapeCsvCell(formatDateStr(ev.endDate)),
      escapeCsvCell(ev.weekNumber ?? ""),
      escapeCsvCell(ev.isHoliday ? "true" : "false"),
      escapeCsvCell(ev.isAllDay !== false ? "true" : "false"),
      escapeCsvCell(ev.remarks || ""),
    ];
    return row.join(",");
  });

  return [headerLine, ...lines].join("\r\n");
}

/**
 * Generates a clean CSV template with headers and helpful sample rows.
 */
export function generateCsvTemplate(): string {
  const headerLine = CSV_CANONICAL_HEADERS.join(",");
  const sampleRows = [
    [
      "Classes will start",
      "Classes will start from 22.08.2026 (Saturday)",
      "CLASS",
      "2026-08-22",
      "",
      "1",
      "false",
      "true",
      "",
    ].join(","),
    [
      "Sem. Registration Week",
      "Semester Registration Week",
      "REGISTRATION",
      "2026-08-22",
      "2026-08-28",
      "1",
      "false",
      "true",
      "",
    ].join(","),
    [
      "Last Date for Semester Registration",
      "Last Date for Semester Registration and Retake",
      "DEADLINE",
      "2026-09-03",
      "",
      "2",
      "false",
      "true",
      "",
    ].join(","),
    [
      "Mid-term Examination",
      "Offline Mode",
      "EXAM",
      "2026-09-30",
      "2026-10-15",
      "8",
      "false",
      "true",
      "Offline Mode",
    ].join(","),
    [
      "National Holiday",
      "University Closed",
      "HOLIDAY",
      "2026-10-21",
      "",
      "11",
      "true",
      "true",
      "University Holiday",
    ].join(","),
  ];

  return [headerLine, ...sampleRows].join("\r\n");
}
