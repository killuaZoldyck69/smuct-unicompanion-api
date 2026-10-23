import { AppError } from "../../utils/AppError";
import * as noticeRepository from "./notice.repository";
import {
  CreateNoticePayload,
  UpdateNoticePayload,
  GetNoticesQuery,
} from "./notice.schema";
import { noticeCache } from "./notice.cache";

export const createNoticeService = async (data: CreateNoticePayload) => {
  const newNotice = await noticeRepository.createNotice(data);
  noticeCache.invalidateAll();
  return newNotice;
};

export const getAllNoticesService = async (query?: GetNoticesQuery) => {
  const page = query?.page || 1;
  const limit = query?.limit || 20;
  const search = query?.search?.trim() || "";
  const sortBy = query?.sortBy || "createdAt";
  const sortOrder = query?.sortOrder || "desc";

  const cacheKey = `notices:${search}:${page}:${limit}:${sortBy}:${sortOrder}`;
  const cached = noticeCache.get<any>(cacheKey);
  if (cached) {
    return cached;
  }

  const result = await noticeRepository.findPaginatedNotices({
    page,
    limit,
    search,
    sortBy,
    sortOrder,
  });

  // Cache for 60 seconds (high read throughput)
  noticeCache.set(cacheKey, result, 60);
  return result;
};

export const getNoticeByIdService = async (id: string) => {
  const cacheKey = `notice:${id}`;
  const cached = noticeCache.get<any>(cacheKey);
  if (cached) {
    return cached;
  }

  const notice = await noticeRepository.findNoticeById(id);

  if (!notice) {
    throw new AppError("Notice not found.", 404);
  }

  noticeCache.set(cacheKey, notice, 60);
  return notice;
};

export const updateNoticeService = async (
  id: string,
  data: UpdateNoticePayload,
) => {
  const existingNotice = await noticeRepository.findNoticeById(id);

  if (!existingNotice) {
    throw new AppError("Notice not found.", 404);
  }

  const updatedNotice = await noticeRepository.updateNoticeById(id, data);
  noticeCache.invalidateAll();
  return updatedNotice;
};

export const deleteNoticeService = async (id: string) => {
  const existingNotice = await noticeRepository.findNoticeById(id);

  if (!existingNotice) {
    throw new AppError("Notice not found.", 404);
  }

  const result = await noticeRepository.deleteNoticeById(id);
  noticeCache.invalidateAll();
  return result;
};

