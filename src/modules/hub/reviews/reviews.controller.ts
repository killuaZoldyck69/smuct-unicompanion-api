import { Request, Response } from "express";
import { catchAsync } from "../../../utils/catchAsync";
import * as reviewService from "./reviews.service";

export const updateReviewSettings = catchAsync(
  async (req: Request, res: Response) => {
    const data = await reviewService.updateReviewSettings(
      req.user.id,
      req.params.id as string,
      req.body,
    );
    res
      .status(200)
      .json({ success: true, message: "Review settings updated.", data });
  },
);

export const submitReview = catchAsync(async (req: Request, res: Response) => {
  const data = await reviewService.submitReview(
    req.user.id,
    req.params.id as string,
    req.body,
  );
  res.status(201).json({ success: true, message: "Review submitted.", data });
});

export const getReviews = catchAsync(async (req: Request, res: Response) => {
  const data = await reviewService.getReviews(req.params.id as string);
  res.status(200).json({ success: true, data });
});
