import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import {
  createMemeSchema,
  queryMemesSchema,
  reactMemeSchema,
  updateMemeSchema,
} from "./meme.schema";
import {
  createMeme,
  deleteMeme,
  getFeed,
  getMemeById,
  reactMeme,
  updateMeme,
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

router.patch(
  "/:id",
  requireAuth,
  validateRequest(updateMemeSchema),
  updateMeme
);

router.delete("/:id", requireAuth, deleteMeme);

export const memeRoutes = router;
