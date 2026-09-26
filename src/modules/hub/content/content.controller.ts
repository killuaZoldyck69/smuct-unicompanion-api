import { Request, Response } from "express";
import { catchAsync } from "../../../utils/catchAsync";
import * as contentService from "./content.service";

export const createAnnouncementComment = catchAsync(
  async (req: Request, res: Response) => {
    const data = await contentService.createAnnouncementComment(
      req.user.id,
      req.params.id as string,
      req.params.announcementId as string,
      req.body.content,
    );
    res.status(201).json({ success: true, message: "Comment posted", data });
  },
);

export const createAnnouncement = catchAsync(
  async (req: Request, res: Response) => {
    // Passes the user ID, Hub ID, and the entire body (content + optional links)
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
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const result = await contentService.getAnnouncements(
      req.params.id as string,
      { page, limit },
    );
    // Backward compatibility: if not paginated, result.announcements is returned, else both data & meta
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
    const data = await contentService.getDiscussions(req.params.id as string);
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
    );
    res.status(201).json({ success: true, message: "Comment posted", data });
  },
);
