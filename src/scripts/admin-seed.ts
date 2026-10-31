import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";

async function seedFirstAdmin() {
  console.log("🌱 Starting SMUCT UniCompanion Admin Seeding Process...");

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const adminName = process.env.SEED_ADMIN_NAME || "System Administrator";

  if (!adminEmail || !adminPassword) {
    throw new Error(
      "Missing required environment variables: SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be provided.",
    );
  }

  if (adminPassword.length < 8) {
    throw new Error("SEED_ADMIN_PASSWORD must be at least 8 characters long.");
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (existingUser) {
      console.log(`⚠️ User with email ${adminEmail} already exists! Skipping.`);
      return;
    }

    const newAdmin = await auth.api.signUpEmail({
      body: {
        email: adminEmail,
        password: adminPassword,
        name: adminName,
      },
    });

    await prisma.user.update({
      where: { id: newAdmin.user.id },
      data: { role: "ADMIN" },
    });

    console.log("✅ Successfully created the first Admin account!");
    console.log(`📧 Email: ${newAdmin.user.email}`);
    console.log(`🔑 Role: ADMIN`);
  } catch (error) {
    console.error("❌ Failed to seed admin:", error);
  } finally {
    await prisma.$disconnect();
  }
}

seedFirstAdmin();
