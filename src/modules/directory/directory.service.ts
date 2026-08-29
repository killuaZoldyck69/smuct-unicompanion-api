import * as directoryRepository from "./directory.repository";

export const getAllTeachersService = async () => {
  return await directoryRepository.findTeachersDirectory();
};
