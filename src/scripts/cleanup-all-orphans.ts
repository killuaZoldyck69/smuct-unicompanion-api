import {
  cleanupMarketplaceOrphanImages,
  cleanupLostFoundOrphanImages,
} from "../services/orphan-cleanup.service";
import { prisma } from "../lib/prisma";

async function run() {
  const isDryRun = process.argv.includes("--dry-run");
  const hoursArg = process.argv.find((arg) => arg.startsWith("--hours="));
  const olderThanHours = hoursArg ? parseInt(hoursArg.split("=")[1], 10) : 24;

  console.log("==========================================================");
  console.log(" 🧹 SMUCT UniCompanion: Campus Hub Cloudinary Orphan Cleanup");
  console.log(` Mode: ${isDryRun ? "DRY RUN (No deletions)" : "LIVE DELETION"}`);
  console.log(` Safety Threshold: Assets older than ${olderThanHours} hours`);
  console.log("==========================================================\n");

  try {
    console.log("--- 1. MARKETPLACE SCAN ---");
    const marketReport = await cleanupMarketplaceOrphanImages(olderThanHours, isDryRun);
    console.log(` - Scanned: ${marketReport.scannedCount}`);
    console.log(` - Orphans: ${marketReport.orphanCount}`);
    console.log(` - Deleted: ${marketReport.deletedCount}`);
    console.log(` - Freed:   ${(marketReport.freedBytes / (1024 * 1024)).toFixed(2)} MB\n`);

    console.log("--- 2. LOST & FOUND SCAN ---");
    const lostReport = await cleanupLostFoundOrphanImages(olderThanHours, isDryRun);
    console.log(` - Scanned: ${lostReport.scannedCount}`);
    console.log(` - Orphans: ${lostReport.orphanCount}`);
    console.log(` - Deleted: ${lostReport.deletedCount}`);
    console.log(` - Freed:   ${(lostReport.freedBytes / (1024 * 1024)).toFixed(2)} MB\n`);

    const totalScanned = marketReport.scannedCount + lostReport.scannedCount;
    const totalOrphans = marketReport.orphanCount + lostReport.orphanCount;
    const totalDeleted = marketReport.deletedCount + lostReport.deletedCount;
    const totalFreed = marketReport.freedBytes + lostReport.freedBytes;

    console.log("==========================================================");
    console.log(" 📊 TOTAL SUMMARY");
    console.log(` - Total Images Scanned: ${totalScanned}`);
    console.log(` - Total Orphans Found:  ${totalOrphans}`);
    console.log(` - Total Images Deleted: ${totalDeleted}`);
    console.log(` - Total Storage Freed:  ${(totalFreed / (1024 * 1024)).toFixed(2)} MB`);
    console.log("==========================================================");

    if (isDryRun && totalOrphans > 0) {
      console.log("\nℹ️ To purge these orphaned images, run without the --dry-run flag.");
    }
  } catch (error) {
    console.error("❌ Cleanup failed with error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();

