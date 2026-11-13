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

interface CloudinaryResourceItem {
  public_id: string;
  secure_url: string;
  created_at: string;
  bytes?: number;
}

interface CloudinaryResourcesPage {
  resources?: CloudinaryResourceItem[];
  next_cursor?: string;
}

const CLOUDINARY_BATCH_SIZE = 100;
const DB_BATCH_SIZE = 500;

function addReferencedUrl(identifiers: Set<string>, url: string | null): void {
  const trimmed = url?.trim();
  if (!trimmed) return;

  identifiers.add(trimmed);
  const publicId = extractPublicIdFromUrl(trimmed);
  if (publicId) {
    identifiers.add(publicId);
  }
}

async function cleanupOrphanImages(params: {
  prefix: string;
  logTag: string;
  olderThanHours: number;
  dryRun: boolean;
  collectReferencedIdentifiers: () => Promise<Set<string>>;
}): Promise<OrphanCleanupReport> {
  const {
    prefix,
    logTag,
    olderThanHours,
    dryRun,
    collectReferencedIdentifiers,
  } = params;
  // Cutoff protects in-flight client uploads that have not yet been persisted to PostgreSQL.
  const cutoffDate = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
  const referenced = await collectReferencedIdentifiers();

  let scannedCount = 0;
  let freedBytes = 0;
  const orphanPublicIds: string[] = [];
  let nextCursor: string | undefined;

  do {
    const response = (await cloudinary.api.resources({
      type: "upload",
      prefix,
      max_results: CLOUDINARY_BATCH_SIZE,
      ...(nextCursor ? { next_cursor: nextCursor } : {}),
    })) as CloudinaryResourcesPage;

    const resources = response.resources ?? [];
    scannedCount += resources.length;

    for (const resource of resources) {
      if (new Date(resource.created_at) >= cutoffDate) continue;
      if (
        referenced.has(resource.public_id) ||
        referenced.has(resource.secure_url)
      )
        continue;

      orphanPublicIds.push(resource.public_id);
      freedBytes += resource.bytes ?? 0;
    }

    nextCursor = response.next_cursor;
  } while (nextCursor);

  let deletedCount = 0;
  if (!dryRun) {
    for (let i = 0; i < orphanPublicIds.length; i += CLOUDINARY_BATCH_SIZE) {
      const batch = orphanPublicIds.slice(i, i + CLOUDINARY_BATCH_SIZE);
      try {
        const res = (await cloudinary.api.delete_resources(batch)) as {
          deleted?: Record<string, string>;
        };
        const deleted = res.deleted ?? {};
        for (const publicId of batch) {
          if (
            deleted[publicId] === "deleted" ||
            deleted[publicId] === "not_found"
          ) {
            deletedCount++;
          }
        }
      } catch (err) {
        console.warn(
          `[${logTag}] Error deleting batch of ${batch.length} files:`,
          err,
        );
      }
    }
  }

  return {
    scannedCount,
    orphanCount: orphanPublicIds.length,
    deletedCount,
    freedBytes,
    olderThanHours,
    cutoffTime: cutoffDate.toISOString(),
  };
}

export function cleanupMarketplaceOrphanImages(
  olderThanHours = 24,
  dryRun = false,
): Promise<OrphanCleanupReport> {
  return cleanupOrphanImages({
    prefix: "smuct-unicompanion/campus-hub/marketplace",
    logTag: "Cloudinary-Orphan-Cleanup",
    olderThanHours,
    dryRun,
    collectReferencedIdentifiers: async () => {
      const identifiers = new Set<string>();
      const posts = await prisma.marketplacePost.findMany({
        select: { images: true },
      });
      for (const post of posts) {
        for (const url of post.images) addReferencedUrl(identifiers, url);
      }
      return identifiers;
    },
  });
}

export function cleanupLostFoundOrphanImages(
  olderThanHours = 24,
  dryRun = false,
): Promise<OrphanCleanupReport> {
  return cleanupOrphanImages({
    prefix: "smuct-unicompanion/campus-hub/lost-found",
    logTag: "Cloudinary-LostFound-Cleanup",
    olderThanHours,
    dryRun,
    collectReferencedIdentifiers: async () => {
      const identifiers = new Set<string>();

      let postCursor: string | undefined;
      while (true) {
        const posts = await prisma.lostFoundPost.findMany({
          ...(postCursor ? { cursor: { id: postCursor }, skip: 1 } : {}),
          take: DB_BATCH_SIZE,
          orderBy: { id: "asc" },
          select: { id: true, images: true },
        });
        for (const post of posts) {
          for (const url of post.images) addReferencedUrl(identifiers, url);
        }
        if (posts.length < DB_BATCH_SIZE) break;
        postCursor = posts[posts.length - 1].id;
      }

      let claimCursor: string | undefined;
      while (true) {
        const claims = await prisma.lostFoundClaim.findMany({
          where: { proofImage: { not: null } },
          ...(claimCursor ? { cursor: { id: claimCursor }, skip: 1 } : {}),
          take: DB_BATCH_SIZE,
          orderBy: { id: "asc" },
          select: { id: true, proofImage: true },
        });
        for (const claim of claims)
          addReferencedUrl(identifiers, claim.proofImage);
        if (claims.length < DB_BATCH_SIZE) break;
        claimCursor = claims[claims.length - 1].id;
      }

      return identifiers;
    },
  });
}
