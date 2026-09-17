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

export const bulkCreateAlumni = async (
  dataArray: CreateAlumniPayload[],
) => {
  return await prisma.alumni.createMany({
    data: dataArray,
    skipDuplicates: true,
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
