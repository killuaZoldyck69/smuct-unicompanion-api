import { AppError } from "../../utils/AppError";
import * as busRepository from "./bus.repository";
import { CreateBusPayload } from "./bus.schema";

export const createBusRouteService = async (data: CreateBusPayload) => {
  return await busRepository.createBusRoute(data);
};

export const getAllBusRoutesService = async () => {
  return await busRepository.findAllBusRoutes(100);
};

export const deleteBusRouteService = async (id: string) => {
  // Check if the bus schedule exists before attempting to delete
  const existingBusRoute = await busRepository.findBusRouteById(id);

  if (!existingBusRoute) {
    throw new AppError("Bus route not found.", 404);
  }

  return await busRepository.deleteBusRouteById(id);
};
