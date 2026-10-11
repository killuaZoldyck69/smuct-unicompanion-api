import * as directoryRepository from "./directory.repository";
import { GetTeachersDirectoryQuery } from "./directory.schema";

export const getAllTeachersService = async (
  query?: Partial<GetTeachersDirectoryQuery>,
) => {
  return await directoryRepository.findTeachersDirectory(query);
};

export const getTeacherDepartmentsService = async () => {
  return await directoryRepository.findTeacherDepartments();
};
