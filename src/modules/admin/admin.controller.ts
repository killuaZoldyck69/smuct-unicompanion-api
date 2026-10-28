import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import * as adminService from "./admin.service";
import * as systemDiagnosticsService from "./system-diagnostics.service";
import { adminCourseHubsQuerySchema } from "./admin.schema";

export const getDashboardStats = catchAsync(
  async (req: Request, res: Response) => {
    const stats = await adminService.getAdminDashboardStatsService();

    // Cache headers: short private cache for dashboard freshness
    res.setHeader(
      "Cache-Control",
      "private, max-age=15, stale-while-revalidate=30",
    );

    res.status(200).json({
      success: true,
      message: "Admin dashboard stats retrieved successfully.",
      data: stats,
    });
  },
);

export const getSystemDiagnostics = catchAsync(
  async (req: Request, res: Response) => {
    const refresh = req.query.refresh === "true";
    const diagnostics =
      await systemDiagnosticsService.getSystemDiagnosticsService(refresh);

    res.setHeader(
      "Cache-Control",
      "private, max-age=15, stale-while-revalidate=30",
    );

    res.status(200).json({
      success: true,
      message: "System diagnostics retrieved successfully.",
      data: diagnostics,
    });
  },
);

export const getAdminCourseHubs = catchAsync(
  async (req: Request, res: Response) => {
    // Validate and sanitize query parameters via Zod
    const query = adminCourseHubsQuerySchema.parse(req.query);

    const result = await adminService.getAdminCourseHubsService(query);

    // Private cache with stale-while-revalidate for snappy admin experience
    res.setHeader(
      "Cache-Control",
      "private, max-age=30, stale-while-revalidate=60",
    );

    res.status(200).json({
      success: true,
      message: "Admin course hubs retrieved successfully.",
      data: result,
    });
  },
);
