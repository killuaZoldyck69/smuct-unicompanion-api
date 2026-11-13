import { cleanupLostFoundOrphanImages } from "../services/orphan-cleanup.service";
import { prisma } from "../lib/prisma";

async function run() {
  const isDryRun = process.argv.includes("--dry-run");
  const hoursArg = process.argv.find((arg) => arg.startsWith("--hours="));
  const olderThanHours = hoursArg ? parseInt(hoursArg.split("=")[1], 10) : 24;

  console.log(`Lost & Found Orphan Cleanup (${isDryRun ? "DRY RUN" : "LIVE"}, threshold=${olderThanHours}h)`);

  try {
    const report = await cleanupLostFoundOrphanImages(olderThanHours, isDryRun);

    console.log(
      `Summary: scanned=${report.scannedCount}, orphans=${report.orphanCount}, deleted=${report.deletedCount}, freedMB=${(report.freedBytes / (1024 * 1024)).toFixed(2)}, cutoff=${report.cutoffTime}`,
    );

    if (isDryRun && report.orphanCount > 0) {
      console.log("Re-run without --dry-run to delete orphaned images.");
    }
  } catch (error) {
    console.error("Cleanup failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();

