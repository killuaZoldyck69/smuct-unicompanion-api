import { Request, Response } from "express";
import { catchAsync } from "../../../utils/catchAsync";
import * as contentService from "./content.service";

export const createAnnouncement = catchAsync(
  async (req: Request, res: Response) => {
    const data = await contentService.createAnnouncement(
      req.user.id,
      req.params.id as string,
      req.body,
    );
    res
      .status(201)
      .json({ success: true, message: "Announcement posted", data });
  },
);

export const getAnnouncements = catchAsync(
  async (req: Request, res: Response) => {
    const page =
      typeof req.query.page === "number"
        ? req.query.page
        : req.query.page
          ? Number(req.query.page)
          : undefined;
    const limit =
      typeof req.query.limit === "number"
        ? req.query.limit
        : req.query.limit
          ? Number(req.query.limit)
          : undefined;

    const result = await contentService.getAnnouncements(
      req.user.id,
      req.params.id as string,
      { page, limit },
    );
    res.status(200).json({
      success: true,
      data: result.announcements,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  },
);

export const updateAnnouncement = catchAsync(
  async (req: Request, res: Response) => {
    const data = await contentService.updateAnnouncement(
      req.user.id,
      req.params.id as string,
      req.params.announcementId as string,
      req.body,
    );
    res
      .status(200)
      .json({ success: true, message: "Announcement updated", data });
  },
);

export const deleteAnnouncement = catchAsync(
  async (req: Request, res: Response) => {
    await contentService.deleteAnnouncement(
      req.user.id,
      req.params.id as string,
      req.params.announcementId as string,
    );
    res.status(200).json({ success: true, message: "Announcement deleted" });
  },
);

export const createDiscussion = catchAsync(
  async (req: Request, res: Response) => {
    const data = await contentService.createDiscussion(
      req.user.id,
      req.params.id as string,
      req.body,
    );
    res.status(201).json({ success: true, message: "Discussion posted", data });
  },
);

export const replyDiscussion = catchAsync(
  async (req: Request, res: Response) => {
    const data = await contentService.replyToDiscussion(
      req.user.id,
      req.params.id as string,
      req.params.discussionId as string,
      req.body.content,
    );
    res.status(201).json({ success: true, message: "Reply posted", data });
  },
);

export const getDiscussions = catchAsync(
  async (req: Request, res: Response) => {
    const data = await contentService.getDiscussions(
      req.user.id,
      req.params.id as string,
    );
    res.status(200).json({ success: true, data });
  },
);

export const commentAnnouncement = catchAsync(
  async (req: Request, res: Response) => {
    const data = await contentService.commentOnAnnouncement(
      req.user.id,
      req.params.id as string,
      req.params.announcementId as string,
      req.body.content,
      req.body.parentId,
    );
    res.status(201).json({
      success: true,
      message: req.body.parentId ? "Reply posted" : "Comment posted",
      data,
    });
  },
);

export const updateAnnouncementComment = catchAsync(
  async (req: Request, res: Response) => {
    const data = await contentService.editAnnouncementComment(
      req.user.id,
      req.params.id as string,
      req.params.announcementId as string,
      req.params.commentId as string,
      req.body.content,
    );
    res.status(200).json({
      success: true,
      message: "Comment updated",
      data,
    });
  },
);

export const deleteAnnouncementComment = catchAsync(
  async (req: Request, res: Response) => {
    await contentService.removeAnnouncementComment(
      req.user.id,
      req.params.id as string,
      req.params.announcementId as string,
      req.params.commentId as string,
    );
    res.status(200).json({
      success: true,
      message: "Comment deleted",
    });
  },
);
