import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import {
  deleteMultipleImagesFromCloudinary,
  expandCloudinaryUrlVariants,
  extractPublicIdFromUrl,
  isAllowedAppCloudinaryImageUrl,
} from "../../lib/cloudinary";
import { AppError } from "../../utils/AppError";
import { MEME_CLOUDINARY_PREFIX } from "./meme.domain";

/**
 * Prevents cross-user media IDOR by rejecting meme image URLs whose Cloudinary
 * publicId or canonical variant is already owned by another user's meme.
 */
export async function assertNoForeignMemeMediaReferencesInTx(
  tx: Prisma.TransactionClient,
  authorId: string,
  imageUrl: string,
): Promise<void> {
  const trimmed = imageUrl.trim();
  if (!trimmed) return;

  const candidateUrls = expandCloudinaryUrlVariants([trimmed]);

  const foreignMeme = await tx.meme.findFirst({
    where: {
      authorId: { not: authorId },
      imageUrl: { in: candidateUrls },
    },
    select: { id: true },
  });

  if (foreignMeme) {
    throw new AppError(
      "Forbidden: You cannot attach media belonging to another user.",
      403,
    );
  }
}

/**
 * Deletes Meme Cloudinary images only if they belong to the memes folder and no
 * remaining Meme row references the URL or its underlying Cloudinary publicId.
 */
export async function deleteUnreferencedMemeImages(
  urls: Array<string | null | undefined>,
  logContext: string,
): Promise<void> {
  try {
    const uniqueUrls = [
      ...new Set(
        urls
          .filter((url): url is string => typeof url === "string")
          .map((url) => url.trim())
          .filter(Boolean),
      ),
    ].filter((url) =>
      isAllowedAppCloudinaryImageUrl(url, [MEME_CLOUDINARY_PREFIX]),
    );

    if (uniqueUrls.length === 0) return;

    const lookupUrls = expandCloudinaryUrlVariants(uniqueUrls);

    const referencedMemes = await prisma.meme.findMany({
      where: {
        imageUrl: { in: lookupUrls },
      },
      select: { imageUrl: true },
      take: 100,
    });

    const stillReferencedUrls = new Set<string>();
    const stillReferencedPublicIds = new Set<string>();
    for (const row of referencedMemes) {
      stillReferencedUrls.add(row.imageUrl);
      const pid = extractPublicIdFromUrl(row.imageUrl);
      if (pid) stillReferencedPublicIds.add(pid);
    }

    const unreferenced = uniqueUrls.filter((url) => {
      if (stillReferencedUrls.has(url)) return false;
      const pid = extractPublicIdFromUrl(url);
      return !pid || !stillReferencedPublicIds.has(pid);
    });

    if (unreferenced.length > 0) {
      await deleteMultipleImagesFromCloudinary(unreferenced);
    }
  } catch (err) {
    console.warn(`[Cloudinary] Failed to clean up ${logContext}:`, err);
  }
}
