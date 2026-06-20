import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { CreateAlumniPayload, UpdateAlumniPayload } from "./alumni.schema";

export const getAllAlumniService = async () => {
  return await prisma.alumni.findMany({ orderBy: { graduationYear: "desc" } });
};

export const createAlumniService = async (data: CreateAlumniPayload) => {
  return await prisma.alumni.create({ data });
};

export const bulkCreateAlumniService = async (
  dataArray: CreateAlumniPayload[],
) => {
  return await prisma.alumni.createMany({
    data: dataArray,
    skipDuplicates: true,
  });
};

export const updateAlumniService = async (
  id: string,
  data: UpdateAlumniPayload,
) => {
  const alumni = await prisma.alumni.findUnique({ where: { id } });
  if (!alumni) throw new AppError("Alumni not found", 404);
  return await prisma.alumni.update({ where: { id }, data });
};

export const deleteAlumniService = async (id: string) => {
  const alumni = await prisma.alumni.findUnique({ where: { id } });
  if (!alumni) throw new AppError("Alumni not found", 404);
  return await prisma.alumni.delete({ where: { id } });
};
