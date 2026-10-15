import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";

export type SystemRoleType = "ADMIN" | "STUDENT" | "TEACHER";

/**
 * Reusable middleware that restricts access to users with one of the specified system roles.
 * Defense-in-depth:
 * 1. Checks if req.user is populated (401 if unauthenticated).
 * 2. Checks if req.user.role exists (403 if missing).
 * 3. Rejects with 403 Forbidden if user's role is not in allowedRoles.
 */
export const requireRole = (...allowedRoles: SystemRoleType[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError("Unauthorized. Please log in first.", 401));
    }

    const userRole = req.user.role as SystemRoleType | undefined;

    if (!userRole) {
      return next(
        new AppError(
          "Forbidden. User account does not have a valid system role assigned.",
          403,
        ),
      );
    }

    if (!allowedRoles.includes(userRole)) {
      return next(
        new AppError(
          `Forbidden. Access restricted to [${allowedRoles.join(", ")}]. Current role is '${userRole}'.`,
          403,
        ),
      );
    }

    next();
  };
};

export const requireAdmin = requireRole("ADMIN");
export const requireTeacher = requireRole("TEACHER");
export const requireStudent = requireRole("STUDENT");
export const requireStaff = requireRole("ADMIN", "TEACHER");
