import { prisma } from "../../lib/prisma";
import { CreateAlumniPayload, UpdateAlumniPayload } from "./alumni.schema";

export const findAllAlumni = async (take = 100) => {
  return await prisma.alumni.findMany({
    orderBy: { graduationYear: "desc" },
    take,
  });
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
