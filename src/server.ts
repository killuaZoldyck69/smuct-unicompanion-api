import app from "./app";
import { prisma } from "./lib/prisma";
import { envConfig } from "./config/env";

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log("✅ PostgreSQL Database connected successfully via Prisma.");

    app.listen(envConfig.PORT, () => {
      console.log(
        `🚀 SMUCT UniCompanion Backend running on http://localhost:${envConfig.PORT}`,
      );
      console.log(
        `🔒 BetterAuth endpoints available at http://localhost:${envConfig.PORT}/api/auth`,
      );
    });
  } catch (error) {
    console.error("❌ Failed to start the server:");
    console.error(error);

    await prisma.$disconnect();
    process.exit(1);
  }
};

startServer();
