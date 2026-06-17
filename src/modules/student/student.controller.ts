import { Request, Response } from "express";
import { prisma } from "../../lib/prisma";

export const onboardStudent = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user.id; // Extracted securely from the middleware
    const { studentId, department, batch, currentSemester, section } = req.body;

    // 1. Validate required fields
    if (!studentId || !department || !batch || !currentSemester) {
      res.status(400).json({ error: "Missing required academic information." });
      return;
    }

    // 2. Check if the user already has a profile to prevent duplicates
    const existingProfile = await prisma.studentProfile.findUnique({
      where: { userId },
    });

    if (existingProfile) {
      res
        .status(409)
        .json({ error: "A student profile already exists for this user." });
      return;
    }

    // 3. Execute a Prisma Transaction
    // We update the Better Auth user role AND create the profile simultaneously
    const result = await prisma.$transaction(async (tx) => {
      // Update core user role
      await tx.user.update({
        where: { id: userId },
        data: { role: "STUDENT" },
      });

      // Create the delegated profile
      const newProfile = await tx.studentProfile.create({
        data: {
          userId,
          studentId,
          department,
          batch,
          currentSemester: Number(currentSemester),
          section: section || null,
          isCR: false, // Default flags assigned by Admin later if needed
          isTA: false,
        },
      });

      return newProfile;
    });

    res.status(201).json({
      message: "Student profile created successfully.",
      profile: result,
    });
  } catch (error: any) {
    // Handle unique constraint violations (e.g., studentId already in use)
    if (error.code === "P2002" && error.meta?.target?.includes("studentId")) {
      res.status(409).json({
        error: "This Student ID is already registered in the system.",
      });
      return;
    }

    console.error("Student Onboarding Error:", error);
    res
      .status(500)
      .json({ error: "An error occurred while creating the student profile." });
  }
};

export const updateProfileImage = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user.id;
    const { imageUrl } = req.body;

    if (!imageUrl) {
      res.status(400).json({ error: "Image URL string is required." });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { image: imageUrl },
      select: {
        id: true,
        name: true,
        image: true,
      },
    });

    res.status(200).json({
      message: "Profile image updated successfully.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error saving profile image URL:", error);
    res
      .status(500)
      .json({ error: "Failed to sync profile image to database." });
  }
};
