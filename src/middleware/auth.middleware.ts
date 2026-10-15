import { Request, Response, NextFunction } from "express";
import { auth } from "../lib/auth";

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const session = await auth.api.getSession({
      headers: new Headers(req.headers as Record<string, string>),
    });

    if (!session || !session.user) {
      res.status(401).json({
        success: false,
        error: "Unauthorized. Please log in first.",
      });
      return;
    }

    // Defense-in-depth: Require verified email on all authenticated application routes
    if (!session.user.emailVerified) {
      res.status(403).json({
        success: false,
        error: "Forbidden. Email verification is required before accessing this service.",
      });
      return;
    }

    req.user = session.user;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Internal server error during authentication validation.",
    });
  }
};
