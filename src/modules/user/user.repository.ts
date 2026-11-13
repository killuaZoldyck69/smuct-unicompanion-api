import { prisma } from "../../lib/prisma";

export const findUsersWithProfiles = async (
  where: Record<string, any>,
  skip: number,
  take: number,
) => {
  return await prisma.user.findMany({
    where,
    skip,
    take,
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      role: true,
      phoneNumber: true,
      bloodGroup: true,
      isRestricted: true,
      createdAt: true,
      studentProfile: {
        select: {
          id: true,
          studentId: true,
          faculty: true,
          department: true,
          program: true,
          batch: true,
          currentSemester: true,
          section: true,
          currentTerm: true,
          isCR: true,
          skills: true,
          linkedInUrl: true,
          personalWebsiteUrl: true,
        },
      },
      teacherProfile: {
        select: {
          id: true,
          teacherId: true,
          designation: true,
          administrativeRole: true,
          department: true,
          faculty: true,
          officeRoom: true,
          advisoryBatch: true,
          dayOff: true,
          consultationSlots: true,
          expertiseFields: true,
          academicQualifications: true,
          linkedInUrl: true,
          personalWebsiteUrl: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

export const countUsers = async (where: Record<string, any>) => {
  return await prisma.user.count({ where });
};

export const findUserById = async (id: string) => {
  return await prisma.user.findUnique({
    where: { id },
  });
};

export const findUserWithStudentProfile = async (id: string) => {
  return await prisma.user.findUnique({
    where: { id },
    include: { studentProfile: true },
  });
};

export const findUserWithTeacherProfile = async (id: string) => {
  return await prisma.user.findUnique({
    where: { id },
    include: { teacherProfile: true },
  });
};

export const deleteUserById = async (id: string) => {
  return await prisma.user.delete({
    where: { id },
  });
};

export const updateStudentProfileByUserId = async (
  userId: string,
  data: Record<string, any>,
) => {
  return await prisma.studentProfile.update({
    where: { userId },
    data,
  });
};

export const updateTeacherProfileByUserId = async (
  userId: string,
  data: Record<string, any>,
) => {
  return await prisma.teacherProfile.update({
    where: { userId },
    data,
  });
};

export const updateUserImageById = async (id: string, image: string) => {
  return await prisma.user.update({
    where: { id },
    data: { image },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
    },
  });
};

export const updateGoogleDriveConnectionStatus = async (
  userId: string,
  isConnected: boolean,
  email?: string | null,
) => {
  const result = await prisma.user.updateMany({
    where: { id: userId },
    data: {
      googleDriveConnected: isConnected,
      googleDriveEmail: isConnected ? (email ?? null) : null,
    },
  });
  return result.count > 0;
};

export const setUserRestrictedById = async (id: string, isRestricted: boolean) => {
  return await prisma.user.update({
    where: { id },
    data: { isRestricted },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isRestricted: true,
    },
  });
};

export const revokeAllUserSessions = async (userId: string) => {
  return await prisma.session.deleteMany({
    where: { userId },
  });
};

export const executeSelfAccountDeletionTx = async (
  userId: string,
  buildGuards: (user: {
    email: string;
    role: string;
    isRestricted: boolean;
    image: string;
    studentId?: string | null;
  }) => Array<{
    identifierHash: string;
    identifierType: "EMAIL" | "STUDENT_ID";
    computeState: (existingCount: number) => {
      deletionCount: number;
      lastDeletedAt: Date;
      blockedUntil: Date | null;
      isPermanentlyBlocked: boolean;
    };
  }>,
  assertAllowed: (context: {
    user: {
      id: string;
      email: string;
      role: string;
      isRestricted: boolean;
      image: string;
      studentProfile: { studentId: string } | null;
    } | null;
    otherActiveAdminCount: number;
  }) => void,
) => {
  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        isRestricted: true,
        image: true,
        studentProfile: {
          select: { studentId: true },
        },
      },
    });

    const otherActiveAdminCount =
      user?.role === "ADMIN"
        ? await tx.user.count({
            where: {
              role: "ADMIN",
              isRestricted: false,
              id: { not: userId },
            },
          })
        : 0;

    assertAllowed({ user, otherActiveAdminCount });

    const guards = buildGuards({
      email: user!.email,
      role: user!.role,
      isRestricted: user!.isRestricted,
      image: user!.image,
      studentId: user!.studentProfile?.studentId ?? null,
    });

    let maxPermanent = false;
    for (const guardSpec of guards) {
      const existingGuard = await tx.accountDeletionGuard.findUnique({
        where: { identifierHash: guardSpec.identifierHash },
        select: { deletionCount: true },
      });
      const nextState = guardSpec.computeState(existingGuard?.deletionCount ?? 0);
      if (nextState.isPermanentlyBlocked) maxPermanent = true;

      await tx.accountDeletionGuard.upsert({
        where: { identifierHash: guardSpec.identifierHash },
        create: {
          identifierHash: guardSpec.identifierHash,
          identifierType: guardSpec.identifierType,
          ...nextState,
        },
        update: nextState,
      });
    }

    await tx.submission.updateMany({
      where: { gradedById: userId },
      data: { gradedById: null },
    });

    await tx.user.delete({
      where: { id: userId },
    });

    return {
      deletedUserId: userId,
      previousImage: user!.image,
      isPermanentlyBlocked: maxPermanent,
    };
  });
};

export const findUserUgcTermsById = async (userId: string) => {
  return await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      ugcTermsAcceptedAt: true,
    },
  });
};

export const acceptUserUgcTermsById = async (userId: string) => {
  await prisma.user.updateMany({
    where: {
      id: userId,
      ugcTermsAcceptedAt: null,
    },
    data: {
      ugcTermsAcceptedAt: new Date(),
    },
  });

  return await findUserUgcTermsById(userId);
};
