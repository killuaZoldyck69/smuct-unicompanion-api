import {
  createLostFoundSchema,
  updateLostFoundSchema,
  createClaimSchema,
} from "../lost-found.schema";
import { validateImageFile, MulterFile } from "../../upload/upload.service";
import { AppError } from "../../../utils/AppError";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  ❌ Assertion failed: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

async function runTests() {
  console.log("🧪 Running Lost & Found Validation & Category Tests...\n");

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

  // Test 1: All 13 categories are accepted by createLostFoundSchema
  for (const cat of validCategories) {
    const parsed = createLostFoundSchema.safeParse({
      body: {
        type: "LOST",
        title: "Found blue umbrella on 3rd floor",
        description: "Navy blue compact folding umbrella found near room 302.",
        category: cat,
        location: "Building B 3rd floor",
        images: ["https://res.cloudinary.com/demo/image/upload/sample.jpg"],
      },
    });
    if (!parsed.success) {
      console.error("Parsed error for cat", cat, (parsed as any).error);
    }
    assert(parsed.success, `Category "${cat}" is valid for post creation`);
  }

  // Test 2: Invalid category rejected
  const invalidCat = createLostFoundSchema.safeParse({
    body: {
      type: "LOST",
      title: "Found something",
      description: "Item description goes here",
      category: "FOOD_ITEM",
      location: "Campus cafe",
    },
  });
  assert(!invalidCat.success, "Invalid category FOOD_ITEM is rejected");

  // Test 3: Photos limit: exactly 2 max accepted
  const twoPhotos = createLostFoundSchema.safeParse({
    body: {
      type: "FOUND",
      title: "Student ID Card Found",
      description: "ID card found at library reception desk.",
      category: "ID_CARD",
      location: "Central Library",
      images: [
        "https://res.cloudinary.com/demo/image/upload/card_front.jpg",
        "https://res.cloudinary.com/demo/image/upload/card_back.jpg",
      ],
    },
  });
  assert(twoPhotos.success, "2 photos is valid and accepted");

  // Test 4: More than 2 photos rejected in create schema
  const threePhotos = createLostFoundSchema.safeParse({
    body: {
      type: "FOUND",
      title: "Student ID Card Found",
      description: "ID card found at library reception desk.",
      category: "ID_CARD",
      location: "Central Library",
      images: [
        "https://res.cloudinary.com/demo/image/upload/1.jpg",
        "https://res.cloudinary.com/demo/image/upload/2.jpg",
        "https://res.cloudinary.com/demo/image/upload/3.jpg",
      ],
    },
  });
  assert(!threePhotos.success, "3 photos is rejected with max 2 limit");

  // Test 5: More than 2 photos rejected in update schema
  const updateThreePhotos = updateLostFoundSchema.safeParse({
    body: {
      images: [
        "https://res.cloudinary.com/demo/image/upload/1.jpg",
        "https://res.cloudinary.com/demo/image/upload/2.jpg",
        "https://res.cloudinary.com/demo/image/upload/3.jpg",
      ],
    },
  });
  assert(!updateThreePhotos.success, "Update with 3 photos rejected");

  // Test 6: 5MB File size validation: 4.9MB accepted, 5.1MB rejected
  const validFile: MulterFile = {
    fieldname: "image",
    originalname: "item_pic.jpg",
    encoding: "7bit",
    mimetype: "image/jpeg",
    size: 4.8 * 1024 * 1024,
    buffer: Buffer.alloc(10),
  };

  try {
    validateImageFile(validFile, 5 * 1024 * 1024);
    assert(true, "Image under 5MB (4.8MB) passes file size validation");
  } catch (e: any) {
    assert(false, `Image under 5MB unexpectedly failed: ${e.message}`);
  }

  const oversizedFile: MulterFile = {
    fieldname: "image",
    originalname: "huge_pic.jpg",
    encoding: "7bit",
    mimetype: "image/jpeg",
    size: 5.2 * 1024 * 1024,
    buffer: Buffer.alloc(10),
  };

  let threwOversized = false;
  try {
    validateImageFile(oversizedFile, 5 * 1024 * 1024);
  } catch (e: any) {
    threwOversized = true;
    assert(
      e instanceof AppError && e.message.includes("5MB limit"),
      "Image over 5MB (5.2MB) is rejected with AppError 5MB limit message"
    );
  }
  assert(threwOversized, "Oversized file threw validation error");

  // Test 7: Claim with 1 proof photo accepted (including Cloudinary transformations with commas)
  const singleProofClaim = createClaimSchema.safeParse({
    body: {
      message: "This is my earbud case lost near UB 111 bench.",
      proofImage:
        "https://res.cloudinary.com/gzgfeoqn/image/upload/q_auto,f_auto,w_1000,c_limit/smuct-unicompanion/campus-hub/lost-found/claims/test_ppnmvy",
    },
  });
  assert(singleProofClaim.success, "Claim with Cloudinary transformation URL (with commas) is accepted");

  // Test 8: Claim without proof photo (null) is accepted
  const nullProofClaim = createClaimSchema.safeParse({
    body: {
      message: "This is my earbud case lost near UB 111 bench.",
      proofImage: null,
    },
  });
  assert(nullProofClaim.success, "Claim without proof photo (null) is accepted");

  // Test 9: Claim with multiple proof photos is rejected (max 1 photo limit)
  const dualProofClaim = createClaimSchema.safeParse({
    body: {
      message: "This is my earbud case, attaching invoice and serial number.",
      proofImage:
        "https://res.cloudinary.com/demo/image/upload/proof1.jpg,https://res.cloudinary.com/demo/image/upload/proof2.jpg",
    },
  });
  assert(!dualProofClaim.success, "Claim with multiple proof photos is rejected (max 1 photo limit)");

  // Test 10: Post creation with optional description, location, and images
  const optionalFieldsPost = createLostFoundSchema.safeParse({
    body: {
      type: "LOST",
      title: "Lost Black Wallet",
      category: "WALLET",
    },
  });
  assert(optionalFieldsPost.success, "Post creation without description, location, or images is accepted");

  // Test 11: Post creation with null description and location is accepted
  const nullFieldsPost = createLostFoundSchema.safeParse({
    body: {
      type: "FOUND",
      title: "Found Keys on Campus",
      description: null,
      category: "KEYS",
      location: null,
      images: [],
    },
  });
  assert(nullFieldsPost.success, "Post creation with null description/location and empty images is accepted");

  console.log("\n========================================");
  console.log("Lost & Found Unit Tests: ALL PASSED");
  console.log("========================================\n");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
