import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "../../generated/prisma/client";
import { AppError } from "../utils/AppError";
import { envConfig } from "../config/env";

export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let errorSources: any[] = [];

  // Handle Zod Validation Errors
  if (err instanceof ZodError) {
    statusCode = 400;
    const errorDetails = err.issues.map((i) => i.message).filter(Boolean);
    message = errorDetails.length > 0 ? errorDetails.join(". ") : "Validation Error";
    console.error(
      `[Zod Validation Error on ${req.method} ${req.originalUrl}]:`,
      JSON.stringify(err.issues)
    );
    errorSources = err.issues.map((issue) => ({
      path: issue.path[issue.path.length - 1],
      message: issue.message,
    }));
  }
  // Handle Prisma Unique Constraint Errors (e.g., Duplicate Student ID)
  else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      statusCode = 409;
      const target = Array.isArray(err.meta?.target)
        ? err.meta.target.join(", ")
        : typeof err.meta?.target === "string"
        ? err.meta.target
        : "Record";
      message = `${target} is already registered in the system.`;
      errorSources = [
        { path: err.meta?.target, message: `${target} is already in use.` },
      ];
    }
  }
  // Handle Custom AppErrors
  else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  }

  // Send uniform response
  res.status(statusCode).json({
    success: false,
    message,
    errorSources,
    stack: envConfig.NODE_ENV === "development" ? err.stack : undefined,
  });
};
