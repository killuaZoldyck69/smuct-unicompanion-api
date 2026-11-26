import { prisma } from "../../../lib/prisma";
import { AppError } from "../../../utils/AppError";
import { HubRole } from "../../../constants/enums";

export const MAX_HUB_MEMBERS_LIST = 300;

export const findActiveMemberByHubAndId = (
  hubId: string,
  memberId: string,
) =>
  prisma.hubMember.findFirst({
    where: { id: memberId, hubId, isActive: true },
    select: {
      id: true,
      userId: true,
      hubId: true,
      role: true,
      isActive: true,
      user: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
  });

export const updateMemberRoleAtomic = (
  hubId: string,
  memberId: string,
  role: HubRole,
) =>
  prisma.$transaction(async (tx) => {
    const [lockedHub] = await tx.$queryRaw<
      Array<{ id: string; isArchived: boolean }>
    >`
      SELECT id, "isArchived"
      FROM "CourseHub"
      WHERE id = ${hubId}
      FOR UPDATE
    `;

    if (!lockedHub) {
      throw new AppError("Course Hub not found.", 404);
    }
    if (lockedHub.isArchived) {
      throw new AppError("Archived course hubs cannot modify member roles.", 400);
    }

    const result = await tx.hubMember.updateMany({
      where: { id: memberId, hubId, isActive: true },
      data: { role },
    });
    if (result.count === 0) {
      throw new AppError("Member not found in this course hub.", 404);
    }

    return tx.hubMember.findUniqueOrThrow({ where: { id: memberId } });
  });

export const deactivateMemberAtomic = (hubId: string, memberId: string) =>
  prisma.$transaction(async (tx) => {
    const [lockedHub] = await tx.$queryRaw<
      Array<{ id: string; isArchived: boolean }>
    >`
      SELECT id, "isArchived"
      FROM "CourseHub"
      WHERE id = ${hubId}
      FOR UPDATE
    `;

    if (!lockedHub) {
      throw new AppError("Course Hub not found.", 404);
    }
    if (lockedHub.isArchived) {
      throw new AppError("Archived course hubs cannot remove members.", 400);
    }

    const result = await tx.hubMember.updateMany({
      where: { id: memberId, hubId, isActive: true },
      data: { isActive: false },
    });
    if (result.count === 0) {
      throw new AppError("Member not found in this course hub.", 404);
    }
  });

/**
 * Atomically verifies that the last active instructor cannot abandon an existing hub,
 * then hard-deletes the user's own membership row so voluntary rejoin via joinCode remains possible.
 */
export const leaveHubMemberAtomic = (
  hubId: string,
  memberId: string,
  isTeacher: boolean,
) =>
  prisma.$transaction(async (tx) => {
    const [lockedHub] = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM "CourseHub"
      WHERE id = ${hubId}
      FOR UPDATE
    `;

    if (!lockedHub) {
      throw new AppError("Course Hub not found.", 404);
    }

    if (isTeacher) {
      const activeTeacherCount = await tx.hubMember.count({
        where: {
          hubId,
          role: HubRole.TEACHER,
          isActive: true,
        },
      });
      if (activeTeacherCount <= 1) {
        throw new AppError(
          "You are the only instructor in this course hub. Delete or archive the hub instead of leaving.",
          400,
        );
      }
    }

    return tx.hubMember.delete({
      where: { id: memberId },
    });
  });

export const findMembersByHubId = (hubId: string) =>
  prisma.hubMember.findMany({
    where: { hubId, isActive: true },
    orderBy: { id: "asc" as const },
    take: MAX_HUB_MEMBERS_LIST,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          image: true,
          role: true,
          googleDriveConnected: true,
          email: true,
          phoneNumber: true,
          studentProfile: {
            select: {
              studentId: true,
              department: true,
              batch: true,
              currentSemester: true,
              section: true,
              program: true,
            },
          },
          teacherProfile: {
            select: {
              teacherId: true,
              department: true,
              designation: true,
              faculty: true,
              officeRoom: true,
              consultationSlots: true,
            },
          },
        },
      },
    },
  });
