import { auth } from "../../lib/auth";
import { sendEmail } from "../../lib/email";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { RegisterTeacherPayload, UpdateTeacherPayload } from "./teacher.schema";

export const registerTeacherService = async (data: RegisterTeacherPayload) => {
  // 1. Pre-check: Ensure email is unique
  const existingEmail = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingEmail) {
    throw new AppError("A user with this email already exists.", 409);
  }

  // 2. Pre-check: Ensure Teacher ID is unique
  const existingTeacherId = await prisma.teacherProfile.findUnique({
    where: { teacherId: data.teacherId },
  });

  if (existingTeacherId) {
    throw new AppError(
      "This Teacher ID is already registered in the system.",
      409,
    );
  }

  let authResponse: any;

  try {
    // 3. Create core user account via Better Auth
    authResponse = await auth.api.signUpEmail({
      body: {
        email: data.email,
        password: data.password,
        name: data.name,
        role: "TEACHER",
      },
    });
  } catch (error: any) {
    throw new AppError(
      error.message || "Failed to create core user account",
      500,
    );
  }

  if (!authResponse?.user) {
    throw new AppError("Unexpected error during teacher registration.", 500);
  }

  const userId = authResponse.user.id;

  try {
    // 4. Revoke the automatic session
    await prisma.session.deleteMany({
      where: { userId },
    });

    // 5. Create the delegated Teacher Profile with the new fields
    const profile = await prisma.teacherProfile.create({
      data: {
        userId: userId,
        teacherId: data.teacherId,
        designation: data.designation,
        department: data.department,
        faculty: data.faculty,
      },
    });

    // 👇 NEW: Auto-verify the Teacher so they don't have to click a verification link
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });

    // 👇 NEW: Send the Teacher their login credentials
    await sendEmail({
      to: data.email,
      subject: "Your Teacher Account - SMUCT UniCompanion",
      html: `
        <h2>Welcome to SMUCT UniCompanion, ${data.name}!</h2>
        <p>An administrator has created a teacher account for you.</p>
        <p><strong>Login Email:</strong> ${data.email}</p>
        <p><strong>Temporary Password:</strong> ${data.password}</p>
        <p>Please log into the mobile app and change your password immediately.</p>
      `,
    });

    return { user: authResponse.user, profile };
  } catch (error) {
    // 6. Manual Rollback
    await prisma.user.delete({ where: { id: userId } });
    console.error("Teacher Profile creation failed, rolled back user:", error);

    throw new AppError(
      "Failed to create teacher profile. Database rolled back.",
      500,
    );
  }
};

export const getTeacherProfileByUserId = async (userId: string) => {
  return await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      phoneNumber: true,
      bloodGroup: true,
      role: true,
      teacherProfile: {
        select: {
          teacherId: true, // 👈 Added
          designation: true,
          department: true,
          faculty: true, // 👈 Added
          officeRoom: true,
          consultationHours: true,
          expertiseFields: true, // 👈 Added (String array)
          academicQualifications: true, // 👈 Added (JSON object)
          linkedInUrl: true, // 👈 Added
          personalWebsiteUrl: true, // 👈 Added
        },
      },
    },
  });
};

export const updateTeacherProfileImageService = async (
  userId: string,
  imageUrl: string,
) => {
  return await prisma.user.update({
    where: { id: userId },
    data: { image: imageUrl },
    select: { id: true, name: true, image: true },
  });
};

export const updateTeacherProfileData = async (
  userId: string,
  data: UpdateTeacherPayload,
) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Update Core User Data
    const userUpdateData: any = {};
    if (data.name) userUpdateData.name = data.name;
    if (data.phoneNumber !== undefined)
      userUpdateData.phoneNumber = data.phoneNumber;
    if (data.bloodGroup !== undefined)
      userUpdateData.bloodGroup = data.bloodGroup;

    if (Object.keys(userUpdateData).length > 0) {
      await tx.user.update({
        where: { id: userId },
        data: userUpdateData,
      });
    }

    // 2. Update Delegated Teacher Profile Data
    const profileUpdateData: any = {};
    if (data.designation) profileUpdateData.designation = data.designation;
    if (data.department) profileUpdateData.department = data.department;
    if (data.faculty !== undefined) profileUpdateData.faculty = data.faculty; // 👈 Added
    if (data.officeRoom !== undefined)
      profileUpdateData.officeRoom = data.officeRoom;
    if (data.consultationHours !== undefined)
      profileUpdateData.consultationHours = data.consultationHours;

    // 👈 Added New Fields Mapping
    if (data.expertiseFields !== undefined)
      profileUpdateData.expertiseFields = data.expertiseFields;
    if (data.academicQualifications !== undefined)
      profileUpdateData.academicQualifications = data.academicQualifications;
    if (data.linkedInUrl !== undefined)
      profileUpdateData.linkedInUrl = data.linkedInUrl;
    if (data.personalWebsiteUrl !== undefined)
      profileUpdateData.personalWebsiteUrl = data.personalWebsiteUrl;

    if (Object.keys(profileUpdateData).length > 0) {
      await tx.teacherProfile.update({
        where: { userId: userId },
        data: profileUpdateData,
      });
    }

    // Return the cleanly merged updated data
    return await getTeacherProfileByUserId(userId);
  });
};
