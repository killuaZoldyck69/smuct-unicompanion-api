import app from "./app";
import { prisma } from "./lib/prisma";
import { envConfig } from "./config/env";
import { Server } from "http";

let server: Server;

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log("✅ PostgreSQL Database connected successfully via Prisma.");

    server = app.listen(envConfig.PORT, () => {
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

const handleShutdown = async (signal: string) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  if (server) {
    server.close(async () => {
      console.log("🔌 HTTP server closed.");
      await prisma.$disconnect();
      console.log("🗄️ Database disconnected cleanly.");
      process.exit(0);
    });
  } else {
    await prisma.$disconnect();
    process.exit(0);
  }
};

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));

startServer();

// Hub teachers query updated
