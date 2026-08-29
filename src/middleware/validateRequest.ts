import { Request, Response, NextFunction } from "express";

interface ValidationSchema {
  parseAsync(data: unknown): Promise<unknown>;
}

export const validateRequest = (schema: ValidationSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = (await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      })) as {
        body?: unknown;
        query?: Record<string, unknown>;
        params?: Record<string, unknown>;
      };

      if (parsed?.body !== undefined) {
        req.body = parsed.body;
      }
      if (parsed?.query !== undefined) {
        Object.defineProperty(req, "query", {
          value: parsed.query,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
      if (parsed?.params !== undefined) {
        Object.defineProperty(req, "params", {
          value: parsed.params,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};
