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
      res.status(401).json({ error: "Unauthorized. Please log in first." });
      return;
    }

    req.user = session.user;
    next();
  } catch (error) {
    res.status(500).json({
      error: "Internal server error during authentication validation.",
    });
  }
};
