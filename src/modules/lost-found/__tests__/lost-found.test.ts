import {
  createLostFoundSchema,
  updateLostFoundSchema,
  createClaimSchema,
  getFeedQuerySchema,
  updateLostFoundStatusSchema,
  lostFoundIdParamSchema,
  lostFoundClaimParamSchema,
  createLostFoundReportSchema,
} from "../lost-found.schema";
import {
  buildLostFoundUpdateData,
  isLostFoundPostVisibleToViewer,
  sanitizeLostFoundPostDetail,
} from "../lost-found.domain";
import { publicAuthorSelection } from "../lost-found.projections";
import { isAllowedAppCloudinaryImageUrl } from "../../../lib/cloudinary";
import { envConfig } from "../../../config/env";
import { validateImageFile, MulterFile } from "../../upload/upload.service";
import { AppError } from "../../../utils/AppError";
import { escapeHtml } from "../../../utils/html";
import { LostFoundStatus, LostFoundType } from "../../../constants/enums";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  ❌ Assertion failed: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

const VALID_POST_ID = "11111111-1111-4111-8111-111111111111";
const VALID_CLAIM_ID = "22222222-2222-4222-8222-222222222222";
const CLOUD_NAME =
  envConfig.CLOUDINARY_CLOUD_NAME ||
  process.env.CLOUDINARY_CLOUD_NAME ||
  "demo";

const lfUrl = (name: string) =>
  `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/q_auto,f_auto,w_1000,c_limit/smuct-unicompanion/campus-hub/lost-found/${name}`;

const lfClaimUrl = (name: string) =>
  `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/q_auto,f_auto,w_1000,c_limit/smuct-unicompanion/campus-hub/lost-found/claims/${name}`;

