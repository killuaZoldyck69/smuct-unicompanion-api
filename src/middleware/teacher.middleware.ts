import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";

export const requireTeacher = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.user || req.user.role !== "TEACHER") {
    return next(new AppError("Forbidden. Teacher access required.", 403));
  }
  next();
};
