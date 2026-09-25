import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createMemeSchema,
  queryMemesSchema,
  reactMemeSchema,
} from "./meme.schema";
import {
  createMeme,
  deleteMeme,
  getFeed,
  getMemeById,
  reactMeme,
} from "./meme.controller";

const router = Router();

router.post(
  "/",
  requireAuth,
  validateRequest(createMemeSchema),
  createMeme
);

router.get(
  "/",
  requireAuth,
  validateRequest(queryMemesSchema),
  getFeed
);

router.get("/:id", requireAuth, getMemeById);

router.post(
  "/:id/react",
  requireAuth,
  validateRequest(reactMemeSchema),
  reactMeme
);

router.delete("/:id", requireAuth, deleteMeme);

export const memeRoutes = router;
