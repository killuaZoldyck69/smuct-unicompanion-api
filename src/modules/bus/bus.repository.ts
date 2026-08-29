import { prisma } from "../../lib/prisma";
import { CreateBusPayload } from "./bus.schema";

export const createBusRoute = async (data: CreateBusPayload) => {
  return await prisma.busSchedule.create({
    data: {
      route: data.route,
      busNumber: data.busNumber,
      departureTime: data.departureTime,
      stops: data.stops,
    },
  });
};

export const findAllBusRoutes = async (take = 100) => {
  return await prisma.busSchedule.findMany({
    orderBy: {
      createdAt: "asc",
    },
    take,
  });
};

export const findBusRouteById = async (id: string) => {
  return await prisma.busSchedule.findUnique({
    where: { id },
  });
};

export const deleteBusRouteById = async (id: string) => {
  return await prisma.busSchedule.delete({
    where: { id },
  });
};
