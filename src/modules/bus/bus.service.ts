import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { CreateBusPayload } from "./bus.schema";

export const createBusRouteService = async (data: CreateBusPayload) => {
  return await prisma.busSchedule.create({
    data: {
      route: data.route,
      busNumber: data.busNumber,
      departureTime: data.departureTime,
      stops: data.stops,
    },
  });
};

export const getAllBusRoutesService = async () => {
  return await prisma.busSchedule.findMany({
    orderBy: {
      createdAt: "asc", // Oldest routes appear first as requested
    },
  });
};

export const deleteBusRouteService = async (id: string) => {
  // Check if the bus schedule exists before attempting to delete
  const existingBusRoute = await prisma.busSchedule.findUnique({
    where: { id },
  });

  if (!existingBusRoute) {
    throw new AppError("Bus route not found.", 404);
  }

  return await prisma.busSchedule.delete({
    where: { id },
  });
};
