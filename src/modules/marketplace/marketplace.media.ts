import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import {
  buildOptimizedUrl,
  deleteMultipleImagesFromCloudinary,
  extractPublicIdFromUrl,
  isAllowedAppCloudinaryImageUrl,
} from "../../lib/cloudinary";
import { AppError } from "../../utils/AppError";
import { MARKETPLACE_CLOUDINARY_PREFIX } from "./marketplace.domain";

function normalizeCandidateUrls(urls: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      urls
        .filter((url): url is string => typeof url === "string")
        .map((url) => url.trim())
        .filter(Boolean),
    ),
  ];
}

function expandWithCanonicalVariants(urls: readonly string[]): string[] {
  const expanded = new Set<string>(urls);
  for (const url of urls) {
    const publicId = extractPublicIdFromUrl(url);
    if (!publicId) continue;
    try {
      const cloudFromUrl = new URL(url).pathname.split("/").filter(Boolean)[0];
      expanded.add(buildOptimizedUrl(publicId, cloudFromUrl));
    } catch {
      expanded.add(buildOptimizedUrl(publicId));
    }
  }
  return [...expanded];
}

/**
 * Prevents cross-user media IDOR: blocks attaching a Marketplace Cloudinary URL
 * (or delivery-variant URL sharing the same publicId) already referenced by another user
 * using the GIN index on marketplace_post.images.
 */
export async function assertNoForeignMarketplaceMediaReferencesInTx(
  tx: Prisma.TransactionClient,
  allowedOwnerIds: readonly string[],
  urls: Array<string | null | undefined>,
): Promise<void> {
  const uniqueUrls = normalizeCandidateUrls(urls);
  if (uniqueUrls.length === 0) return;

  const ownerList = [...new Set(allowedOwnerIds.filter(Boolean))];
  if (ownerList.length === 0) return;

  const candidateUrls = expandWithCanonicalVariants(uniqueUrls);
  const foreignPost = await tx.marketplacePost.findFirst({
    where: {
      authorId: { notIn: ownerList },
      images: { hasSome: candidateUrls },
    },
    select: { id: true },
  });

  if (foreignPost) {
    throw new AppError(
      "Forbidden: You cannot attach media belonging to another user.",
      403,
    );
  }
}

/**
 * Deletes Marketplace Cloudinary images only if they belong to the app's marketplace
 * folder and no remaining marketplace listing references the URL or its canonical variant.
 */
export async function deleteUnreferencedMarketplaceImages(
  urls: Array<string | null | undefined>,
  logContext: string,
): Promise<void> {
  try {
    const uniqueUrls = normalizeCandidateUrls(urls).filter((url) =>
      isAllowedAppCloudinaryImageUrl(url, [MARKETPLACE_CLOUDINARY_PREFIX]),
    );
    if (uniqueUrls.length === 0) return;

    const lookupUrls = expandWithCanonicalVariants(uniqueUrls);
    const postsWithUrls = await prisma.marketplacePost.findMany({
      where: { images: { hasSome: lookupUrls } },
      select: { images: true },
      take: 100,
    });

    const stillReferencedUrls = new Set<string>();
    const stillReferencedPublicIds = new Set<string>();
    for (const post of postsWithUrls) {
      for (const img of post.images) {
        stillReferencedUrls.add(img);
        const publicId = extractPublicIdFromUrl(img);
        if (publicId) stillReferencedPublicIds.add(publicId);
      }
    }

    const unreferenced = uniqueUrls.filter((url) => {
      if (stillReferencedUrls.has(url)) return false;
      const publicId = extractPublicIdFromUrl(url);
      return !publicId || !stillReferencedPublicIds.has(publicId);
    });

    if (unreferenced.length > 0) {
      await deleteMultipleImagesFromCloudinary(unreferenced);
    }
  } catch (err) {
    console.warn(`[Cloudinary] Failed to clean up ${logContext}:`, err);
  }
}