async function runTests() {
  console.log(
    "🧪 Running Lost & Found Validation, Domain & Security Tests...\n",
  );

  const validCategories = [
    "ID_CARD",
    "ELECTRONICS",
    "KEYS",
    "WALLET",
    "BAGS",
    "BOOKS",
    "DOCUMENTS",
    "ACCESSORIES",
    "CLOTHING",
    "STATIONERY",
    "UMBRELLA",
    "BOTTLE",
    "OTHER",
  ];

  // Test 1: All 13 categories accepted by createLostFoundSchema with verified Cloudinary URL
  for (const cat of validCategories) {
    const parsed = createLostFoundSchema.safeParse({
      body: {
        type: "LOST",
        title: "Found blue umbrella on 3rd floor",
        description: "Navy blue compact folding umbrella found near room 302.",
        category: cat,
        location: "Building B 3rd floor",
        images: [lfUrl("sample.jpg")],
      },
    });
    assert(parsed.success, `Category "${cat}" is valid for post creation`);
  }

  // Test 2: Invalid category & whitespace-only title rejected
  const invalidCat = createLostFoundSchema.safeParse({
    body: {
      type: "LOST",
      title: "Found something",
      category: "FOOD_ITEM",
    },
  });
  assert(!invalidCat.success, "Invalid category FOOD_ITEM is rejected");

  const blankTitle = createLostFoundSchema.safeParse({
    body: {
      type: "LOST",
      title: "   ",
      category: "OTHER",
    },
  });
  assert(!blankTitle.success, "Whitespace-only title is rejected after trim()");

  // Test 3: Photos limit: 2 accepted, 3 rejected
  const twoPhotos = createLostFoundSchema.safeParse({
    body: {
      type: "FOUND",
      title: "Student ID Card Found",
      description: "ID card found at library reception desk.",
      category: "ID_CARD",
      location: "Central Library",
      images: [lfUrl("card_front.jpg"), lfUrl("card_back.jpg")],
    },
  });
  assert(twoPhotos.success, "2 verified photos is valid and accepted");

  const threePhotos = createLostFoundSchema.safeParse({
    body: {
      type: "FOUND",
      title: "Student ID Card Found",
      category: "ID_CARD",
      images: [lfUrl("1.jpg"), lfUrl("2.jpg"), lfUrl("3.jpg")],
    },
  });
  assert(!threePhotos.success, "3 photos is rejected with max 2 limit");

  const updateThreePhotos = updateLostFoundSchema.safeParse({
    params: { id: VALID_POST_ID },
    body: {
      images: [lfUrl("1.jpg"), lfUrl("2.jpg"), lfUrl("3.jpg")],
    },
  });
  assert(!updateThreePhotos.success, "Update with 3 photos rejected");

  // Test 4: API-1 Image URL hardening rejects external / wrong-folder / path-traversal / HTTP URLs
  assert(
    !isAllowedAppCloudinaryImageUrl("https://evil.example.com/payload.jpg", [
      "smuct-unicompanion/campus-hub/lost-found",
    ]),
    "Arbitrary external host URL is rejected",
  );
  assert(
    !isAllowedAppCloudinaryImageUrl(
      `http://res.cloudinary.com/${CLOUD_NAME}/image/upload/smuct-unicompanion/campus-hub/lost-found/a.jpg`,
      ["smuct-unicompanion/campus-hub/lost-found"],
    ),
    "Insecure http:// Cloudinary URL is rejected",
  );
  assert(
    !isAllowedAppCloudinaryImageUrl(
      `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/smuct-unicompanion/notices/a.jpg`,
      ["smuct-unicompanion/campus-hub/lost-found"],
    ),
    "Cloudinary URL outside lost-found folder namespace is rejected",
  );
  assert(
    !isAllowedAppCloudinaryImageUrl(
      `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/smuct-unicompanion/campus-hub/lost-found/../notices/a.jpg`,
      ["smuct-unicompanion/campus-hub/lost-found"],
    ),
    "Path traversal inside Cloudinary URL is rejected",
  );

  // Test 5: UUID param validation (API-16)
  assert(
    !lostFoundIdParamSchema.safeParse({ params: { id: "not-a-uuid" } }).success,
    "Invalid post UUID param is rejected",
  );
  assert(
    lostFoundIdParamSchema.safeParse({ params: { id: VALID_POST_ID } }).success,
    "Valid post UUID param is accepted",
  );
  assert(
    !lostFoundClaimParamSchema.safeParse({
      params: { id: VALID_POST_ID, claimId: "bad-claim-id" },
    }).success,
    "Invalid claim UUID param is rejected",
  );

  // Test 6: 5MB File size validation & magic-byte verification
  const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0]);
  const validFile: MulterFile = {
    fieldname: "image",
    originalname: "item_pic.jpg",
    encoding: "7bit",
    mimetype: "image/jpeg",
    size: 4.8 * 1024 * 1024,
    buffer: jpegHeader,
  };
  validateImageFile(validFile, 5 * 1024 * 1024);
  assert(
    true,
    "Image under 5MB (4.8MB) with valid JPEG header passes validation",
  );

  const spoofedFile: MulterFile = {
    fieldname: "image",
    originalname: "payload.jpg",
    encoding: "7bit",
    mimetype: "image/jpeg",
    size: 64,
    buffer: Buffer.from("<script>alert(1)</script>"),
  };
  let threwSpoofed = false;
  try {
    validateImageFile(spoofedFile, 5 * 1024 * 1024);
  } catch (e: any) {
    threwSpoofed = e instanceof AppError && e.statusCode === 400;
  }
  assert(
    threwSpoofed,
    "Spoofed non-image payload with image/jpeg MIME is rejected",
  );

  const oversizedFile: MulterFile = {
    fieldname: "image",
    originalname: "huge_pic.jpg",
    encoding: "7bit",
    mimetype: "image/jpeg",
    size: 5.2 * 1024 * 1024,
    buffer: jpegHeader,
  };
  let threwOversized = false;
  try {
    validateImageFile(oversizedFile, 5 * 1024 * 1024);
  } catch (e: any) {
    threwOversized = true;
    assert(
      e instanceof AppError && e.message.includes("5MB limit"),
      "Image over 5MB (5.2MB) is rejected with AppError 5MB limit message",
    );
  }
  assert(threwOversized, "Oversized file threw validation error");

  // Test 7: Claim schema (verified proof photo, dual proof rejected, null allowed)
  const singleProofClaim = createClaimSchema.safeParse({
    params: { id: VALID_POST_ID },
    body: {
      message: "This is my earbud case lost near UB 111 bench.",
      proofImage: lfClaimUrl("test_ppnmvy"),
    },
  });
  assert(
    singleProofClaim.success,
    "Claim with verified Cloudinary proof transformation URL is accepted",
  );

  const nullProofClaim = createClaimSchema.safeParse({
    params: { id: VALID_POST_ID },
    body: {
      message: "This is my earbud case lost near UB 111 bench.",
      proofImage: null,
    },
  });
  assert(
    nullProofClaim.success,
    "Claim without proof photo (null) is accepted",
  );

  const dualProofClaim = createClaimSchema.safeParse({
    params: { id: VALID_POST_ID },
    body: {
      message: "This is my earbud case, attaching invoice and serial number.",
      proofImage: `${lfClaimUrl("proof1.jpg")},${lfClaimUrl("proof2.jpg")}`,
    },
  });
  assert(
    !dualProofClaim.success,
    "Claim with multiple proof photos is rejected",
  );

  // Test 8: Feed query & status schema checks
  assert(
    getFeedQuerySchema.safeParse({
      query: {
        type: "LOST",
        status: "ACTIVE",
        category: "ELECTRONICS",
        search: "  MacBook  ",
        page: "1",
        limit: "10",
        myPosts: "true",
      },
    }).success,
    "Valid feed query parameters are accepted",
  );
  assert(
    !getFeedQuerySchema.safeParse({ query: { status: "NON_EXISTENT_STATUS" } })
      .success,
    "Invalid feed query status is rejected",
  );
  assert(
    updateLostFoundStatusSchema.safeParse({
      params: { id: VALID_POST_ID },
      body: { status: "CLOSED" },
    }).success,
    "Status transition to CLOSED is accepted",
  );
  assert(
    !updateLostFoundStatusSchema.safeParse({
      params: { id: VALID_POST_ID },
      body: { status: "CLAIMED" },
    }).success,
    "Direct transition to CLAIMED status is rejected",
  );

  // Test 9: Report schema
  assert(
    createLostFoundReportSchema.safeParse({
      params: { id: VALID_POST_ID },
      body: { reason: "SPAM", details: "Repeated promotional spam listing" },
    }).success,
    "Valid Lost & Found UGC report payload is accepted",
  );

  // Test 10: Admin edit preserves finder verificationAnswer; type=LOST clears Q&A
  const adminEditPayload = buildLostFoundUpdateData(
    {
      title: "Cleaned up title",
      verificationQuestion: "Admin tampered Q",
      verificationAnswer: null,
    },
    LostFoundType.FOUND,
    false,
  );
  assert(
    !("verificationAnswer" in adminEditPayload) &&
      !("verificationQuestion" in adminEditPayload),
    "Non-author admin edit preserves finder verificationQuestion & verificationAnswer",
  );

  const authorSwitchToLost = buildLostFoundUpdateData(
    { type: LostFoundType.LOST },
    LostFoundType.FOUND,
    true,
  );
  assert(
    authorSwitchToLost.verificationAnswer === null &&
      authorSwitchToLost.verificationQuestion === null,
    "Switching listing type to LOST clears verification Q&A",
  );

  // Test 11: Public author projection excludes studentId & private contacts
  assert(
    !("studentId" in (publicAuthorSelection.studentProfile.select as object)) &&
      !("email" in (publicAuthorSelection as object)) &&
      !("phoneNumber" in (publicAuthorSelection as object)),
    "Public author projection strips studentId, email, and phoneNumber",
  );

  // Test 12: Detail sanitization & handover redaction across RESOLVED -> ACTIVE reopen
  const mockPost = {
    id: VALID_POST_ID,
    authorId: "author-1",
    status: LostFoundStatus.ACTIVE,
    resolvedClaimId: null,
    verificationAnswer: "secret-sticker",
    author: {
      id: "author-1",
      name: "Finder",
      email: "finder@smuct.edu.bd",
      phoneNumber: "+8801700000001",
      image: "",
      studentProfile: null,
      teacherProfile: null,
    },
    claims: [
      {
        id: VALID_CLAIM_ID,
        claimantId: "claimant-1",
        status: "ACCEPTED",
        claimant: {
          id: "claimant-1",
          name: "Claimant",
          email: "claimant@smuct.edu.bd",
          phoneNumber: "+8801700000002",
          image: "",
          studentProfile: null,
          teacherProfile: null,
        },
      },
    ],
  };

  const reopenedViewForClaimant = sanitizeLostFoundPostDetail({
    post: mockPost,
    viewerId: "claimant-1",
    viewerRole: "STUDENT",
    myClaim: null,
  });
  assert(
    reopenedViewForClaimant.handoverData === null &&
      !("email" in reopenedViewForClaimant.author) &&
      !("verificationAnswer" in reopenedViewForClaimant),
    "Reopened ACTIVE post revokes prior accepted claimant handover & contact access",
  );

  const resolvedViewForClaimant = sanitizeLostFoundPostDetail({
    post: {
      ...mockPost,
      status: LostFoundStatus.RESOLVED,
      resolvedClaimId: VALID_CLAIM_ID,
    },
    viewerId: "claimant-1",
    viewerRole: "STUDENT",
    myClaim: null,
  });
  assert(
    resolvedViewForClaimant.handoverData?.role === "CLAIMANT" &&
      resolvedViewForClaimant.handoverData.counterpart.email ===
        "finder@smuct.edu.bd",
    "RESOLVED post with matching resolvedClaimId exposes handover counterpart",
  );

  // Test 13: UGC visibility & HTML escaping
  assert(
    !isLostFoundPostVisibleToViewer(
      { id: VALID_POST_ID, authorId: "author-1", isHiddenByModeration: false },
      { userId: "viewer-1", reportedPostIds: new Set([VALID_POST_ID]) },
    ),
    "Listing reported by viewer is hidden from viewer",
  );
  assert(
    escapeHtml('<script>alert("x")</script>') ===
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    "escapeHtml neutralizes HTML injection characters",
  );

  console.log("\n========================================");
  console.log("Lost & Found Unit Tests: ALL PASSED");
  console.log("========================================\n");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
