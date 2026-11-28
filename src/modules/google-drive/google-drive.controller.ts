import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import * as driveService from "./google-drive.service";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderCallbackErrorPage(message: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Google Drive Connection</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f9fb; color: #0f172a; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; }
      .card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; max-width: 420px; width: 100%; text-align: center; }
      h1 { font-size: 18px; margin: 0 0 8px; }
      p { font-size: 14px; color: #475569; margin: 0; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Unable to Complete Google Drive Link</h1>
      <p>${escapeHtml(message)}</p>
    </div>
  </body>
</html>`;
}

export const getDriveStatus = catchAsync(
  async (req: Request, res: Response) => {
    const data = await driveService.getDriveConnectionStatusService(
      req.user.id,
    );
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      success: true,
      message: "Google Drive status retrieved.",
      data,
    });
  },
);

export const createDriveAuthUrl = catchAsync(
  async (req: Request, res: Response) => {
    const data = await driveService.createDriveAuthUrlService(
      req.user.id,
      req.body.returnUrl,
    );
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      success: true,
      message: "Google Drive authorization URL generated.",
      data,
    });
  },
);

export const handleDriveCallback = catchAsync(
  async (req: Request, res: Response) => {
    const result = await driveService.handleDriveOAuthCallbackService({
      code: typeof req.query.code === "string" ? req.query.code : undefined,
      state: typeof req.query.state === "string" ? req.query.state : undefined,
      error: typeof req.query.error === "string" ? req.query.error : undefined,
      errorDescription:
        typeof req.query.error_description === "string"
          ? req.query.error_description
          : undefined,
    });

    res.setHeader("Cache-Control", "no-store");
    if (result.redirectUrl) {
      res.redirect(302, result.redirectUrl);
      return;
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res
      .status(400)
      .send(
        renderCallbackErrorPage(
          result.errorMessage ||
            "Google Drive authorization failed. Please try again.",
        ),
      );
  },
);

export const mintDriveAccessToken = catchAsync(
  async (req: Request, res: Response) => {
    const data = await driveService.mintFreshDriveAccessTokenService(
      req.user.id,
    );
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      success: true,
      message: data.connected
        ? "Google Drive access token retrieved."
        : "Google Drive is not connected.",
      data,
    });
  },
);

export const disconnectDrive = catchAsync(
  async (req: Request, res: Response) => {
    const data = await driveService.disconnectDriveService(req.user.id);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      success: true,
      message: "Google Drive disconnected.",
      data,
    });
  },
);
