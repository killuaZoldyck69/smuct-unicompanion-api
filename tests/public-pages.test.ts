import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/testdb";
process.env.DIRECT_URL ??= "postgresql://user:pass@localhost:5432/testdb";
process.env.BETTER_AUTH_SECRET ??= "test-secret-minimum-32-characters-long";
process.env.BETTER_AUTH_URL ??= "http://localhost:5000";
process.env.FRONTEND_URL ??= "http://localhost:8081";
process.env.BREVO_API_KEY ??= "test-brevo-key";
process.env.EMAIL_FROM ??= "no-reply@example.com";
process.env.NODE_ENV ??= "test";

import {
  escapeHtml,
  renderHomePageHtml,
  renderPrivacyPolicyHtml,
  renderTermsOfServiceHtml,
} from "../src/modules/public-pages/public-pages.routes";

test("escapeHtml sanitizes HTML special characters in support email", () => {
  const escaped = escapeHtml(`<script>"alert"&'1'</script>`);
  assert.equal(escaped.includes("<script>"), false);
  assert.equal(
    escaped,
    "&lt;script&gt;&quot;alert&quot;&amp;&#39;1&#39;&lt;/script&gt;",
  );
});

test("renderHomePageHtml includes SMUCT UniCompanion branding and links to privacy and terms", () => {
  const html = renderHomePageHtml("support@smuct.example");
  assert.equal(html.includes("SMUCT UniCompanion"), true);
  assert.equal(html.includes('href="/privacy"'), true);
  assert.equal(html.includes('href="/terms"'), true);
  assert.equal(html.includes("mailto:support@smuct.example"), true);
});

test("renderPrivacyPolicyHtml includes Google Drive scope, limited-use disclosure, and revocation link", () => {
  const html = renderPrivacyPolicyHtml("support@smuct.example");
  assert.equal(html.includes("https://www.googleapis.com/auth/drive.file"), true);
  assert.equal(html.includes("Google API Services User Data Policy"), true);
  assert.equal(html.includes("https://myaccount.google.com/permissions"), true);
  assert.equal(html.includes("AES-256-GCM"), true);
  assert.equal(html.includes("mailto:support@smuct.example"), true);
});

test("renderTermsOfServiceHtml includes Terms of Service and contact email", () => {
  const html = renderTermsOfServiceHtml("support@smuct.example");
  assert.equal(html.includes("Terms of Service"), true);
  assert.equal(html.includes("SMUCT UniCompanion"), true);
  assert.equal(html.includes("mailto:support@smuct.example"), true);
});

test("src/app.ts mounts publicPagesRoutes at root path", () => {
  const appPath = path.resolve(import.meta.dirname, "../src/app.ts");
  const source = fs.readFileSync(appPath, "utf8");
  assert.equal(source.includes("publicPagesRoutes"), true);
  assert.equal(source.includes('app.use("/", publicPagesRoutes)'), true);
});
