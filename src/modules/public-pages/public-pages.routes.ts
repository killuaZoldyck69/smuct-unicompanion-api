import { Router, Request, Response } from "express";
import { envConfig } from "../../config/env";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderDocumentShell(options: {
  title: string;
  description: string;
  activePath: "/" | "/privacy" | "/terms";
  supportEmail: string;
  bodyHtml: string;
}): string {
  const safeEmail = escapeHtml(options.supportEmail.trim() || "support@smuct.ac.bd");
  const navLink = (href: "/" | "/privacy" | "/terms", label: string) => {
    const isActive = options.activePath === href;
    return `<a href="${href}" class="nav-link${isActive ? " active" : ""}">${label}</a>`;
  };

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(options.title)}</title>
    <meta name="description" content="${escapeHtml(options.description)}" />
    <style>
      :root {
        --bg: #f4f7fb;
        --card: #ffffff;
        --ink: #0f172a;
        --muted: #475569;
        --line: #e2e8f0;
        --navy: #131b2e;
        --accent: #2563eb;
        --accent-soft: #eff6ff;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: var(--bg);
        color: var(--ink);
        line-height: 1.6;
      }
      header {
        background: var(--navy);
        color: #ffffff;
        padding: 18px 20px;
      }
      .wrap {
        max-width: 860px;
        margin: 0 auto;
        padding: 0 20px;
      }
      .header-inner {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .brand {
        font-size: 18px;
        font-weight: 700;
        letter-spacing: -0.01em;
        color: #ffffff;
        text-decoration: none;
      }
      .brand span {
        color: #93c5fd;
        font-weight: 500;
        font-size: 13px;
        margin-left: 8px;
      }
      nav {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .nav-link {
        color: #cbd5e1;
        text-decoration: none;
        font-size: 14px;
        font-weight: 500;
        padding: 6px 12px;
        border-radius: 999px;
      }
      .nav-link:hover { background: rgba(255,255,255,0.1); color: #ffffff; }
      .nav-link.active { background: #2563eb; color: #ffffff; }
      main { padding: 28px 0 48px; }
      .card {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 28px;
        box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
      }
      h1 {
        font-size: 28px;
        line-height: 1.25;
        margin: 0 0 10px;
        color: var(--navy);
      }
      h2 {
        font-size: 18px;
        margin: 24px 0 8px;
        color: var(--navy);
      }
      p { margin: 0 0 12px; color: var(--muted); }
      ul { margin: 0 0 14px; padding-left: 20px; color: var(--muted); }
      li { margin-bottom: 6px; }
      .badge {
        display: inline-block;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 12px;
        font-weight: 700;
        padding: 4px 10px;
        border-radius: 999px;
        margin-bottom: 12px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 14px;
        margin: 20px 0 24px;
      }
      .tile {
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 16px;
        background: #f8fafc;
      }
      .tile h3 {
        margin: 0 0 6px;
        font-size: 15px;
        color: var(--navy);
      }
      .tile p {
        margin: 0;
        font-size: 14px;
      }
      .cta-row {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 20px;
      }
      .btn {
        display: inline-block;
        padding: 10px 16px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        text-decoration: none;
        border: 1px solid var(--line);
        color: var(--navy);
        background: #ffffff;
      }
      .btn-primary {
        background: var(--navy);
        border-color: var(--navy);
        color: #ffffff;
      }
      code {
        background: #f1f5f9;
        padding: 2px 6px;
        border-radius: 6px;
        font-size: 13px;
        color: var(--navy);
      }
      footer {
        margin-top: 22px;
        font-size: 13px;
        color: #64748b;
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 8px;
      }
      footer a { color: var(--accent); text-decoration: none; }
    </style>
  </head>
  <body>
    <header>
      <div class="wrap header-inner">
        <a href="/" class="brand">SMUCT UniCompanion<span>Campus Companion App</span></a>
        <nav aria-label="Primary">
          ${navLink("/", "Home")}
          ${navLink("/privacy", "Privacy Policy")}
          ${navLink("/terms", "Terms of Service")}
        </nav>
      </div>
    </header>
    <main>
      <div class="wrap">
        <article class="card">
          ${options.bodyHtml}
        </article>
        <footer>
          <span>&copy; ${new Date().getUTCFullYear()} SMUCT UniCompanion</span>
          <span>Support: <a href="mailto:${safeEmail}">${safeEmail}</a> &middot; <a href="/privacy">Privacy Policy</a> &middot; <a href="/terms">Terms</a></span>
        </footer>
      </div>
    </main>
  </body>
</html>`;
}

export function renderHomePageHtml(supportEmail: string): string {
  const safeEmail = escapeHtml(supportEmail.trim() || "support@smuct.ac.bd");
  return renderDocumentShell({
    title: "SMUCT UniCompanion — Campus Companion App",
    description:
      "Official web portal for SMUCT UniCompanion, the academic companion app for Shanto-Mariam University of Creative Technology.",
    activePath: "/",
    supportEmail,
    bodyHtml: `
      <span class="badge">Shanto-Mariam University of Creative Technology (SMUCT)</span>
      <h1>SMUCT UniCompanion</h1>
      <p>
        SMUCT UniCompanion is the academic and campus companion platform built for SMUCT students, teachers, and staff to organize class schedules, Course Hubs, academic notices, exams, bus routes, and campus services.
      </p>
      <div class="grid">
        <div class="tile">
          <h3>Course Hubs &amp; Classwork</h3>
          <p>Access course announcements, lecture materials, assignments, and grading updates in one place.</p>
        </div>
        <div class="tile">
          <h3>Schedules &amp; Notices</h3>
          <p>Stay updated with daily class routines, room changes, exam routines, and campus alerts.</p>
        </div>
        <div class="tile">
          <h3>Optional Google Drive Sync</h3>
          <p>Teachers and students can optionally link their own Google Drive using minimal <code>drive.file</code> access to share course files and assignment submissions.</p>
        </div>
      </div>
      <h2>Privacy &amp; Support</h2>
      <p>
        Review our <a href="/privacy">Privacy Policy</a> and <a href="/terms">Terms of Service</a> to learn how account data and optional Google Drive permissions are handled. For assistance or data requests, contact <a href="mailto:${safeEmail}">${safeEmail}</a>.
      </p>
      <div class="cta-row">
        <a href="/privacy" class="btn btn-primary">Read Privacy Policy</a>
        <a href="/terms" class="btn">Read Terms of Service</a>
      </div>
    `,
  });
}

export function renderPrivacyPolicyHtml(supportEmail: string): string {
  const safeEmail = escapeHtml(supportEmail.trim() || "support@smuct.ac.bd");
  return renderDocumentShell({
    title: "Privacy Policy — SMUCT UniCompanion",
    description:
      "Privacy Policy for SMUCT UniCompanion, including Google Drive API Services User Data Policy disclosures.",
    activePath: "/privacy",
    supportEmail,
    bodyHtml: `
      <span class="badge">Last Updated: November 28, 2026</span>
      <h1>Privacy Policy</h1>
      <p>
        This Privacy Policy explains how <strong>SMUCT UniCompanion</strong> collects, uses, stores, and protects information when you use our mobile and web applications.
      </p>

      <h2>1. Account &amp; Campus Information We Collect</h2>
      <ul>
        <li><strong>Identity &amp; Profile Details:</strong> Name, university email address, role (student, teacher, or admin), student/faculty ID, department, batch/semester, and optional profile photo.</li>
        <li><strong>Academic &amp; Community Content:</strong> Course Hub materials, coursework submissions, announcements, notices, and campus forum or support entries you choose to publish.</li>
        <li><strong>Device &amp; Notification Tokens:</strong> Optional Expo push notification tokens to deliver class updates and announcement alerts.</li>
      </ul>

      <h2>2. Google Drive Integration &amp; Google User Data</h2>
      <p>
        Connecting your Google account to SMUCT UniCompanion is completely optional. When you choose to connect Google Drive for uploading course materials or coursework submissions, we request only these minimal OAuth 2.0 scopes:
      </p>
      <ul>
        <li><code>https://www.googleapis.com/auth/drive.file</code> — grants access strictly to files and the <em>SMUCT UniCompanion - Course Hub</em> folder created by this app. We cannot view, edit, or delete unrelated files in your Google Drive.</li>
        <li><code>openid</code>, <code>email</code>, and <code>profile</code> — used solely to display your connected Google account name, email, and avatar inside the app.</li>
      </ul>

      <h2>3. How We Store &amp; Protect Google Tokens</h2>
      <ul>
        <li>Your Google OAuth refresh token is encrypted at rest on our server using AES-256-GCM so you stay connected across sessions without re-authorizing every hour.</li>
        <li>Files uploaded through the app go directly from your device to your own Google Drive, and shareable metadata/links are stored in Course Hub records only when you publish them.</li>
      </ul>

      <h2>4. Google API Services User Data Policy (Limited Use)</h2>
      <p>
        SMUCT UniCompanion's use and transfer to any other app of information received from Google APIs adheres to the
        <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noopener noreferrer" target="_blank">Google API Services User Data Policy</a>,
        including the Limited Use requirements. Specifically:
      </p>
      <ul>
        <li>Google user data is used strictly to provide and improve user-facing Course Hub upload and submission features.</li>
        <li>We <strong>never</strong> sell Google user data, use it for advertising, or transfer it to third parties or AI/ML training models.</li>
      </ul>

      <h2>5. Revoking Access &amp; Account Deletion</h2>
      <ul>
        <li>You can disconnect Google Drive at any time inside SMUCT UniCompanion (which revokes and deletes your stored refresh token) or via your <a href="https://myaccount.google.com/permissions" rel="noopener noreferrer" target="_blank">Google Account Permissions</a> page.</li>
        <li>To request deletion of your SMUCT UniCompanion account or stored data, contact <a href="mailto:${safeEmail}">${safeEmail}</a>.</li>
      </ul>
    `,
  });
}

export function renderTermsOfServiceHtml(supportEmail: string): string {
  const safeEmail = escapeHtml(supportEmail.trim() || "support@smuct.ac.bd");
  return renderDocumentShell({
    title: "Terms of Service — SMUCT UniCompanion",
    description: "Terms of Service for SMUCT UniCompanion.",
    activePath: "/terms",
    supportEmail,
    bodyHtml: `
      <span class="badge">Last Updated: November 28, 2026</span>
      <h1>Terms of Service</h1>
      <p>
        By accessing or using <strong>SMUCT UniCompanion</strong>, you agree to comply with these Terms of Service and applicable campus academic policies.
      </p>

      <h2>1. Eligibility &amp; Accounts</h2>
      <p>
        SMUCT UniCompanion is intended for students, faculty, and authorized staff of Shanto-Mariam University of Creative Technology. You are responsible for safeguarding your login credentials and providing accurate profile details.
      </p>

      <h2>2. Acceptable Academic &amp; Community Conduct</h2>
      <ul>
        <li>Do not upload unlawful, abusive, infringing, or harmful material to Course Hubs, forums, or community boards.</li>
        <li>Respect academic integrity when submitting coursework and using shared instructional resources.</li>
      </ul>

      <h2>3. Optional Google Drive Uploads</h2>
      <p>
        When you connect Google Drive, files you upload remain stored in your own Google Drive account. You are responsible for ensuring you have the right to share any material published to a Course Hub. You may revoke access at any time.
      </p>

      <h2>4. Service Availability &amp; Suspension</h2>
      <p>
        We aim to keep campus features reliable, though schedules or notices may occasionally be updated or unavailable during maintenance. Accounts violating campus guidelines or security rules may be suspended or removed.
      </p>

      <h2>5. Contact</h2>
      <p>
        For questions about these Terms of Service, contact <a href="mailto:${safeEmail}">${safeEmail}</a>.
      </p>
    `,
  });
}

function sendHtmlPage(res: Response, html: string): void {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(200).send(html);
}

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  sendHtmlPage(res, renderHomePageHtml(envConfig.EMAIL_FROM));
});

router.get("/privacy", (_req: Request, res: Response) => {
  sendHtmlPage(res, renderPrivacyPolicyHtml(envConfig.EMAIL_FROM));
});

router.get("/terms", (_req: Request, res: Response) => {
  sendHtmlPage(res, renderTermsOfServiceHtml(envConfig.EMAIL_FROM));
});

export const publicPagesRoutes = router;
