import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import * as busService from "./bus.service";

export const createBusRoute = catchAsync(
  async (req: Request, res: Response) => {
    const newBusRoute = await busService.createBusRouteService(req.body);

    res.status(201).json({
      success: true,
      message: "Bus route created successfully.",
      data: newBusRoute,
    });
  },
);

export const getBusRoutes = catchAsync(async (req: Request, res: Response) => {
  const busRoutes = await busService.getAllBusRoutesService();

  res.status(200).json({
    success: true,
    message: "Bus routes retrieved successfully.",
    data: busRoutes,
  });
});

export const deleteBusRoute = catchAsync(
  async (req: Request, res: Response) => {
    const id = req.params.id as string;

    await busService.deleteBusRouteService(id);

    res.status(200).json({
      success: true,
      message: "Bus route deleted successfully.",
    });
  },
);
