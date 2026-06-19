import { z } from "zod";

export const createBusSchema = z.object({
  body: z.object({
    route: z.string().min(1, "Route name is required"),
    busNumber: z.string().min(1, "Bus number is required"),
    departureTime: z.string().min(1, "Departure time is required"),
    stops: z.array(z.string()).min(1, "At least one stop must be provided"),
  }),
});

// Export the inferred type for the service layer
export type CreateBusPayload = z.infer<typeof createBusSchema>["body"];
