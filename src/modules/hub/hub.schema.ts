import { z } from "zod";
import {
  CLASS_NOTICE_LIMITS,
  CLASS_NOTICE_TYPES,
  normalizeClassNoticeTimeRange,
  normalizeSafeMeetUrl,
  normalizeScheduleStartTime,
  normalizeWeekday,
  parseCalendarOrIsoDateToDhakaDay,
  parseTimeToMinutes,
} from "./class-routine.domain";
import {
  TERM_EXAM_LIMITS,
  normalizeTermExamDateYmd,
  normalizeTermExamTime,
  normalizeTermExamType,
} from "./exam-schedule.domain";

const canonicalWeekdaySchema = z
  .string()
  .trim()
  .min(1, "Weekday is required")
  .transform((val, ctx) => {
    const normalized = normalizeWeekday(val);
    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Day must be a valid weekday (Sunday through Saturday).",
      });
      return z.NEVER;
    }
    return normalized;
  });

export const weeklyClassScheduleItemSchema = z
  .object({
    day: canonicalWeekdaySchema,
    startTime: z
      .string()
      .trim()
      .refine((val) => parseTimeToMinutes(val) !== null, {
        message: "Invalid start time format.",
      }),
    endTime: z
      .string()
      .trim()
      .refine((val) => parseTimeToMinutes(val) !== null, {
        message: "Invalid end time format.",
      }),
    room: z
      .string()
      .trim()
      .max(
        CLASS_NOTICE_LIMITS.roomMax,
        `Room must not exceed ${CLASS_NOTICE_LIMITS.roomMax} characters`,
      )
      .optional(),
  })
  .superRefine((val, ctx) => {
    const startMin = parseTimeToMinutes(val.startTime);
    const endMin = parseTimeToMinutes(val.endTime);
    if (startMin !== null && endMin !== null && endMin <= startMin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: "End time must be after start time.",
      });
    }
  });

export const createHubSchema = z.object({
  body: z.object({
    courseCode: z
      .string()
      .trim()
      .min(1, "Course code is required")
      .max(24, "Course code must not exceed 24 characters"),
    courseName: z
      .string()
      .trim()
      .min(1, "Course name is required")
      .max(120, "Course name must not exceed 120 characters"),
    credit: z
      .number()
      .finite()
      .min(0.5, "Credit must be at least 0.5")
      .max(20, "Credit must not exceed 20"),
    termOffer: z
      .string()
      .trim()
      .min(1, "Term offer is required")
      .max(40, "Term offer must not exceed 40 characters"),
    weeklyClassSchedule: z
      .array(weeklyClassScheduleItemSchema)
      .min(1, "At least one class schedule is required")
      .max(
        CLASS_NOTICE_LIMITS.maxScheduleSlots,
        `Cannot exceed ${CLASS_NOTICE_LIMITS.maxScheduleSlots} class slots`,
      ),
    department: z
      .string()
      .trim()
      .min(1, "Department is required")
      .max(120, "Department must not exceed 120 characters"),
    batch: z
      .string()
      .trim()
      .min(1, "Batch is required")
      .max(20, "Batch must not exceed 20 characters"),
    section: z
      .string()
      .trim()
      .max(16, "Section must not exceed 16 characters")
      .optional()
      .transform((val) => (val ? val : undefined)),
    semesterNumber: z
      .number()
      .int("Semester must be a whole number")
      .min(1, "Semester must be at least 1")
      .max(12, "Semester must not exceed 12"),
    teacherId: z.string().trim().uuid("Invalid teacher ID").optional(),
  }),
});

export const joinHubSchema = z.object({
  body: z.object({
    joinCode: z
      .string()
      .trim()
      .transform((val) => val.toUpperCase())
      .refine((val) => /^[A-Z0-9]{6}$/.test(val), {
        message: "Join code must be exactly 6 letters or numbers",
      }),
  }),
});

const optionalSafeMeetUrlSchema = z
  .string()
  .trim()
  .max(
    CLASS_NOTICE_LIMITS.meetUrlMax,
    `Meeting link must not exceed ${CLASS_NOTICE_LIMITS.meetUrlMax} characters`,
  )
  .nullable()
  .optional()
  .transform((val, ctx): string | null | undefined => {
    if (val === undefined || val === null) return val;
    if (val === "") return null;
    const safe = normalizeSafeMeetUrl(val);
    if (!safe) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Meeting URL must be a valid public http:// or https:// link.",
      });
      return z.NEVER;
    }
    return safe;
  });

