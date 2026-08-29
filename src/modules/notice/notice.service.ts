import { AppError } from "../../utils/AppError";
import * as noticeRepository from "./notice.repository";
import { CreateNoticePayload } from "./notice.schema";

export const createNoticeService = async (data: CreateNoticePayload) => {
  return await noticeRepository.createNotice(data);
};

export const getAllNoticesService = async () => {
  return await noticeRepository.findAllNotices(100);
};

export const getNoticeByIdService = async (id: string) => {
  const notice = await noticeRepository.findNoticeById(id);

  if (!notice) {
    throw new AppError("Notice not found.", 404);
  }

  return notice;
};

export const deleteNoticeService = async (id: string) => {
  // Check if the notice exists before attempting to delete
  const existingNotice = await noticeRepository.findNoticeById(id);

  if (!existingNotice) {
    throw new AppError("Notice not found.", 404);
  }

  return await noticeRepository.deleteNoticeById(id);
};
