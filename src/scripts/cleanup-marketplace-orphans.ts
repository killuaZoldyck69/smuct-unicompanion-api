import { cleanupMarketplaceOrphanImages } from "../services/orphan-cleanup.service";
import { prisma } from "../lib/prisma";

async function run() {
  const isDryRun = process.argv.includes("--dry-run");
  const hoursArg = process.argv.find((arg) => arg.startsWith("--hours="));
  const olderThanHours = hoursArg ? parseInt(hoursArg.split("=")[1], 10) : 24;

  console.log("=================================================");
  console.log(" 🧹 SMUCT UniCompanion: Marketplace Orphan Cleanup");
  console.log(` Mode: ${isDryRun ? "DRY RUN (No deletions)" : "LIVE DELETION"}`);
  console.log(` Safety Threshold: Assets older than ${olderThanHours} hours`);
  console.log("=================================================");

  try {
    const report = await cleanupMarketplaceOrphanImages(olderThanHours, isDryRun);

    console.log(`\nScan Summary:`);
    console.log(` - Cloudinary Images Scanned: ${report.scannedCount}`);
    console.log(` - Orphan Images Identified:  ${report.orphanCount}`);
    console.log(` - Images Deleted:            ${report.deletedCount}`);
    console.log(
      ` - Storage Freed:             ${(report.freedBytes / (1024 * 1024)).toFixed(2)} MB`
    );
    console.log(` - Cutoff Timestamp:          ${report.cutoffTime}\n`);

    if (isDryRun && report.orphanCount > 0) {
      console.log("ℹ️ To delete these orphaned images, run without the --dry-run flag.");
    }
  } catch (error) {
    console.error("❌ Cleanup failed with error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();

