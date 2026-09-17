import { AppError } from "../../utils/AppError";
import * as alumniRepository from "./alumni.repository";
import { CreateAlumniPayload, UpdateAlumniPayload } from "./alumni.schema";

export interface AlumniQueryOptions {
  page?: number | string;
  limit?: number | string;
  department?: string;
  search?: string;
  all?: boolean | string;
}

export const getAllAlumniService = async (query?: AlumniQueryOptions) => {
  const isAll = query?.all === "true" || query?.all === true;
  const page = Math.max(1, Number(query?.page) || 1);
  const limit = isAll
    ? 1000
    : Math.max(1, Math.min(100, Number(query?.limit) || 20));
  const skip = isAll ? 0 : (page - 1) * limit;

  const where: any = {};

  if (
    query?.department &&
    query.department.trim() &&
    query.department.trim().toLowerCase() !== "all"
  ) {
    where.department = {
      equals: query.department.trim(),
      mode: "insensitive",
    };
  }

  if (query?.search && query.search.trim()) {
    const q = query.search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { currentCompany: { contains: q, mode: "insensitive" } },
      { currentPosition: { contains: q, mode: "insensitive" } },
      { batch: { contains: q, mode: "insensitive" } },
      { department: { contains: q, mode: "insensitive" } },
      { skills: { has: q } },
    ];
  }

  const [alumni, total] = await Promise.all([
    alumniRepository.findAllAlumni(where, skip, limit),
    alumniRepository.countAlumni(where),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    data: alumni,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  };
};

export const getAlumniDepartmentsService = async () => {
  return await alumniRepository.findAlumniDepartments();
};

export const createAlumniService = async (data: CreateAlumniPayload) => {
  return await alumniRepository.createAlumni(data);
};

export const bulkCreateAlumniService = async (
  dataArray: CreateAlumniPayload[],
) => {
  return await alumniRepository.bulkCreateAlumni(dataArray);
};

export const updateAlumniService = async (
  id: string,
  data: UpdateAlumniPayload,
) => {
  const alumni = await alumniRepository.findAlumniById(id);
  if (!alumni) throw new AppError("Alumni not found", 404);
  return await alumniRepository.updateAlumni(id, data);
};

export const deleteAlumniService = async (id: string) => {
  const alumni = await alumniRepository.findAlumniById(id);
  if (!alumni) throw new AppError("Alumni not found", 404);
  return await alumniRepository.deleteAlumniById(id);
};
