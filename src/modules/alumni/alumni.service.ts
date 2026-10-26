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
  const andConditions: any[] = [];

  if (
    query?.department &&
    query.department.trim() &&
    query.department.trim().toLowerCase() !== "all"
  ) {
    const deptTerm = query.department.trim();
    andConditions.push({
      OR: [
        { department: { equals: deptTerm, mode: "insensitive" } },
        { department: { contains: deptTerm, mode: "insensitive" } },
      ],
    });
  }

  if (query?.search && query.search.trim()) {
    const q = query.search.trim();
    andConditions.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { studentId: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { currentCompany: { contains: q, mode: "insensitive" } },
        { currentPosition: { contains: q, mode: "insensitive" } },
        { degree: { contains: q, mode: "insensitive" } },
        { batch: { contains: q, mode: "insensitive" } },
        { department: { contains: q, mode: "insensitive" } },
        { skills: { has: q } },
      ],
    });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
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

export const getAlumniByIdService = async (id: string) => {
  const alumni = await alumniRepository.findAlumniById(id);
  if (!alumni) throw new AppError("Alumni profile not found", 404);
  return alumni;
};

export const getAlumniDepartmentsService = async () => {
  return await alumniRepository.findAlumniDepartments();
};

export const createAlumniService = async (data: CreateAlumniPayload) => {
  // Check duplicate studentId
  if (data.studentId && data.studentId.trim()) {
    const existingById = await alumniRepository.findExistingAlumniByIdentifiers(
      [data.studentId.trim()],
      [],
    );
    if (existingById.length > 0) {
      throw new AppError(
        `An alumnus with Student ID ${data.studentId} is already registered.`,
        409,
      );
    }
  }

  // Check duplicate email
  if (data.email && data.email.trim()) {
    const existingByEmail = await alumniRepository.findExistingAlumniByIdentifiers(
      [],
      [data.email.trim().toLowerCase()],
    );
    if (existingByEmail.length > 0) {
      throw new AppError(
        `An alumnus with email ${data.email} is already registered.`,
        409,
      );
    }
  }

  return await alumniRepository.createAlumni(data);
};

export interface SkippedRecord {
  name: string;
  studentId?: string | null;
  email?: string | null;
  reason: string;
}

export const bulkCreateAlumniService = async (
  dataArray: CreateAlumniPayload[] | { alumni?: CreateAlumniPayload[] },
) => {
  const rawItems: CreateAlumniPayload[] = Array.isArray(dataArray)
    ? dataArray
    : (dataArray as any)?.alumni || [];

  if (rawItems.length === 0) {
    return {
      totalReceived: 0,
      insertedCount: 0,
      skippedCount: 0,
      skippedRecords: [],
    };
  }

  // 1. In-batch duplicate detection
  const seenStudentIds = new Set<string>();
  const seenEmails = new Set<string>();
  const seenCombos = new Set<string>();

  const inBatchCandidates: CreateAlumniPayload[] = [];
  const skippedRecords: SkippedRecord[] = [];

  for (const item of rawItems) {
    const cleanStudentId = item.studentId ? item.studentId.trim() : null;
    const cleanEmail = item.email ? item.email.trim().toLowerCase() : null;
    const combo = `${item.name.toLowerCase()}#${item.department.toLowerCase()}#${item.batch.toLowerCase()}`;

    if (cleanStudentId && seenStudentIds.has(cleanStudentId)) {
      skippedRecords.push({
        name: item.name,
        studentId: cleanStudentId,
        email: cleanEmail,
        reason: `Duplicate Student ID in import payload (${cleanStudentId})`,
      });
      continue;
    }

    if (cleanEmail && seenEmails.has(cleanEmail)) {
      skippedRecords.push({
        name: item.name,
        studentId: cleanStudentId,
        email: cleanEmail,
        reason: `Duplicate email in import payload (${cleanEmail})`,
      });
      continue;
    }

    if (seenCombos.has(combo)) {
      skippedRecords.push({
        name: item.name,
        studentId: cleanStudentId,
        email: cleanEmail,
        reason: "Duplicate record within import payload",
      });
      continue;
    }

    if (cleanStudentId) seenStudentIds.add(cleanStudentId);
    if (cleanEmail) seenEmails.add(cleanEmail);
    seenCombos.add(combo);
    inBatchCandidates.push(item);
  }

  // 2. Database duplicate detection
  const studentIdsToCheck = Array.from(seenStudentIds);
  const emailsToCheck = Array.from(seenEmails);

  const existingInDb = await alumniRepository.findExistingAlumniByIdentifiers(
    studentIdsToCheck,
    emailsToCheck,
  );

  const dbStudentIdSet = new Set(
    existingInDb
      .map((a) => (a.studentId ? a.studentId.trim() : null))
      .filter(Boolean) as string[],
  );
  const dbEmailSet = new Set(
    existingInDb
      .map((a) => (a.email ? a.email.trim().toLowerCase() : null))
      .filter(Boolean) as string[],
  );

  const toInsert: CreateAlumniPayload[] = [];

  for (const item of inBatchCandidates) {
    const cleanStudentId = item.studentId ? item.studentId.trim() : null;
    const cleanEmail = item.email ? item.email.trim().toLowerCase() : null;

    if (cleanStudentId && dbStudentIdSet.has(cleanStudentId)) {
      skippedRecords.push({
        name: item.name,
        studentId: cleanStudentId,
        email: cleanEmail,
        reason: `Student ID ${cleanStudentId} already registered in database`,
      });
      continue;
    }

    if (cleanEmail && dbEmailSet.has(cleanEmail)) {
      skippedRecords.push({
        name: item.name,
        studentId: cleanStudentId,
        email: cleanEmail,
        reason: `Email ${cleanEmail} already registered in database`,
      });
      continue;
    }

    toInsert.push(item);
  }

  // 3. Insert valid records transactionally
  if (toInsert.length > 0) {
    await alumniRepository.bulkCreateAlumni(toInsert);
  }

  return {
    totalReceived: rawItems.length,
    insertedCount: toInsert.length,
    skippedCount: skippedRecords.length,
    skippedRecords,
  };
};

export const updateAlumniService = async (
  id: string,
  data: UpdateAlumniPayload,
) => {
  const existing = await alumniRepository.findAlumniById(id);
  if (!existing) throw new AppError("Alumni profile not found", 404);

  // If updating studentId, verify uniqueness
  if (data.studentId && data.studentId.trim() !== existing.studentId) {
    const conflict = await alumniRepository.findExistingAlumniByIdentifiers(
      [data.studentId.trim()],
      [],
    );
    if (conflict.length > 0 && conflict[0].id !== id) {
      throw new AppError(
        `Another alumnus is already registered with Student ID ${data.studentId}.`,
        409,
      );
    }
  }

  // If updating email, verify uniqueness
  if (data.email && data.email.trim().toLowerCase() !== existing.email?.toLowerCase()) {
    const conflict = await alumniRepository.findExistingAlumniByIdentifiers(
      [],
      [data.email.trim().toLowerCase()],
    );
    if (conflict.length > 0 && conflict[0].id !== id) {
      throw new AppError(
        `Another alumnus is already registered with email ${data.email}.`,
        409,
      );
    }
  }

  return await alumniRepository.updateAlumni(id, data);
};

export const deleteAlumniService = async (id: string) => {
  const alumni = await alumniRepository.findAlumniById(id);
  if (!alumni) throw new AppError("Alumni profile not found", 404);
  return await alumniRepository.deleteAlumniById(id);
};
