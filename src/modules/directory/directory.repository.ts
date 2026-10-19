import { prisma } from "../../lib/prisma";
import { Prisma } from "../../../generated/prisma/client";
import { GetTeachersDirectoryQuery } from "./directory.schema";

export const findTeachersDirectory = async (
  query?: Partial<GetTeachersDirectoryQuery>,
) => {
  const where: Prisma.UserWhereInput = {
    role: "TEACHER",
  };

  const conditions: Prisma.UserWhereInput[] = [];

  if (query?.department?.trim()) {
    conditions.push({
      teacherProfile: {
        department: {
          equals: query.department.trim(),
          mode: "insensitive",
        },
      },
    });
  }

  if (query?.search?.trim()) {
    const term = query.search.trim();
    conditions.push({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        { phoneNumber: { contains: term, mode: "insensitive" } },
        {
          teacherProfile: {
            OR: [
              { teacherId: { contains: term, mode: "insensitive" } },
              { department: { contains: term, mode: "insensitive" } },
              { designation: { contains: term, mode: "insensitive" } },
              { faculty: { contains: term, mode: "insensitive" } },
              { officeRoom: { contains: term, mode: "insensitive" } },
            ],
          },
        },
      ],
    });
  }

  if (conditions.length > 0) {
    where.AND = conditions;
  }

  const select = {
    id: true,
    name: true,
    email: true,
    image: true,
    phoneNumber: true,
    bloodGroup: true,
    role: true,
    createdAt: true,
    teacherProfile: {
      select: {
        id: true,
        userId: true,
        teacherId: true,
        designation: true,
        administrativeRole: true,
        department: true,
        faculty: true,
        officeRoom: true,
        consultationHours: true,
        advisoryBatch: true,
        dayOff: true,
        consultationSlots: true,
        expertiseFields: true,
        academicQualifications: true,
        linkedInUrl: true,
        personalWebsiteUrl: true,
      },
    },
  };

  const page = Math.max(1, Number(query?.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(query?.limit) || 15));
  const skip = (page - 1) * limit;

  const [teachers, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select,
      skip,
      take: limit,
      orderBy: {
        name: "asc",
      },
    }),
    prisma.user.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    teachers,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  };
};

export const findTeacherDepartments = async (): Promise<string[]> => {
  const distinctProfiles = await prisma.teacherProfile.findMany({
    where: {
      department: { not: "" },
      user: { role: "TEACHER" },
    },
    select: {
      department: true,
    },
    distinct: ["department"],
    orderBy: {
      department: "asc",
    },
  });

  return distinctProfiles
    .map((p) => p.department.trim())
    .filter(Boolean);
};
