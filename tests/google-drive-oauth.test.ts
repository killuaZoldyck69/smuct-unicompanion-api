import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/testdb";
process.env.DIRECT_URL ??= "postgresql://user:pass@localhost:5432/testdb";
process.env.BETTER_AUTH_SECRET ??= "test-secret-minimum-32-characters-long";
process.env.BETTER_AUTH_URL ??= "http://localhost:5000";
process.env.FRONTEND_URL ??= "http://localhost:8081";
process.env.BREVO_API_KEY ??= "test-brevo-key";
process.env.EMAIL_FROM ??= "no-reply@example.com";
process.env.NODE_ENV ??= "test";

import {
  appendHashParams,
  decryptDriveToken,
  encryptDriveToken,
  isAllowedDriveReturnUrl,
  signDriveOAuthState,
  verifyDriveOAuthState,
} from "../src/modules/google-drive/google-drive.crypto";

const TEST_SECRET = "super-secret-better-auth-key-32-chars-minimum";

test("encryptDriveToken and decryptDriveToken round-trip AES-256-GCM and reject tampering", () => {
  const token = "1//0gExampleGoogleRefreshToken_987654321";
  const encrypted = encryptDriveToken(token, TEST_SECRET);

  assert.equal(encrypted.startsWith("v1:"), true);
  assert.notEqual(encrypted.includes(token), true);
  assert.equal(decryptDriveToken(encrypted, TEST_SECRET), token);

  assert.throws(() => decryptDriveToken(encrypted, "wrong-secret"));

  const tampered = encrypted.slice(0, -2) + (encrypted.endsWith("00") ? "ff" : "00");
  assert.throws(() => decryptDriveToken(tampered, TEST_SECRET));
});

test("signDriveOAuthState and verifyDriveOAuthState validate HMAC signatures and expiry", () => {
  const now = 1_700_000_000_000;
  const state = signDriveOAuthState(
    {
      userId: "user-123",
      returnUrl: "smuct-unicompanion://oauth/google-drive",
      nonce: "abc123",
      exp: now + 60_000,
    },
    TEST_SECRET,
  );

  const valid = verifyDriveOAuthState(state, TEST_SECRET, now + 10_000);
  assert.equal(valid?.userId, "user-123");
  assert.equal(valid?.returnUrl, "smuct-unicompanion://oauth/google-drive");

  assert.equal(verifyDriveOAuthState(state, TEST_SECRET, now + 60_001), null);
  assert.equal(verifyDriveOAuthState(state, "other-secret", now), null);
  assert.equal(verifyDriveOAuthState(`${state}x`, TEST_SECRET, now), null);
});

test("isAllowedDriveReturnUrl permits APK, Expo Go LAN/tunnel, and configured web origins only", () => {
  const opts = {
    frontendUrl: "https://unicompanion.example.com",
    trustedOrigins: "https://admin.example.com",
  };

  assert.equal(
    isAllowedDriveReturnUrl("smuct-unicompanion://oauth/google-drive", opts),
    true,
  );
  assert.equal(
    isAllowedDriveReturnUrl("exp://192.168.0.104:8081/--/oauth/google-drive", opts),
    true,
  );
  assert.equal(
    isAllowedDriveReturnUrl("exp://10.0.2.2:8081/--/oauth/google-drive", opts),
    true,
  );
  assert.equal(
    isAllowedDriveReturnUrl("exp://u123.anonymous.exp.direct/--/oauth/google-drive", opts),
    true,
  );
  assert.equal(
    isAllowedDriveReturnUrl("http://localhost:8081/oauth/google-drive", opts),
    true,
  );
  assert.equal(
    isAllowedDriveReturnUrl("https://unicompanion.example.com/oauth/google-drive", opts),
    true,
  );

  assert.equal(isAllowedDriveReturnUrl("https://evil.example.com/steal", opts), false);
  assert.equal(isAllowedDriveReturnUrl("exp://evil.example.com/--/steal", opts), false);
  assert.equal(isAllowedDriveReturnUrl("javascript:alert(1)", opts), false);
});

test("appendHashParams appends OAuth callback params without losing path or existing hash", () => {
  assert.equal(
    appendHashParams("smuct-unicompanion://oauth/google-drive", {
      drive_connected: "1",
      email: "student@example.com",
    }),
    "smuct-unicompanion://oauth/google-drive#drive_connected=1&email=student%40example.com",
  );
});
