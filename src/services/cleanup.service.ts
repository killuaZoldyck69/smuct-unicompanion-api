import { prisma } from "../lib/prisma";
import { deleteImageFromCloudinary } from "../lib/cloudinary";
import {
  cleanupMarketplaceOrphanImages,
  cleanupLostFoundOrphanImages,
} from "./orphan-cleanup.service";

export interface CleanupResult {
  unverifiedUsersDeleted: number;
  expiredVerificationsDeleted: number;
  expiredSessionsDeleted: number;
  cutoffTime: string;
}

/**
 * Purges unverified accounts, expired OTP tokens, and stale sessions.
 * @param olderThanHours Threshold in hours after which unverified users are considered abandoned (default: 24h)
 */
export async function cleanupStaleData(olderThanHours: number = 24): Promise<CleanupResult> {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

  // 1. Locate abandoned unverified users
  const abandonedUsers = await prisma.user.findMany({
    where: {
      emailVerified: false,
      createdAt: { lt: cutoff },
      studentProfile: null,
      teacherProfile: null,
      role: { not: "ADMIN" }, // Hard safety guard: Never delete an administrator
    },
    select: {
      id: true,
      email: true,
      image: true,
    },
  });

  let unverifiedUsersDeleted = 0;

  if (abandonedUsers.length > 0) {
    const userIds = abandonedUsers.map((u) => u.id);

    // Clean up any uploaded profile images from Cloudinary
    for (const u of abandonedUsers) {
      if (u.image) {
        deleteImageFromCloudinary(u.image).catch(() => {});
      }
    }

    // Cascade delete users (Prisma cascade onDelete removes session & account rows)
    const deleteOp = await prisma.user.deleteMany({
      where: { id: { in: userIds } },
    });
    unverifiedUsersDeleted = deleteOp.count;

    console.log(
      `[Security-Cleanup] Successfully purged ${unverifiedUsersDeleted} abandoned unverified users older than ${olderThanHours} hours.`,
    );
  }

  // 2. Clean up expired OTP verification records (expired after 3 mins)
  const expiredVerifications = await prisma.verification.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });

  // 3. Clean up expired session records
  const expiredSessions = await prisma.session.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });

  return {
    unverifiedUsersDeleted,
    expiredVerificationsDeleted: expiredVerifications.count,
    expiredSessionsDeleted: expiredSessions.count,
    cutoffTime: cutoff.toISOString(),
  };
}

/**
 * Initializes the automated periodic cleanup scheduler.
 * Runs on startup (after a brief stabilization delay) and then every hour.
 */
export function startCleanupScheduler(intervalMs: number = 60 * 60 * 1000): void {
  // Initial run 5 seconds after server boot
  const initialTimer = setTimeout(() => {
    cleanupStaleData().catch((err) => {
      console.warn("[Security-Cleanup] Initial cleanup encountered an issue:", err);
    });
  }, 5000);

  if (initialTimer.unref) {
    initialTimer.unref();
  }

  // Recurring background interval
  const recurringTimer = setInterval(() => {
    cleanupStaleData().catch((err) => {
      console.warn("[Security-Cleanup] Scheduled cleanup encountered an issue:", err);
    });
  }, intervalMs);

  if (recurringTimer.unref) {
    recurringTimer.unref();
  }

  // Daily Cloudinary orphan cleanup for Campus Hub (scans assets older than 24h)
  const orphanIntervalMs = 24 * 60 * 60 * 1000;
  const runCampusHubOrphanCleanups = async () => {
    try {
      const marketReport = await cleanupMarketplaceOrphanImages(24);
      console.log(
        `🧹 [Marketplace-Cleanup] Scanned ${marketReport.scannedCount} images, purged ${marketReport.deletedCount} orphans (${(marketReport.freedBytes / (1024 * 1024)).toFixed(2)} MB freed).`
      );
    } catch (err) {
      console.warn("[Marketplace-Cleanup] Cleanup encountered an issue:", err);
    }

    try {
      const lostFoundReport = await cleanupLostFoundOrphanImages(24);
      console.log(
        `🧹 [LostFound-Cleanup] Scanned ${lostFoundReport.scannedCount} images, purged ${lostFoundReport.deletedCount} orphans (${(lostFoundReport.freedBytes / (1024 * 1024)).toFixed(2)} MB freed).`
      );
    } catch (err) {
      console.warn("[LostFound-Cleanup] Cleanup encountered an issue:", err);
    }
  };

  const initialOrphanTimer = setTimeout(() => {
    runCampusHubOrphanCleanups();
  }, 20000);

  if (initialOrphanTimer.unref) {
    initialOrphanTimer.unref();
  }

  const recurringOrphanTimer = setInterval(() => {
    runCampusHubOrphanCleanups();
  }, orphanIntervalMs);

  if (recurringOrphanTimer.unref) {
    recurringOrphanTimer.unref();
  }

  console.log("🛡️ Stale unverified account cleanup scheduler initialized (Interval: 1 hour).");
  console.log("🧹 Campus Hub Cloudinary orphan cleanup scheduler initialized (Interval: 24 hours).");
}
