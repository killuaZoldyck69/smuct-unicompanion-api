import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import {
  deleteMultipleImagesFromCloudinary,
  extractPublicIdFromUrl,
  isAllowedAppCloudinaryImageUrl,
} from "../../lib/cloudinary";
import { AppError } from "../../utils/AppError";
import { MARKETPLACE_CLOUDINARY_PREFIX } from "./marketplace.domain";

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
 * Prevents cross-user media IDOR: blocks attaching a Marketplace Cloudinary URL
 * (or delivery-variant URL sharing the same publicId) already referenced by another user.
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

  const foreignPost = await tx.marketplacePost.findFirst({
    where: {
      authorId: { notIn: ownerList },
      images: { hasSome: uniqueUrls },
    },
    select: { id: true },
  });

  if (foreignPost) {
    throw new AppError(
      "Forbidden: You cannot attach media belonging to another user.",
      403,
    );
  }

  const likePatterns = [
    ...new Set(
      uniqueUrls
        .map((url) => extractPublicIdFromUrl(url))
        .filter((id): id is string => Boolean(id)),
    ),
  ].map((publicId) => `%/${escapeLikePattern(publicId)}%`);

  if (likePatterns.length === 0) return;

  const postLikeClauses = likePatterns.map(
    (pattern) => Prisma.sql`array_to_string("images", ' ') LIKE ${pattern} ESCAPE '\\'`,
  );

  const rows = await tx.$queryRaw<Array<{ owned_by_other: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM "marketplace_post"
      WHERE "authorId" NOT IN (${Prisma.join(ownerList)})
        AND (${Prisma.join(postLikeClauses, " OR ")})
    ) AS owned_by_other
  `;

  if (rows[0]?.owned_by_other) {
    throw new AppError(
      "Forbidden: You cannot attach media belonging to another user.",
      403,
    );
  }
}

/**
 * Deletes Marketplace Cloudinary images only if they belong to the app's marketplace
 * folder and no remaining marketplace listing references the URL or its publicId.
 */
export async function deleteUnreferencedMarketplaceImages(
  urls: Array<string | null | undefined>,
  logContext: string,
): Promise<void> {
  const uniqueUrls = normalizeCandidateUrls(urls).filter((url) =>
    isAllowedAppCloudinaryImageUrl(url, [MARKETPLACE_CLOUDINARY_PREFIX]),
  );
  if (uniqueUrls.length === 0) return;

  const postsWithUrls = await prisma.marketplacePost.findMany({
    where: { images: { hasSome: uniqueUrls } },
    select: { images: true },
    take: 100,
  });

  const stillReferenced = new Set<string>();
  for (const post of postsWithUrls) {
    for (const img of post.images) {
      stillReferenced.add(img);
    }
  }

  const candidateUrls = uniqueUrls.filter((url) => !stillReferenced.has(url));
  if (candidateUrls.length === 0) return;

  const patternChecks = candidateUrls
    .map((url) => {
      const publicId = extractPublicIdFromUrl(url);
      return publicId
        ? { url, likePattern: `%/${escapeLikePattern(publicId)}%` }
        : null;
    })
    .filter((entry): entry is { url: string; likePattern: string } =>
      Boolean(entry),
    );

  const unreferenced: string[] = [];
  if (patternChecks.length > 0) {
    const patterns = patternChecks.map((entry) => entry.likePattern);
    const matchedRows = await prisma.$queryRaw<Array<{ idx: number }>>`
      SELECT p.ord::int - 1 AS idx
      FROM UNNEST(${patterns}::text[]) WITH ORDINALITY AS p(pattern, ord)
      WHERE EXISTS (
        SELECT 1 FROM "marketplace_post"
        WHERE array_to_string("images", ' ') LIKE p.pattern ESCAPE '\\'
      )
    `;

    const referencedIndices = new Set(matchedRows.map((row) => row.idx));
    patternChecks.forEach((entry, idx) => {
      if (!referencedIndices.has(idx)) {
        unreferenced.push(entry.url);
      }
    });
  }

  if (unreferenced.length > 0) {
    await deleteMultipleImagesFromCloudinary(unreferenced).catch((err) =>
      console.warn(`[Cloudinary] Failed to clean up ${logContext}:`, err),
    );
  }
}
