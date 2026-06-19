import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { UpdateRolePayload } from "./user.schema";

export const getAllUsersService = async () => {
  return await prisma.user.findMany({
    include: {
      studentProfile: true,
      teacherProfile: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

export const deleteUserService = async (id: string) => {
  const existingUser = await prisma.user.findUnique({
    where: { id },
  });

  if (!existingUser) {
    throw new AppError("User not found.", 404);
  }

  // Cascades automatically to StudentProfile, TeacherProfile, Session, Account, etc.
  return await prisma.user.delete({
    where: { id },
  });
};

export const updateStudentRoleService = async (
  id: string,
  action: UpdateRolePayload["action"],
) => {
  // Verify user exists and retrieve their student profile
  const user = await prisma.user.findUnique({
    where: { id },
    include: { studentProfile: true },
  });

  if (!user) {
    throw new AppError("User not found.", 404);
  }

  if (!user.studentProfile) {
    throw new AppError(
      "This action can only be performed on student accounts.",
      400,
    );
  }

  // Determine the boolean flags based on the requested action
  let updateData = {};
  if (action === "MAKE_CR") {
    updateData = { isCR: true };
  } else if (action === "MAKE_TA") {
    updateData = { isTA: true };
  } else if (action === "REMOVE_ROLE") {
    updateData = { isCR: false, isTA: false };
  }

  // Apply the update to the delegated StudentProfile
  return await prisma.studentProfile.update({
    where: { userId: id },
    data: updateData,
  });
};
