import { z } from "zod";

export const getTeachersDirectoryQuerySchema = z.object({
  query: z.object({
    search: z.string().optional(),
    department: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(15),
  }),
});

export type GetTeachersDirectoryQuery = z.infer<
  typeof getTeachersDirectoryQuerySchema
>["query"];
