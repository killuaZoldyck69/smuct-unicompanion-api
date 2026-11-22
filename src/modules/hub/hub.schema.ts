import { z } from "zod";
import { HUB_ROLE_VALUES } from "../../constants/enums";
import {
  CLASS_NOTICE_LIMITS,
  CLASS_NOTICE_TYPES,
  normalizeClassNoticeTimeRange,
  normalizeSafeMeetUrl,
  normalizeWeekday,
  parseCalendarOrIsoDateToDhakaDay,
  parseTimeToMinutes,
} from "./class-routine.domain";

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
    courseCode: z.string().min(1, "Course code is required"),
    courseName: z.string().min(1, "Course name is required"),
    credit: z.number().positive(),
    termOffer: z.string().min(1, "Term offer is required"),
    weeklyClassSchedule: z
      .array(weeklyClassScheduleItemSchema)
      .min(1, "At least one class schedule is required")
      .max(
        CLASS_NOTICE_LIMITS.maxScheduleSlots,
        `Cannot exceed ${CLASS_NOTICE_LIMITS.maxScheduleSlots} class slots`,
      ),
    department: z.string().min(1, "Department is required"),
    batch: z.string().min(1, "Batch is required"),
    section: z.string().optional(),
    semesterNumber: z.number().positive(),
    teacherId: z.string().optional(),
  }),
});

export const joinHubSchema = z.object({
  body: z.object({
    joinCode: z
      .string()
      .length(6, { message: "Join code must be exactly 6 characters" }),
  }),
});

export const updateMemberRoleSchema = z.object({
  body: z.object({
    role: z.enum(HUB_ROLE_VALUES),
  }),
});

export const updateHubSchema = z.object({
  body: z.object({
    courseCode: z.string().optional(),
    courseName: z.string().optional(),
    credit: z.number().positive().optional(),
    department: z.string().optional(),
    batch: z.string().optional(),
    section: z.string().optional(),
    semesterNumber: z.number().int().positive().optional(),
    termOffer: z.string().optional(),
    weeklyClassSchedule: z
      .array(weeklyClassScheduleItemSchema)
      .max(
        CLASS_NOTICE_LIMITS.maxScheduleSlots,
        `Cannot exceed ${CLASS_NOTICE_LIMITS.maxScheduleSlots} class slots`,
      )
      .optional(),
    isReviewOpen: z.boolean().optional(),
    termExams: z
      .array(
        z.object({
          type: z
            .string()
            .min(1, "Exam type is required (e.g., Midterm, Final)"),
          date: z.string().optional(),
          time: z.string().optional(),
          room: z.string().optional(),
        }),
      )
      .optional(),
    meetUrl: z.string().nullable().optional(),
    isClassLive: z.boolean().optional(),
  }),
});

export const toggleLiveClassSchema = z.object({
  body: z.object({
    isClassLive: z.boolean(),
    meetUrl: z.string().nullable().optional(),
  }),
});

export const archiveHubSchema = z.object({
  body: z.object({
    isArchived: z.boolean(),
  }),
});

export const getMyHubsQuerySchema = z.object({
  query: z.object({
    view: z.enum(["default", "schedule"]).optional(),
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
export type UpdateMemberRolePayload = z.infer<
  typeof updateMemberRoleSchema
>["body"];
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
