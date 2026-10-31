import { prisma } from "../lib/prisma";
import cloudinary, { extractPublicIdFromUrl } from "../lib/cloudinary";

export interface OrphanCleanupReport {
  scannedCount: number;
  orphanCount: number;
  deletedCount: number;
  freedBytes: number;
  olderThanHours: number;
  cutoffTime: string;
}

/**
 * Scans Cloudinary for marketplace images that are not referenced in the database
 * and are older than a safety threshold (default: 24 hours), then deletes them in batches.
 *
 * @param olderThanHours Safety threshold in hours to prevent deleting files currently being uploaded (default: 24)
 * @param dryRun If true, scans and identifies orphans without executing deletion
 */
export async function cleanupMarketplaceOrphanImages(
  olderThanHours: number = 24,
  dryRun: boolean = false
): Promise<OrphanCleanupReport> {
  const cutoffDate = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
  const prefix = "smuct-unicompanion/campus-hub/marketplace";

  // 1. Fetch all marketplace post image URLs from database
  const posts = await prisma.marketplacePost.findMany({
    select: { images: true },
  });

  const referencedIdentifiers = new Set<string>();
  for (const post of posts) {
    if (Array.isArray(post.images)) {
      for (const imgUrl of post.images) {
        if (typeof imgUrl === "string" && imgUrl.trim()) {
          referencedIdentifiers.add(imgUrl.trim());
          const publicId = extractPublicIdFromUrl(imgUrl);
          if (publicId) {
            referencedIdentifiers.add(publicId);
          }
        }
      }
    }
  }

  let scannedCount = 0;
  let freedBytes = 0;
  const orphanPublicIds: string[] = [];
  let nextCursor: string | undefined = undefined;

  // 2. Page through Cloudinary resources under the marketplace folder
  do {
    const options: any = {
      type: "upload",
      prefix,
      max_results: 100,
    };
    if (nextCursor) {
      options.next_cursor = nextCursor;
    }

    const response = await cloudinary.api.resources(options);
    const resources = response?.resources || [];
    scannedCount += resources.length;

    for (const res of resources) {
      const createdAt = new Date(res.created_at);
      // Safety threshold: Only consider files created BEFORE the cutoff
      // so in-flight uploads are never touched
      if (createdAt < cutoffDate) {
        const isReferenced =
          referencedIdentifiers.has(res.public_id) ||
          referencedIdentifiers.has(res.secure_url);

        if (!isReferenced) {
          orphanPublicIds.push(res.public_id);
          freedBytes += typeof res.bytes === "number" ? res.bytes : 0;
        }
      }
    }

    nextCursor = response?.next_cursor;
  } while (nextCursor);

  let deletedCount = 0;

  // 3. Batch delete up to 100 at a time via Cloudinary Admin API
  if (orphanPublicIds.length > 0 && !dryRun) {
    const BATCH_SIZE = 100;
    for (let i = 0; i < orphanPublicIds.length; i += BATCH_SIZE) {
      const batch = orphanPublicIds.slice(i, i + BATCH_SIZE);
      try {
        const deleteRes = await cloudinary.api.delete_resources(batch);
        const deletedMap = deleteRes?.deleted || {};
        for (const id of batch) {
          if (deletedMap[id] === "deleted" || deletedMap[id] === "not_found") {
            deletedCount++;
          }
        }
      } catch (err) {
        console.warn(
          `[Cloudinary-Orphan-Cleanup] Error deleting batch of ${batch.length} files:`,
          err
        );
      }
    }
  }

  const report: OrphanCleanupReport = {
    scannedCount,
    orphanCount: orphanPublicIds.length,
    deletedCount: dryRun ? 0 : deletedCount,
    freedBytes,
    olderThanHours,
    cutoffTime: cutoffDate.toISOString(),
  };

  return report;
}

