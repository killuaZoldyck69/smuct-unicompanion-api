import { EventCategory } from "../../../generated/prisma/client";

export interface CsvEventRow {
  rowNumber: number;
  title: string;
  description?: string | null;
  category: EventCategory;
  startDate: string;
  endDate?: string | null;
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

export interface CsvDiffItem {
  status: "NEW" | "UPDATED" | "UNCHANGED";
  title: string;
  category: string;
  startDate: string;
  endDate?: string | null;
  details?: string;
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
    diffs: CsvDiffItem[];
  };
}

export interface ExistingCalendarEventSnapshot {
  title: string;
  description?: string | null;
  category: string;
  startDate: Date | string;
  endDate?: Date | string | null;
  weekNumber?: number | null;
  isHoliday?: boolean;
  isAllDay?: boolean;
  remarks?: string | null;
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
] as const;

const MAX_ALLOWED_CSV_ROWS = 500;

const CATEGORY_ALIASES: Record<string, EventCategory> = {
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

const TRUTHY_BOOL = new Set(["true", "1", "yes", "y"]);
const FALSY_BOOL = new Set(["false", "0", "no", "n"]);

const formatDateYmd = (value: Date | string | null | undefined): string => {
  if (!value) return "";
  return typeof value === "string"
    ? value.split("T")[0]
    : value.toISOString().split("T")[0];
};

const normalizeHeaderKey = (header: string): string =>
  header.trim().toLowerCase().replace(/[_\s-]/g, "");

const emptyResult = (
  totalRows: number,
  errors: CsvValidationError[],
): CsvValidationResult => ({
  isValid: false,
  totalRows,
  validRowsCount: 0,
  errorCount: errors.length,
  warningCount: 0,
  errors,
  warnings: [],
  parsedEvents: [],
});

export function parseCsvTokens(csvText: string): string[][] {
  const text = csvText.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const commitRow = () => {
    row.push(field);
    rows.push(row);
    row = [];
    field = "";
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\r") {
      if (next === "\n") i++;
      commitRow();
    } else if (ch === "\n") {
      commitRow();
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    commitRow();
  }

  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

/**
 * Parses and validates YYYY-MM-DD, spreadsheet M/D/YYYY, or ISO timestamps
 * while rejecting non-existent calendar dates such as 2026-02-31.
 */
export function validateIsoDateString(
  dateStr: string,
): { valid: true; formatted: string } | { valid: false; error: string } {
  const trimmed = dateStr.trim();
  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  const slashMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);

  let year: number;
  let month: number;
  let day: number;

  if (isoMatch) {
    year = Number.parseInt(isoMatch[1], 10);
    month = Number.parseInt(isoMatch[2], 10);
    day = Number.parseInt(isoMatch[3], 10);
  } else if (slashMatch) {
    month = Number.parseInt(slashMatch[1], 10);
    day = Number.parseInt(slashMatch[2], 10);
    year = Number.parseInt(slashMatch[3], 10);
  } else {
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return {
        valid: false,
        error: `Invalid date format "${dateStr}". Supported formats: YYYY-MM-DD or M/D/YYYY (e.g. 2026-08-22 or 8/22/2026).`,
      };
    }
    year = parsed.getUTCFullYear();
    month = parsed.getUTCMonth() + 1;
    day = parsed.getUTCDate();
  }

  if (month < 1 || month > 12) {
    return { valid: false, error: `Invalid month "${month}" in date "${dateStr}".` };
  }

  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return { valid: false, error: `Calendar date "${dateStr}" does not exist.` };
  }

  return {
    valid: true,
    formatted: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

export function parseBooleanValue(
  value: string | undefined | null,
  defaultValue: boolean,
): { valid: boolean; value: boolean; error?: string } {
  const trimmed = value?.trim().toLowerCase() ?? "";
  if (!trimmed) return { valid: true, value: defaultValue };
  if (TRUTHY_BOOL.has(trimmed)) return { valid: true, value: true };
  if (FALSY_BOOL.has(trimmed)) return { valid: true, value: false };

  return {
    valid: false,
    value: defaultValue,
    error: `Invalid boolean value "${value}". Allowed: true, false, yes, no, 1, 0.`,
  };
}

export function normalizeCategory(categoryStr: string): {
  valid: boolean;
  category: EventCategory;
  error?: string;
} {
  const trimmed = categoryStr?.trim();
  if (!trimmed) return { valid: true, category: "ACADEMIC" };

  const mapped = CATEGORY_ALIASES[trimmed.toUpperCase().replace(/[-\s]/g, "_")];
  if (mapped) return { valid: true, category: mapped };

  return {
    valid: false,
    category: "ACADEMIC",
    error: `Unknown category "${categoryStr}". Allowed categories: ${VALID_EVENT_CATEGORIES.join(", ")}.`,
  };
}

function buildDiffSummary(
  parsedEvents: CsvEventRow[],
  existingEvents: ExistingCalendarEventSnapshot[],
): NonNullable<CsvValidationResult["diffSummary"]> {
  const existingByKey = new Map<string, ExistingCalendarEventSnapshot>();
  for (const ex of existingEvents) {
    const key = `${ex.title.trim().toLowerCase()}|${formatDateYmd(ex.startDate)}`;
    if (!existingByKey.has(key)) {
      existingByKey.set(key, ex);
    }
  }

  let newCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  const diffs: CsvDiffItem[] = [];

  for (const ev of parsedEvents) {
    const match = existingByKey.get(`${ev.title.trim().toLowerCase()}|${ev.startDate}`);
    if (!match) {
      newCount++;
      diffs.push({
        status: "NEW",
        title: ev.title,
        category: ev.category,
        startDate: ev.startDate,
        endDate: ev.endDate,
        details: "New event to be created",
      });
      continue;
    }

    const changed =
      formatDateYmd(match.endDate) !== (ev.endDate ?? "") ||
      match.category !== ev.category ||
      (match.remarks ?? "") !== (ev.remarks ?? "") ||
      (match.weekNumber ?? null) !== (ev.weekNumber ?? null) ||
      Boolean(match.isHoliday) !== ev.isHoliday;

    if (changed) updatedCount++;
    else unchangedCount++;

    diffs.push({
      status: changed ? "UPDATED" : "UNCHANGED",
      title: ev.title,
      category: ev.category,
      startDate: ev.startDate,
      endDate: ev.endDate,
      details: changed ? "Updated dates/category/remarks" : "Identical to existing event",
    });
  }

  return { newCount, updatedCount, unchangedCount, diffs };
}

export function validateAndParseCsv(
  csvContent: string,
  existingEvents?: ExistingCalendarEventSnapshot[],
): CsvValidationResult {
  const rawRows = parseCsvTokens(csvContent);
  if (rawRows.length === 0) {
    return emptyResult(0, [
      {
        rowNumber: 1,
        field: "file",
        message: "The provided CSV file is empty or could not be read.",
      },
    ]);
  }

  const totalDataRows = rawRows.length - 1;
  if (totalDataRows > MAX_ALLOWED_CSV_ROWS) {
    return emptyResult(totalDataRows, [
      {
        rowNumber: 1,
        field: "file",
        message: `The uploaded CSV contains ${totalDataRows} events, which exceeds the maximum limit of ${MAX_ALLOWED_CSV_ROWS} events per academic schedule.`,
      },
    ]);
  }

  const headerMap = new Map<string, number>();
  rawRows[0].forEach((header, idx) => headerMap.set(normalizeHeaderKey(header), idx));

  const headerErrors: CsvValidationError[] = [];
  if (!headerMap.has("title")) {
    headerErrors.push({ rowNumber: 1, field: "headers", message: 'Missing required header "title".' });
  }
  if (!headerMap.has("startdate")) {
    headerErrors.push({ rowNumber: 1, field: "headers", message: 'Missing required header "startDate".' });
  }
  if (headerErrors.length > 0) {
    return emptyResult(totalDataRows, headerErrors);
  }

  const getCell = (row: string[], normalizedCol: string): string => {
    const idx = headerMap.get(normalizedCol);
    return idx !== undefined && idx < row.length ? row[idx].trim() : "";
  };

  const errors: CsvValidationError[] = [];
  const warnings: CsvValidationWarning[] = [];
  const parsedEvents: CsvEventRow[] = [];

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    const rowNumber = i + 1;
    let hasError = false;

    const addError = (field: string, message: string, rawValue?: string) => {
      errors.push({
        rowNumber,
        field,
        message,
        ...(rawValue !== undefined ? { rawValue } : {}),
      });
      hasError = true;
    };

    const title = getCell(row, "title");
    const description = getCell(row, "description");
    const rawCategory = getCell(row, "category");
    const rawStartDate = getCell(row, "startdate");
    const rawEndDate = getCell(row, "enddate");
    const rawWeekNumber = getCell(row, "weeknumber");
    const rawIsHoliday = getCell(row, "isholiday");
    const rawIsAllDay = getCell(row, "isallday");
    const remarks = getCell(row, "remarks");

    if (!title) {
      addError("title", 'Missing required field "title".');
    } else if (title.length > 200) {
      addError("title", "Event title cannot exceed 200 characters.");
    }

    if (description.length > 2000) {
      addError("description", "Description cannot exceed 2000 characters.");
    }
    if (remarks.length > 500) {
      addError("remarks", "Remarks cannot exceed 500 characters.");
    }

    let startDate: string | null = null;
    if (!rawStartDate) {
      addError("startDate", 'Missing required field "startDate". Expected format: YYYY-MM-DD.');
    } else {
      const parsedStart = validateIsoDateString(rawStartDate);
      if (!parsedStart.valid) {
        addError("startDate", parsedStart.error, rawStartDate);
      } else {
        startDate = parsedStart.formatted;
      }
    }

    let endDate: string | null = null;
    if (rawEndDate) {
      const parsedEnd = validateIsoDateString(rawEndDate);
      if (!parsedEnd.valid) {
        addError("endDate", parsedEnd.error, rawEndDate);
      } else {
        endDate = parsedEnd.formatted;
        if (startDate && endDate < startDate) {
          addError("endDate", `endDate "${endDate}" cannot be earlier than startDate "${startDate}".`);
        }
      }
    }

    const catResult = normalizeCategory(rawCategory);
    let category = catResult.category;
    if (!catResult.valid) {
      addError("category", catResult.error ?? "Invalid category.", rawCategory);
    } else if (
      category === "CLASS" &&
      /(commencement|next sem|next semester)/i.test(title)
    ) {
      // Future semester start is a milestone rather than an active class session.
      category = "ACADEMIC";
    }

    let weekNumber: number | null = null;
    if (rawWeekNumber) {
      const parsed = Number.parseInt(rawWeekNumber, 10);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 52) {
        warnings.push({
          rowNumber,
          field: "weekNumber",
          message: `Unusual or invalid weekNumber "${rawWeekNumber}". Must be an integer between 1 and 52.`,
        });
      } else {
        weekNumber = parsed;
      }
    }

    const holidayResult = parseBooleanValue(rawIsHoliday, false);
    if (!holidayResult.valid) {
      warnings.push({
        rowNumber,
        field: "isHoliday",
        message: holidayResult.error || "Invalid isHoliday value, defaulting to false.",
      });
    }

    let isHoliday = holidayResult.value;
    if (isHoliday && category === "DEADLINE") {
      isHoliday = false;
      warnings.push({
        rowNumber,
        field: "isHoliday",
        message: `Event "${title}" is a DEADLINE, so isHoliday was automatically corrected to false.`,
      });
    } else if (isHoliday && category === "CLASS" && !/(holiday|break)/i.test(title)) {
      isHoliday = false;
      warnings.push({
        rowNumber,
        field: "isHoliday",
        message: `Event "${title}" is categorized as CLASS, so isHoliday was automatically corrected to false.`,
      });
    }

    const allDayResult = parseBooleanValue(rawIsAllDay, true);
    if (!allDayResult.valid) {
      warnings.push({
        rowNumber,
        field: "isAllDay",
        message: allDayResult.error || "Invalid isAllDay value, defaulting to true.",
      });
    }

    if (!hasError && startDate) {
      parsedEvents.push({
        rowNumber,
        title,
        description: description || null,
        category,
        startDate,
        endDate,
        weekNumber,
        isHoliday,
        isAllDay: allDayResult.value,
        remarks: remarks || null,
      });
    }
  }

  return {
    isValid: errors.length === 0 && parsedEvents.length > 0,
    totalRows: totalDataRows,
    validRowsCount: parsedEvents.length,
    errorCount: errors.length,
    warningCount: warnings.length,
    errors,
    warnings,
    parsedEvents,
    diffSummary: existingEvents ? buildDiffSummary(parsedEvents, existingEvents) : undefined,
  };
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str = String(value);
  // Mitigate CSV formula injection (CWE-1236) when opened in spreadsheets.
  if (/^[=+@\-\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[,"\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateCsvFromEvents(events: ExistingCalendarEventSnapshot[]): string {
  const lines = events.map((ev) =>
    [
      ev.title,
      ev.description || "",
      ev.category,
      formatDateYmd(ev.startDate),
      formatDateYmd(ev.endDate),
      ev.weekNumber ?? "",
      ev.isHoliday ? "true" : "false",
      ev.isAllDay !== false ? "true" : "false",
      ev.remarks || "",
    ]
      .map(escapeCsvCell)
      .join(","),
  );

  return [CSV_CANONICAL_HEADERS.join(","), ...lines].join("\r\n");
}

export function generateCsvTemplate(): string {
  const headerLine = CSV_CANONICAL_HEADERS.join(",");
  const sampleRows = [
    ["Classes will start", "Classes will start from 22.08.2026 (Saturday)", "CLASS", "2026-08-22", "", "1", "false", "true", ""].join(","),
    ["Sem. Registration Week", "Semester Registration Week", "REGISTRATION", "2026-08-22", "2026-08-28", "1", "false", "true", ""].join(","),
    ["Last Date for Semester Registration", "Last Date for Semester Registration and Retake", "DEADLINE", "2026-09-03", "", "2", "false", "true", ""].join(","),
    ["Mid-term Examination", "Offline Mode", "EXAM", "2026-09-30", "2026-10-15", "8", "false", "true", "Offline Mode"].join(","),
    ["National Holiday", "University Closed", "HOLIDAY", "2026-10-21", "", "11", "true", "true", "University Holiday"].join(","),
  ];

  return [headerLine, ...sampleRows].join("\r\n");
}
