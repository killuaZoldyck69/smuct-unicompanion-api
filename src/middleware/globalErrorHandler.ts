import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "../../generated/prisma/client";
import { AppError } from "../utils/AppError";
import { envConfig } from "../config/env";

export interface ErrorPayload {
  statusCode: number;
  body: {
    success: false;
    message: string;
    code?: string;
    errorSources: any[];
    stack?: string;
  };
}

/**
 * Normalize errors into safe HTTP payloads and sanitize unhandled 500 messages in production.
 */
export const formatErrorResponse = (
  err: any,
  req: Pick<Request, "method" | "originalUrl">,
  nodeEnv: string = envConfig.NODE_ENV,
): ErrorPayload => {
  let statusCode =
    typeof err?.statusCode === "number" && err.statusCode >= 400
      ? err.statusCode
      : 500;
  let message =
    typeof err?.message === "string" && err.message.trim().length > 0
      ? err.message
      : "Internal Server Error";
  let errorSources: any[] = [];
  let code: string | undefined;
  let isExpectedOperational = false;

  // Handle Zod Validation Errors
  if (err instanceof ZodError) {
    isExpectedOperational = true;
    statusCode = 400;
    const errorDetails = err.issues.map((i) => i.message).filter(Boolean);
    message =
      errorDetails.length > 0 ? errorDetails.join(". ") : "Validation Error";
    console.error(
      `[Zod Validation Error on ${req.method} ${req.originalUrl}]:`,
      JSON.stringify(err.issues),
    );
    errorSources = err.issues.map((issue) => ({
      path: issue.path[issue.path.length - 1],
      message: issue.message,
    }));
  }
  // Handle Prisma Constraint & Not-Found Errors cleanly without exposing schema details
  else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      isExpectedOperational = true;
      statusCode = 409;
      console.warn(
        "[Prisma P2002 Conflict]:",
        err.meta?.target ?? "unknown_target",
      );
      message = "A conflicting record already exists.";
      errorSources = [
        { message: "Duplicate value conflicts with an existing record." },
      ];
    } else if (err.code === "P2025" || err.code === "P2003") {
      isExpectedOperational = true;
      statusCode = 404;
      message = "Requested resource was not found.";
    } else {
      statusCode = 500;
    }
  }
  // Handle Custom AppErrors
  else if (err instanceof AppError) {
    isExpectedOperational = true;
    statusCode = err.statusCode;
    message = err.message;
    code = err.code;
  }
  // Handle Multer upload limit/format errors safely as 400 Bad Request
  else if (err?.name === "MulterError") {
    isExpectedOperational = true;
    statusCode = 400;
    if (err.code === "LIMIT_FILE_SIZE") {
      message = "Uploaded file exceeds the maximum allowed size limit.";
    } else if (
      err.code === "LIMIT_FILE_COUNT" ||
      err.code === "LIMIT_UNEXPECTED_FILE"
    ) {
      message = "Too many or unexpected upload fields provided.";
    } else {
      message = err.message || "Invalid file upload payload.";
    }
  }

  if (!isExpectedOperational && statusCode >= 500) {
    console.error(
      `[Unhandled Error on ${req.method} ${req.originalUrl}]:`,
      err instanceof Error ? err.message : "Unknown error",
    );
    if (nodeEnv === "production") {
      message = "Internal Server Error";
    }
  }

  return {
    statusCode,
    body: {
      success: false,
      message,
      ...(code ? { code } : {}),
      errorSources,
      stack: nodeEnv === "development" ? err?.stack : undefined,
    },
  };
};

export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const { statusCode, body } = formatErrorResponse(
    err,
    req,
    envConfig.NODE_ENV,
  );
  res.status(statusCode).json(body);
};