/**
 * Scans Cloudinary for Lost & Found post and claim proof images that are not referenced
 * in the database and are older than a safety threshold (default: 24 hours), then deletes them in batches.
 *
 * @param olderThanHours Safety threshold in hours to prevent deleting files currently being uploaded (default: 24)
 * @param dryRun If true, scans and identifies orphans without executing deletion
 */
export async function cleanupLostFoundOrphanImages(
  olderThanHours: number = 24,
  dryRun: boolean = false
): Promise<OrphanCleanupReport> {
  const cutoffDate = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
  const prefix = "smuct-unicompanion/campus-hub/lost-found";

  // 1. Fetch all lost & found post images and claim proof images from database
  const [posts, claims] = await Promise.all([
    prisma.lostFoundPost.findMany({
      select: { images: true },
    }),
    prisma.lostFoundClaim.findMany({
      where: { proofImage: { not: null } },
      select: { proofImage: true },
    }),
  ]);

  const referencedIdentifiers = new Set<string>();

  // Add post images
  for (const post of posts) {
    if (Array.isArray(post.images)) {
      for (const imgUrl of post.images) {
        if (typeof imgUrl === "string" && imgUrl.trim()) {
          referencedIdentifiers.add(imgUrl.trim());
          const publicId = extractPublicIdFromUrl(imgUrl);
          if (publicId) {
            referencedIdentifiers.add(publicId);
          }
        }
      }
    }
  }

  // Add claim proof images
  for (const claim of claims) {
    if (typeof claim.proofImage === "string" && claim.proofImage.trim()) {
      referencedIdentifiers.add(claim.proofImage.trim());
      const publicId = extractPublicIdFromUrl(claim.proofImage);
      if (publicId) {
        referencedIdentifiers.add(publicId);
      }
    }
  }

  let scannedCount = 0;
  let freedBytes = 0;
  const orphanPublicIds: string[] = [];
  let nextCursor: string | undefined = undefined;

  // 2. Page through Cloudinary resources under lost-found (including claims subfolder)
  do {
    const options: any = {
      type: "upload",
      prefix,
      max_results: 100,
    };
    if (nextCursor) {
      options.next_cursor = nextCursor;
    }

    const response = await cloudinary.api.resources(options);
    const resources = response?.resources || [];
    scannedCount += resources.length;

    for (const res of resources) {
      const createdAt = new Date(res.created_at);
      if (createdAt < cutoffDate) {
        const isReferenced =
          referencedIdentifiers.has(res.public_id) ||
          referencedIdentifiers.has(res.secure_url);

        if (!isReferenced) {
          orphanPublicIds.push(res.public_id);
          freedBytes += typeof res.bytes === "number" ? res.bytes : 0;
        }
      }
    }

    nextCursor = response?.next_cursor;
  } while (nextCursor);

  let deletedCount = 0;

  // 3. Batch delete up to 100 at a time via Cloudinary Admin API
  if (orphanPublicIds.length > 0 && !dryRun) {
    const BATCH_SIZE = 100;
    for (let i = 0; i < orphanPublicIds.length; i += BATCH_SIZE) {
      const batch = orphanPublicIds.slice(i, i + BATCH_SIZE);
      try {
        const deleteRes = await cloudinary.api.delete_resources(batch);
        const deletedMap = deleteRes?.deleted || {};
        for (const id of batch) {
          if (deletedMap[id] === "deleted" || deletedMap[id] === "not_found") {
            deletedCount++;
          }
        }
      } catch (err) {
        console.warn(
          `[Cloudinary-LostFound-Cleanup] Error deleting batch of ${batch.length} files:`,
          err
        );
      }
    }
  }

  const report: OrphanCleanupReport = {
    scannedCount,
    orphanCount: orphanPublicIds.length,
    deletedCount: dryRun ? 0 : deletedCount,
    freedBytes,
    olderThanHours,
    cutoffTime: cutoffDate.toISOString(),
  };

  return report;
}