const termExamItemSchema = z.object({
  type: z
    .string()
    .trim()
    .min(1, "Exam type is required (Midterm or Final)")
    .transform((val, ctx) => {
      const normalized = normalizeTermExamType(val);
      if (!normalized) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Exam type must be Midterm or Final.",
        });
        return z.NEVER;
      }
      return normalized;
    }),
  date: z
    .string()
    .trim()
    .min(1, "Valid exam date (YYYY-MM-DD) is required.")
    .transform((val, ctx) => {
      const normalized = normalizeTermExamDateYmd(val);
      if (!normalized) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Valid exam date (YYYY-MM-DD) is required.",
        });
        return z.NEVER;
      }
      return normalized;
    }),
  time: z
    .string()
    .trim()
    .max(
      TERM_EXAM_LIMITS.timeMax,
      `Exam time must not exceed ${TERM_EXAM_LIMITS.timeMax} characters`,
    )
    .nullable()
    .optional()
    .transform((val, ctx): string | undefined => {
      const normalized = normalizeTermExamTime(val);
      if (normalized === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid exam time format. Use e.g. 10:00 AM.",
        });
        return z.NEVER;
      }
      return normalized;
    }),
  room: z
    .string()
    .trim()
    .max(
      TERM_EXAM_LIMITS.roomMax,
      `Exam room must not exceed ${TERM_EXAM_LIMITS.roomMax} characters`,
    )
    .nullable()
    .optional()
    .transform((val): string | undefined => (val ? val : undefined)),
});

export const hubIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid course hub ID"),
  }),
});

export const updateHubSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid course hub ID"),
  }),
  body: z.object({
    courseCode: z
      .string()
      .trim()
      .min(1, "Course code cannot be empty")
      .max(24, "Course code must not exceed 24 characters")
      .optional(),
    courseName: z
      .string()
      .trim()
      .min(1, "Course name cannot be empty")
      .max(120, "Course name must not exceed 120 characters")
      .optional(),
    credit: z
      .number()
      .finite()
      .min(0.5, "Credit must be at least 0.5")
      .max(20, "Credit must not exceed 20")
      .optional(),
    department: z
      .string()
      .trim()
      .min(1, "Department cannot be empty")
      .max(120, "Department must not exceed 120 characters")
      .optional(),
    batch: z
      .string()
      .trim()
      .min(1, "Batch cannot be empty")
      .max(20, "Batch must not exceed 20 characters")
      .optional(),
    section: z
      .string()
      .trim()
      .max(16, "Section must not exceed 16 characters")
      .nullable()
      .optional()
      .transform((val) => (val === "" ? null : val)),
    semesterNumber: z
      .number()
      .int("Semester must be a whole number")
      .min(1, "Semester must be at least 1")
      .max(12, "Semester must not exceed 12")
      .optional(),
    termOffer: z
      .string()
      .trim()
      .min(1, "Term offer cannot be empty")
      .max(40, "Term offer must not exceed 40 characters")
      .optional(),
    weeklyClassSchedule: z
      .array(weeklyClassScheduleItemSchema)
      .max(
        CLASS_NOTICE_LIMITS.maxScheduleSlots,
        `Cannot exceed ${CLASS_NOTICE_LIMITS.maxScheduleSlots} class slots`,
      )
      .optional(),
    isReviewOpen: z.boolean().optional(),
    termExams: z
      .array(termExamItemSchema)
      .max(
        TERM_EXAM_LIMITS.maxEntries,
        `At most ${TERM_EXAM_LIMITS.maxEntries} term exams (Midterm and Final) are allowed.`,
      )
      .superRefine((items, ctx) => {
        const seen = new Set<string>();
        items.forEach((item, index) => {
          if (seen.has(item.type)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [index, "type"],
              message: `Duplicate ${item.type} exam entry is not allowed.`,
            });
          }
          seen.add(item.type);
        });
      })
      .nullable()
      .optional()
      .transform((val) => (val === null ? [] : val)),
    meetUrl: optionalSafeMeetUrlSchema,
    isClassLive: z.boolean().optional(),
  }),
});

export const toggleLiveClassSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid course hub ID"),
  }),
  body: z.object({
    isClassLive: z.boolean(),
    meetUrl: optionalSafeMeetUrlSchema,
  }),
});

