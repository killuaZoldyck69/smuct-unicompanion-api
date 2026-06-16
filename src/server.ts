import app from "./app";
import { prisma } from "./lib/prisma";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log("✅ PostgreSQL Database connected successfully via Prisma.");

    app.listen(PORT, () => {
      console.log(
        `🚀 SMUCT Unicompanion Backend running on http://localhost:${PORT}`,
      );
      console.log(
        `🔒 BetterAuth endpoints available at http://localhost:${PORT}/api/auth`,
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
