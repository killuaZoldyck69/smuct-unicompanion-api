import { AppError } from "../../utils/AppError";
import * as alumniRepository from "./alumni.repository";
import { CreateAlumniPayload, UpdateAlumniPayload } from "./alumni.schema";

export const getAllAlumniService = async () => {
  return await alumniRepository.findAllAlumni(100);
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
