import { AppError } from "../../utils/AppError";
import * as noticeRepository from "./notice.repository";
import {
  CreateNoticePayload,
  UpdateNoticePayload,
  GetNoticesQuery,
} from "./notice.schema";
import { noticeCache } from "./notice.cache";
import { prisma } from "../../lib/prisma";
import { createNotifications, createNotificationsForAllUsers } from "../notification/notification.service";

export const createNoticeService = async (
  data: CreateNoticePayload,
  creatorId?: string,
) => {
  const newNotice = await noticeRepository.createNotice(data);
  try {
    const recipients = await prisma.user.findMany({
      where: creatorId ? { id: { not: creatorId } } : undefined,
      select: { id: true },
    });
    await createNotifications(
      recipients.map((user) => user.id),
      {
        type: "NOTICE",
        title: "New campus notice",
        body: newNotice.title,
        route: `/(tabs)/notices?noticeId=${newNotice.id}`,
        dedupeKey: `notice:${newNotice.id}`,
      },
    );
  } catch (error) {
    console.error("Failed to find notice notification recipients:", error);
  }
  noticeCache.invalidateAll();
  return newNotice;
};

export const getAllNoticesService = async (query?: GetNoticesQuery) => {
  const page = query?.page || 1;
  const limit = query?.limit || 20;
  const search = query?.search?.trim() || "";
  const category = query?.category?.trim() || "";
  const sortBy = query?.sortBy || "createdAt";
  const sortOrder = query?.sortOrder || "desc";

  const cacheKey = `notices:${category}:${search}:${page}:${limit}:${sortBy}:${sortOrder}`;
  const cached = noticeCache.get<any>(cacheKey);
  if (cached) {
    return cached;
  }

  const result = await noticeRepository.findPaginatedNotices({
    page,
    limit,
    search,
    category,
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
  await createNotificationsForAllUsers({
    type: "NOTICE_UPDATED",
    title: "Campus notice updated",
    body: updatedNotice.title,
    route: `/(tabs)/notices?noticeId=${updatedNotice.id}`,
    dedupeKey: `notice:${updatedNotice.id}:updated:${updatedNotice.updatedAt.toISOString()}`,
  });
  noticeCache.invalidateAll();
  return updatedNotice;
};

export const deleteNoticeService = async (id: string) => {
  const existingNotice = await noticeRepository.findNoticeById(id);

  if (!existingNotice) {
    throw new AppError("Notice not found.", 404);
  }

  const result = await noticeRepository.deleteNoticeById(id);
  await createNotificationsForAllUsers({
    type: "NOTICE_REMOVED",
    title: "Campus notice removed",
    body: existingNotice.title,
    route: "/(tabs)/notices",
    dedupeKey: `notice:${id}:removed`,
  });
  noticeCache.invalidateAll();
  return result;
};
