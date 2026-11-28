import crypto from "node:crypto";
import { envConfig } from "../../config/env";
import { appCache } from "../../lib/cache";
import { AppError } from "../../utils/AppError";
import {
  appendHashParams,
  decryptDriveToken,
  encryptDriveToken,
  isAllowedDriveReturnUrl,
  signDriveOAuthState,
  verifyDriveOAuthState,
} from "./google-drive.crypto";
import * as driveRepo from "./google-drive.repository";

const GOOGLE_OAUTH_SCOPE =
  "https://www.googleapis.com/auth/drive.file email profile openid";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT =
  "https://www.googleapis.com/oauth2/v3/userinfo";
const GOOGLE_REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
const OAUTH_HTTP_TIMEOUT_MS = 15_000;

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleUserInfoResponse {
  email?: string;
  name?: string;
  picture?: string;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = OAUTH_HTTP_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function resolveGoogleDriveRedirectUri(): string {
  const explicit = envConfig.GOOGLE_DRIVE_REDIRECT_URI.trim().replace(
    /\/+$/,
    "",
  );
  if (explicit) return explicit;
  return `${envConfig.BETTER_AUTH_URL.replace(/\/+$/, "")}/api/google-drive/callback`;
}

function requireGoogleOAuthConfig(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  const clientId = envConfig.GOOGLE_CLIENT_ID.trim();
  const clientSecret = envConfig.GOOGLE_CLIENT_SECRET.trim();
  if (!clientId || !clientSecret) {
    throw new AppError(
      "Google Drive OAuth is not configured on the server. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
      503,
    );
  }
  return {
    clientId,
    clientSecret,
    redirectUri: resolveGoogleDriveRedirectUri(),
  };
}

export async function createDriveAuthUrlService(
  userId: string,
  returnUrl: string,
): Promise<{ authUrl: string; redirectUri: string }> {
  const { clientId, redirectUri } = requireGoogleOAuthConfig();

  if (
    !isAllowedDriveReturnUrl(returnUrl, {
      frontendUrl: envConfig.FRONTEND_URL,
      trustedOrigins: envConfig.TRUSTED_ORIGINS,
    })
  ) {
    throw new AppError("Invalid Google Drive return URL.", 400);
  }

  const state = signDriveOAuthState(
    {
      userId,
      returnUrl: returnUrl.trim(),
      nonce: crypto.randomBytes(16).toString("hex"),
      exp: Date.now() + OAUTH_STATE_TTL_MS,
    },
    envConfig.BETTER_AUTH_SECRET,
  );

  const authParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: GOOGLE_OAUTH_SCOPE,
    state,
  });

  return {
    authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${authParams.toString()}`,
    redirectUri,
  };
}

async function fetchGoogleUserInfoBestEffort(
  accessToken: string,
): Promise<GoogleUserInfoResponse> {
  try {
    const res = await fetchWithTimeout(
      GOOGLE_USERINFO_ENDPOINT,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      10_000,
    );
    if (!res.ok) return {};
    return (await res.json()) as GoogleUserInfoResponse;
  } catch {
    return {};
  }
}

export async function handleDriveOAuthCallbackService(params: {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
}): Promise<{ redirectUrl: string | null; errorMessage?: string }> {
  const statePayload = params.state
    ? verifyDriveOAuthState(params.state, envConfig.BETTER_AUTH_SECRET)
    : null;

  if (!statePayload) {
    return {
      redirectUrl: null,
      errorMessage:
        "Google Drive authorization session expired. Please return to the app and try again.",
    };
  }

  if (
    !isAllowedDriveReturnUrl(statePayload.returnUrl, {
      frontendUrl: envConfig.FRONTEND_URL,
      trustedOrigins: envConfig.TRUSTED_ORIGINS,
    })
  ) {
    return {
      redirectUrl: null,
      errorMessage: "Invalid Google Drive callback destination.",
    };
  }

  if (params.error || !params.code) {
    return {
      redirectUrl: appendHashParams(statePayload.returnUrl, {
        drive_error:
          params.errorDescription ||
          params.error ||
          "Authorization was cancelled.",
      }),
    };
  }

  let config: ReturnType<typeof requireGoogleOAuthConfig>;
  try {
    config = requireGoogleOAuthConfig();
  } catch (err) {
    return {
      redirectUrl: appendHashParams(statePayload.returnUrl, {
        drive_error:
          err instanceof Error
            ? err.message
            : "Google Drive OAuth is not configured on the server.",
      }),
    };
  }

  let tokenData: GoogleTokenResponse;
  try {
    const tokenRes = await fetchWithTimeout(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: params.code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });
    tokenData = (await tokenRes.json()) as GoogleTokenResponse;
    if (!tokenRes.ok || !tokenData.access_token) {
      return {
        redirectUrl: appendHashParams(statePayload.returnUrl, {
          drive_error:
            tokenData.error_description ||
            tokenData.error ||
            "Could not exchange authorization code with Google.",
        }),
      };
    }
  } catch {
    return {
      redirectUrl: appendHashParams(statePayload.returnUrl, {
        drive_error: "Timed out connecting to Google. Please try again.",
      }),
    };
  }

  const userInfo = await fetchGoogleUserInfoBestEffort(tokenData.access_token);
  const existing = await driveRepo.getUserDriveCredentials(statePayload.userId);

  let encryptedRefreshToken: string | null = null;
  if (tokenData.refresh_token) {
    encryptedRefreshToken = encryptDriveToken(
      tokenData.refresh_token,
      envConfig.BETTER_AUTH_SECRET,
    );
  } else if (
    existing?.googleDriveRefreshTokenEnc &&
    (!userInfo.email ||
      !existing.googleDriveEmail ||
      existing.googleDriveEmail.toLowerCase() === userInfo.email.toLowerCase())
  ) {
    encryptedRefreshToken = existing.googleDriveRefreshTokenEnc;
  }

  if (!encryptedRefreshToken) {
    return {
      redirectUrl: appendHashParams(statePayload.returnUrl, {
        drive_error:
          "Google did not issue a refresh token. Please remove UniCompanion access in your Google Account security settings and reconnect.",
      }),
    };
  }

  const email = userInfo.email ?? existing?.googleDriveEmail ?? null;
  const name = userInfo.name ?? existing?.googleDriveName ?? null;
  const avatarUrl = userInfo.picture ?? existing?.googleDriveAvatarUrl ?? null;

  await driveRepo.saveUserDriveConnection(statePayload.userId, {
    email,
    name,
    avatarUrl,
    encryptedRefreshToken,
  });
  appCache.delPattern(/^hub:/);

  return {
    redirectUrl: appendHashParams(statePayload.returnUrl, {
      drive_connected: "1",
      ...(email ? { email } : {}),
    }),
  };
}

export async function getDriveConnectionStatusService(userId: string) {
  const row = await driveRepo.getUserDriveCredentials(userId);
  const isConnected = Boolean(
    row?.googleDriveConnected && row?.googleDriveRefreshTokenEnc,
  );
  return {
    isConnected,
    email: isConnected ? (row?.googleDriveEmail ?? null) : null,
    name: isConnected ? (row?.googleDriveName ?? null) : null,
    avatarUrl: isConnected ? (row?.googleDriveAvatarUrl ?? null) : null,
  };
}

export async function mintFreshDriveAccessTokenService(userId: string) {
  const row = await driveRepo.getUserDriveCredentials(userId);
  if (!row?.googleDriveRefreshTokenEnc) {
    if (row?.googleDriveConnected) {
      await driveRepo.clearUserDriveConnection(userId);
      appCache.delPattern(/^hub:/);
    }
    return { connected: false as const, revoked: false };
  }

  const { clientId, clientSecret } = requireGoogleOAuthConfig();

  let refreshToken: string;
  try {
    refreshToken = decryptDriveToken(
      row.googleDriveRefreshTokenEnc,
      envConfig.BETTER_AUTH_SECRET,
    );
  } catch {
    await driveRepo.clearUserDriveConnection(userId);
    appCache.delPattern(/^hub:/);
    return { connected: false as const, revoked: true };
  }

  const res = await fetchWithTimeout(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });

  const data = (await res.json().catch(() => ({}))) as GoogleTokenResponse;

  if (!res.ok || !data.access_token) {
    if (
      res.status === 400 ||
      res.status === 401 ||
      data.error === "invalid_grant"
    ) {
      await driveRepo.clearUserDriveConnection(userId);
      appCache.delPattern(/^hub:/);
      return { connected: false as const, revoked: true };
    }
    throw new AppError(
      data.error_description ||
        "Could not refresh Google Drive access token. Please try again.",
      502,
    );
  }

  if (data.refresh_token && data.refresh_token !== refreshToken) {
    await driveRepo.saveUserDriveConnection(userId, {
      email: row.googleDriveEmail ?? null,
      name: row.googleDriveName ?? null,
      avatarUrl: row.googleDriveAvatarUrl ?? null,
      encryptedRefreshToken: encryptDriveToken(
        data.refresh_token,
        envConfig.BETTER_AUTH_SECRET,
      ),
    });
  }

  return {
    connected: true as const,
    accessToken: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    email: row.googleDriveEmail ?? null,
    name: row.googleDriveName ?? null,
    avatarUrl: row.googleDriveAvatarUrl ?? null,
  };
}

export async function disconnectDriveService(userId: string) {
  const row = await driveRepo.getUserDriveCredentials(userId);
  if (row?.googleDriveRefreshTokenEnc) {
    try {
      const refreshToken = decryptDriveToken(
        row.googleDriveRefreshTokenEnc,
        envConfig.BETTER_AUTH_SECRET,
      );
      await fetchWithTimeout(
        GOOGLE_REVOKE_ENDPOINT,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: refreshToken }).toString(),
        },
        5_000,
      );
    } catch {
      // Best-effort revocation; local connection cleanup must still succeed.
    }
  }

  await driveRepo.clearUserDriveConnection(userId);
  appCache.delPattern(/^hub:/);
  return { disconnected: true };
}
