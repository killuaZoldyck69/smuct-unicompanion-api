import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import {
  deleteMultipleImagesFromCloudinary,
  extractPublicIdFromUrl,
} from "../../lib/cloudinary";
import { AppError } from "../../utils/AppError";

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

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

/**
 * Prevents cross-user media IDOR: blocks attaching a Lost & Found Cloudinary URL
 * (or delivery-variant URL sharing the same publicId) already referenced by another user.
 */
export async function assertNoForeignLostFoundMediaReferencesInTx(
  tx: Prisma.TransactionClient,
  allowedOwnerIds: readonly string[],
  urls: Array<string | null | undefined>,
): Promise<void> {
  const uniqueUrls = normalizeCandidateUrls(urls);
  if (uniqueUrls.length === 0) return;

  const ownerList = [...new Set(allowedOwnerIds.filter(Boolean))];
  if (ownerList.length === 0) return;

  const [foreignPost, foreignClaim] = await Promise.all([
    tx.lostFoundPost.findFirst({
      where: {
        authorId: { notIn: ownerList },
        images: { hasSome: uniqueUrls },
      },
      select: { id: true },
    }),
    tx.lostFoundClaim.findFirst({
      where: {
        claimantId: { notIn: ownerList },
        proofImage: { in: uniqueUrls },
      },
      select: { id: true },
    }),
  ]);

  if (foreignPost || foreignClaim) {
    throw new AppError(
      "Forbidden: You cannot attach media belonging to another user.",
      403,
    );
  }

  // Guard against transformation-tweaked Cloudinary delivery URLs sharing a foreign asset's publicId.
  const publicIds = [
    ...new Set(
      uniqueUrls
        .map((url) => extractPublicIdFromUrl(url))
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  for (const publicId of publicIds) {
    const likePattern = `%/${escapeLikePattern(publicId)}%`;
    const rows = await tx.$queryRaw<Array<{ owned_by_other: boolean }>>`
      SELECT (
        EXISTS (
          SELECT 1 FROM "lost_found_post"
          WHERE "authorId" NOT IN (${Prisma.join(ownerList)})
            AND array_to_string("images", ' ') LIKE ${likePattern} ESCAPE '\\'
        )
        OR EXISTS (
          SELECT 1 FROM "lost_found_claim"
          WHERE "claimantId" NOT IN (${Prisma.join(ownerList)})
            AND "proofImage" LIKE ${likePattern} ESCAPE '\\'
        )
      ) AS owned_by_other
    `;

    if (rows[0]?.owned_by_other) {
      throw new AppError(
        "Forbidden: You cannot attach media belonging to another user.",
        403,
      );
    }
  }
}

/**
 * Deletes Lost & Found Cloudinary images only if no remaining post or claim
 * references the URL (or its Cloudinary publicId) in PostgreSQL.
 */
export async function deleteUnreferencedLostFoundImages(
  urls: Array<string | null | undefined>,
  logContext: string,
): Promise<void> {
  const uniqueUrls = normalizeCandidateUrls(urls);
  if (uniqueUrls.length === 0) return;

  const [postsWithUrls, claimsWithUrls] = await Promise.all([
    prisma.lostFoundPost.findMany({
      where: { images: { hasSome: uniqueUrls } },
      select: { images: true },
      take: 100,
    }),
    prisma.lostFoundClaim.findMany({
      where: { proofImage: { in: uniqueUrls } },
      select: { proofImage: true },
      take: 100,
    }),
  ]);

  const stillReferenced = new Set<string>();
  for (const post of postsWithUrls) {
    for (const img of post.images) {
      stillReferenced.add(img);
    }
  }
  for (const claim of claimsWithUrls) {
    if (claim.proofImage) {
      stillReferenced.add(claim.proofImage);
    }
  }

  const candidateUrls = uniqueUrls.filter((url) => !stillReferenced.has(url));
  if (candidateUrls.length === 0) return;

  const unreferenced: string[] = [];
  for (const url of candidateUrls) {
    const publicId = extractPublicIdFromUrl(url);
    if (!publicId) continue;

    const likePattern = `%/${escapeLikePattern(publicId)}%`;
    const refRows = await prisma.$queryRaw<Array<{ is_referenced: boolean }>>`
      SELECT (
        EXISTS (
          SELECT 1 FROM "lost_found_post"
          WHERE array_to_string("images", ' ') LIKE ${likePattern} ESCAPE '\\'
        )
        OR EXISTS (
          SELECT 1 FROM "lost_found_claim"
          WHERE "proofImage" LIKE ${likePattern} ESCAPE '\\'
        )
      ) AS is_referenced
    `;

    if (!refRows[0]?.is_referenced) {
      unreferenced.push(url);
    }
  }

  if (unreferenced.length > 0) {
    await deleteMultipleImagesFromCloudinary(unreferenced).catch((err) =>
      console.warn(`[Cloudinary] Failed to clean up ${logContext}:`, err),
    );
  }
}