export const archiveHubSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid course hub ID"),
  }),
  body: z.object({
    isArchived: z.boolean(),
  }),
});

export const getAvailableTeachersQuerySchema = z.object({
  query: z.object({
    search: z.string().trim().max(100).optional(),
    department: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
});

export const MY_HUBS_VIEWS = ["default", "list", "schedule", "exams", "cgpa"] as const;
export type MyHubsView = (typeof MY_HUBS_VIEWS)[number];

export const getMyHubsQuerySchema = z.object({
  query: z.object({
    view: z.enum(MY_HUBS_VIEWS).optional(),
  }),
});

export const createClassNoticeSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid course hub ID"),
  }),
  body: z
    .object({
      type: z.enum(CLASS_NOTICE_TYPES),
      message: z
        .string()
        .trim()
        .max(
          CLASS_NOTICE_LIMITS.messageMax,
          `Message must not exceed ${CLASS_NOTICE_LIMITS.messageMax} characters`,
        )
        .optional()
        .default(""),
      targetDay: canonicalWeekdaySchema,
      targetStartTime: z
        .string()
        .trim()
        .max(
          CLASS_NOTICE_LIMITS.targetStartTimeMax,
          "Invalid target start time",
        )
        .optional()
        .transform((val, ctx): string | undefined => {
          if (!val) return undefined;
          const normalized = normalizeScheduleStartTime(val);
          if (!normalized) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Invalid target start time format.",
            });
            return z.NEVER;
          }
          return normalized;
        }),
      effectiveDate: z
        .string()
        .trim()
        .min(1, "Effective date is required")
        .max(64, "Invalid effective date")
        .refine(
          (val) => parseCalendarOrIsoDateToDhakaDay(val) !== null,
          "Invalid effective date provided.",
        ),
      newRoom: z
        .string()
        .trim()
        .max(
          CLASS_NOTICE_LIMITS.roomMax,
          `New room must not exceed ${CLASS_NOTICE_LIMITS.roomMax} characters`,
        )
        .optional(),
      newTime: z
        .string()
        .trim()
        .max(
          CLASS_NOTICE_LIMITS.timeMax,
          `New time must not exceed ${CLASS_NOTICE_LIMITS.timeMax} characters`,
        )
        .optional(),
      meetUrl: z
        .string()
        .trim()
        .max(
          CLASS_NOTICE_LIMITS.meetUrlMax,
          `Meeting link must not exceed ${CLASS_NOTICE_LIMITS.meetUrlMax} characters`,
        )
        .optional(),
    })
    .superRefine((val, ctx) => {
      if (val.type === "ROOM_CHANGE" && !val.newRoom) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["newRoom"],
          message: "New room number is required for room change notices.",
        });
      }

      if (val.type === "TIME_CHANGE") {
        if (!val.newTime) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["newTime"],
            message: "Rescheduled time is required for time change notices.",
          });
        } else if (normalizeClassNoticeTimeRange(val.newTime) === null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["newTime"],
            message:
              "Invalid time range. Use format such as 10:30 AM - 12:00 PM.",
          });
        }
      }

      if (val.type === "ONLINE_CLASS" && val.meetUrl) {
        if (normalizeSafeMeetUrl(val.meetUrl) === null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["meetUrl"],
            message:
              "Meeting URL must be a valid public http:// or https:// link.",
          });
        }
      }
    }),
});

export const deleteClassNoticeSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid course hub ID"),
    noticeId: z.string().uuid("Invalid class notice ID"),
  }),
});

export type CreateHubPayload = z.infer<typeof createHubSchema>["body"];
export type JoinHubPayload = z.infer<typeof joinHubSchema>["body"];
export type UpdateHubPayload = z.infer<typeof updateHubSchema>["body"];
export type ToggleLiveClassPayload = z.infer<
  typeof toggleLiveClassSchema
>["body"];
export type ArchiveHubPayload = z.infer<typeof archiveHubSchema>["body"];
export type GetMyHubsQuery = z.infer<typeof getMyHubsQuerySchema>["query"];
export type CreateClassNoticePayload = z.infer<
  typeof createClassNoticeSchema
>["body"];
export type DeleteClassNoticeParams = z.infer<
  typeof deleteClassNoticeSchema
>["params"];
