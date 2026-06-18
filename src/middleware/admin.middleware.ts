import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";

export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // We assume requireAuth has already run and populated req.user
  if (!req.user || req.user.role !== "ADMIN") {
    return next(new AppError("Forbidden. Administrator access required.", 403));
  }

  next();
};
