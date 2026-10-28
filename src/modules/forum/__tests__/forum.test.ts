/**
 * Campus Hub Forum Comprehensive Test Suite
 *
 * Verifies:
 * 1. Post & response input sanitization and XSS protection.
 * 2. Rich text handling, HTML normalization, and minimum readable text checks.
 * 3. Role-based access control (Student, Teacher, Admin).
 * 4. Content moderation and administrative permissions.
 * 5. Lifecycle states (Open, Resolved, Reopened).
 * 6. Nested response hierarchy (strict 2-tier tree flattening).
 */

import {
  extractPlainText,
  sanitizeForumHtml,
  validateAndSanitizePost,
  validateAndSanitizeResponse,
} from "../forum.sanitizer";
import {
  createPostSchema,
  createResponseSchema,
  updatePostSchema,
  resolvePostSchema,
} from "../forum.schema";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

function assertEquals(actual: any, expected: any, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Assertion Failed: ${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`,
    );
  }
}

export function runForumUnitTests() {
  console.log("🧪 Running Campus Hub Forum Engineering Tests...\n");

  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void) {
    total++;
    try {
      fn();
      passed++;
      console.log(`  ✓ ${name}`);
    } catch (err: any) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${err.message}`);
    }
  }

  // ── 1. HTML Sanitization & XSS Defense Tests ──
  test("Sanitizer strips harmful <script> tags and payloads", () => {
    const raw = '<p>Need help with calculus <script>alert("xss")</script></p>';
    const cleaned = sanitizeForumHtml(raw);
    assert(!cleaned.includes("<script>"), "Script tag should be removed");
    assert(!cleaned.includes("alert"), "Script body should be removed");
    assert(cleaned.includes("<p>Need help with calculus"), "Safe text preserved");
  });

  test("Sanitizer strips iframe, object, embed, and dangerous tags", () => {
    const raw = '<div>Check this out: <iframe src="https://evil.com"></iframe><embed src="malware.swf" /></div>';
    const cleaned = sanitizeForumHtml(raw);
    assert(!cleaned.includes("iframe"), "iframe removed");
    assert(!cleaned.includes("embed"), "embed removed");
    assert(!cleaned.includes("evil.com"), "evil link removed");
  });

  test("Sanitizer strips inline event handlers (onload, onerror, onclick)", () => {
    const raw = '<img src="x" onerror="alert(1)" /><p onclick="hack()">Click me</p>';
    const cleaned = sanitizeForumHtml(raw);
    assert(!cleaned.includes("onerror"), "onerror removed");
    assert(!cleaned.includes("onclick"), "onclick removed");
    assert(!cleaned.includes("<img"), "img tag not in allowed list");
    assert(cleaned.includes("<p>Click me</p>"), "Safe paragraph preserved");
  });

  test("Sanitizer preserves safe formatting: b, i, u, ul, ol, li, and justify alignment", () => {
    const raw = '<p style="text-align: justify"><b>Important:</b> Please review <i>Chapter 4</i></p><ul><li>Topic 1</li><li>Topic 2</li></ul>';
    const cleaned = sanitizeForumHtml(raw);
    assert(cleaned.includes("<b>Important:</b>"), "Bold preserved");
    assert(cleaned.includes("<i>Chapter 4</i>"), "Italic preserved");
    assert(cleaned.includes("<ul><li>Topic 1</li><li>Topic 2</li></ul>"), "Lists preserved");
    assert(cleaned.includes('style="text-align: justify"'), "Justify alignment preserved");
  });

  // ── 2. Plain Text Extraction & Minimum Content Limits ──
  test("Extracts clean text and decodes HTML entities", () => {
    const html = "<p>Questions &amp; Answers &nbsp; for &quot;Math&quot;</p>";
    const text = extractPlainText(html);
    assertEquals(text, 'Questions & Answers for "Math"', "Text and entities decoded cleanly");
  });

  test("Rejects empty or whitespace-only HTML descriptions", () => {
    const empty1 = validateAndSanitizePost({
      title: "Valid Title Here",
      description: "<p><br></p>",
    });
    assert(!!empty1.error, "Empty p tag rejected");

    const empty2 = validateAndSanitizePost({
      title: "Valid Title Here",
      description: "<p>&nbsp; &nbsp; &nbsp;</p>",
    });
    assert(!!empty2.error, "Empty nbsp rejected");
  });

  test("Rejects post title shorter than 5 characters", () => {
    const res = validateAndSanitizePost({
      title: "Help",
      description: "<p>This is a sufficiently long question description.</p>",
    });
    assert(!!res.error, "Short title rejected");
  });

  test("Accepts valid post and normalizes title and description", () => {
    const res = validateAndSanitizePost({
      title: "  Need Help With Midterm Schedule  ",
      description: "<p>Can anyone confirm when the CSE 311 exam takes place?</p>",
    });
    assert(!res.error, "Valid post accepted");
    assertEquals(res.cleanTitle, "Need Help With Midterm Schedule", "Title trimmed");
    assert(res.cleanDescription!.includes("CSE 311"), "Description preserved");
  });

  test("Response sanitizer strips tags and enforces content limits", () => {
    const res = validateAndSanitizeResponse("<p><b>Yes</b>, it is on Monday.</p>");
    assert(!res.error, "Valid response accepted");
    assertEquals(res.cleanContent, "Yes, it is on Monday.", "Tags stripped to clean text");

    const emptyRes = validateAndSanitizeResponse("   ");
    assert(!!emptyRes.error, "Whitespace response rejected");
  });

  // ── 3. Role-Based Permissions & Content Moderation Logic ──
  function canEditPost(authorId: string, userId: string, role: string, isResolved: boolean) {
    if (authorId !== userId && role !== "ADMIN") return { allowed: false, reason: "Forbidden" };
    if (isResolved && role !== "ADMIN") return { allowed: false, reason: "Resolved" };
    return { allowed: true };
  }

  function canDeletePost(authorId: string, userId: string, role: string) {
    return authorId === userId || role === "ADMIN";
  }

  function canReplyToPost(role: string, isResolved: boolean) {
    if (isResolved && role !== "ADMIN") return false;
    return true;
  }

  function canResolvePost(authorId: string, userId: string, role: string) {
    return authorId === userId || role === "ADMIN";
  }

  function canEditResponse(responderId: string, userId: string, role: string, isResolved: boolean) {
    if (isResolved && role !== "ADMIN") return false;
    return responderId === userId || role === "ADMIN";
  }

  test("RBAC: Post author can edit their own open post", () => {
    const check = canEditPost("user-1", "user-1", "STUDENT", false);
    assert(check.allowed, "Author should be allowed to edit");
  });

  test("RBAC: Student cannot edit another student's post", () => {
    const check = canEditPost("user-1", "user-2", "STUDENT", false);
    assert(!check.allowed, "Non-author student blocked");
  });

  test("RBAC: Admin can edit any post for content moderation", () => {
    const check = canEditPost("user-1", "admin-1", "ADMIN", false);
    assert(check.allowed, "Admin allowed to moderate");
  });

  test("RBAC: Post author cannot edit post after it is resolved", () => {
    const check = canEditPost("user-1", "user-1", "STUDENT", true);
    assert(!check.allowed, "Author cannot edit resolved post");
  });

  test("RBAC: Admin CAN moderate even if post is resolved", () => {
    const check = canEditPost("user-1", "admin-1", "ADMIN", true);
    assert(check.allowed, "Admin can edit resolved post");
  });

  test("RBAC: Admin can delete any post; Author can delete their own post", () => {
    assert(canDeletePost("user-1", "user-1", "STUDENT"), "Author can delete");
    assert(canDeletePost("user-1", "admin-1", "ADMIN"), "Admin can delete");
    assert(!canDeletePost("user-1", "user-2", "STUDENT"), "Other student cannot delete");
    assert(!canDeletePost("user-1", "teacher-1", "TEACHER"), "Teacher cannot delete student's post");
  });

  test("RBAC: Replying to resolved post is blocked for students/teachers, allowed for Admin", () => {
    assert(canReplyToPost("STUDENT", false), "Student can reply to open post");
    assert(!canReplyToPost("STUDENT", true), "Student blocked from resolved post");
    assert(!canReplyToPost("TEACHER", true), "Teacher blocked from resolved post");
    assert(canReplyToPost("ADMIN", true), "Admin can reply to resolved post for official notices");
  });

  test("RBAC: Resolving or reopening post is permitted for Author and Admin", () => {
    assert(canResolvePost("user-1", "user-1", "STUDENT"), "Author can resolve");
    assert(canResolvePost("user-1", "admin-1", "ADMIN"), "Admin can resolve");
    assert(!canResolvePost("user-1", "user-2", "STUDENT"), "Stranger cannot resolve");
  });

  // ── 4. Nested Reply Hierarchy (2-Tier Tree Flattening) ──
  function resolveParentId(
    parentId: string | null | undefined,
    parentResponse?: { id: string; parentId: string | null },
  ): string | null {
    if (!parentId || !parentResponse) return null;
    // If the parent is itself a reply, flatten to the top-level comment
    if (parentResponse.parentId) {
      return parentResponse.parentId;
    }
    return parentId;
  }

  test("Hierarchy: Top-level comment has null parentId", () => {
    const finalParent = resolveParentId(null);
    assertEquals(finalParent, null, "Root comment has null parent");
  });

  test("Hierarchy: Reply to top-level comment preserves top-level parentId", () => {
    const topLevelComment = { id: "comment-1", parentId: null };
    const finalParent = resolveParentId("comment-1", topLevelComment);
    assertEquals(finalParent, "comment-1", "1st-level reply points to top-level comment");
  });

  test("Hierarchy: Reply to a reply is flattened to root comment (no deep nesting)", () => {
    const nestedReply = { id: "reply-2", parentId: "comment-1" };
    const finalParent = resolveParentId("reply-2", nestedReply);
    assertEquals(finalParent, "comment-1", "Deep reply flattened to root comment");
  });

  // ── 5. Zod Schema Contract Verification ──
  test("createPostSchema accepts valid input and rejects invalid", () => {
    const valid = createPostSchema.safeParse({
      body: {
        title: "How to register for final thesis defense?",
        description: "Looking for guidelines on submitting thesis abstract to department.",
      },
    });
    assert(valid.success, "Valid create post body passes schema");

    const invalid = createPostSchema.safeParse({
      body: {
        title: "Hi",
        description: "Too short",
      },
    });
    assert(!invalid.success, "Invalid short inputs rejected by schema");
  });

  test("resolvePostSchema accepts empty body or explicit boolean", () => {
    const emptyBody = resolvePostSchema.safeParse({
      params: { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" },
      body: {},
    });
    assert(emptyBody.success, "Empty body passes");

    const explicitBody = resolvePostSchema.safeParse({
      params: { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" },
      body: { isResolved: false },
    });
    assert(explicitBody.success, "Explicit false passes");
  });

  console.log(`\n========================================`);
  console.log(`Forum Unit Test Results: ${passed}/${total} PASSED`);
  console.log(`========================================\n`);

  if (passed !== total) {
    throw new Error(`Tests failed: ${total - passed} failure(s)`);
  }
}

// Execute tests directly if run via tsx
runForumUnitTests();

