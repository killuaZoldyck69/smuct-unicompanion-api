import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import {
  createUserKeyGenerator,
  rateLimit,
} from "../../middleware/rateLimit.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createMeme,
  deleteMeme,
  getFeed,
  getMemeById,
  reactMeme,
  reportMeme,
  updateMeme,
} from "./meme.controller";
import {
  createMemeReportBodySchema,
  createMemeReportByIdSchema,
  createMemeSchema,
  memeIdParamSchema,
  queryMemesSchema,
  reactMemeSchema,
  updateMemeSchema,
} from "./meme.schema";

const router = Router();

export const memeWriteRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: createUserKeyGenerator("meme-write"),
  message: {
    success: false,
    message: "Too many meme actions. Please try again in a few minutes.",
  },
});

export const memeReactionRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 60,
  keyGenerator: createUserKeyGenerator("meme-react"),
  message: {
    success: false,
    message: "Too many reactions in a short time. Please slow down.",
  },
});

export const memeReportRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: createUserKeyGenerator("meme-report"),
  message: {
    success: false,
    message: "Too many content reports submitted. Please try again later.",
  },
});

// Body-based UGC report endpoint (declared before `/:id`)
router.post(
  "/reports",
  requireAuth,
  memeReportRateLimiter,
  validateRequest(createMemeReportBodySchema),
  reportMeme,
);

router.post(
  "/",
  requireAuth,
  memeWriteRateLimiter,
  validateRequest(createMemeSchema),
  createMeme,
);

router.get(
  "/",
  requireAuth,
  validateRequest(queryMemesSchema),
  getFeed,
);

router.get(
  "/:id",
  requireAuth,
  validateRequest(memeIdParamSchema),
  getMemeById,
);

router.post(
  "/:id/react",
  requireAuth,
  memeReactionRateLimiter,
  validateRequest(reactMemeSchema),
  reactMeme,
);

router.post(
  "/:id/reports",
  requireAuth,
  memeReportRateLimiter,
  validateRequest(createMemeReportByIdSchema),
  reportMeme,
);

router.patch(
  "/:id",
  requireAuth,
  memeWriteRateLimiter,
  validateRequest(updateMemeSchema),
  updateMeme,
);

router.delete(
  "/:id",
  requireAuth,
  memeWriteRateLimiter,
  validateRequest(memeIdParamSchema),
  deleteMeme,
);

export const memeRoutes = router;
