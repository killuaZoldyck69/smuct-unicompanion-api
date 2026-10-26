import { prisma } from "../../lib/prisma";
import { CreateAlumniPayload, UpdateAlumniPayload } from "./alumni.schema";

export const findAllAlumni = async (
  where: any = {},
  skip = 0,
  take = 20,
  orderBy: any = [{ graduationYear: "desc" }, { createdAt: "desc" }],
) => {
  return await prisma.alumni.findMany({
    where,
    skip,
    take,
    orderBy,
  });
};

export const countAlumni = async (where: any = {}) => {
  return await prisma.alumni.count({
    where,
  });
};

export const findAlumniDepartments = async () => {
  const groups = await prisma.alumni.groupBy({
    by: ["department"],
    _count: {
      department: true,
    },
    orderBy: {
      department: "asc",
    },
  });
  return groups.map((g) => ({
    department: g.department,
    count: g._count.department,
  }));
};

export const createAlumni = async (data: CreateAlumniPayload) => {
  return await prisma.alumni.create({ data });
};

export const findExistingAlumniByIdentifiers = async (
  studentIds: string[],
  emails: string[],
) => {
  const orConditions: any[] = [];
  if (studentIds.length > 0) {
    orConditions.push({ studentId: { in: studentIds } });
  }
  if (emails.length > 0) {
    orConditions.push({ email: { in: emails, mode: "insensitive" } });
  }

  if (orConditions.length === 0) return [];

  return await prisma.alumni.findMany({
    where: {
      OR: orConditions,
    },
    select: {
      id: true,
      studentId: true,
      email: true,
      name: true,
    },
  });
};

export const bulkCreateAlumni = async (dataArray: CreateAlumniPayload[]) => {
  if (dataArray.length === 0) return { count: 0 };
  return await prisma.$transaction(async (tx) => {
    return await tx.alumni.createMany({
      data: dataArray,
    });
  });
};

export const findAlumniById = async (id: string) => {
  return await prisma.alumni.findUnique({
    where: { id },
  });
};

export const updateAlumni = async (
  id: string,
  data: UpdateAlumniPayload,
) => {
  return await prisma.alumni.update({
    where: { id },
    data,
  });
};

export const deleteAlumniById = async (id: string) => {
  return await prisma.alumni.delete({
    where: { id },
  });
};
