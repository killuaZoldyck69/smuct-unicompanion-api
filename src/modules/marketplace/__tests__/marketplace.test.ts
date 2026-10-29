import assert from "node:assert";
import {
  createMarketplaceSchema,
  updateMarketplaceSchema,
} from "../marketplace.schema";
import { MARKETPLACE_CATEGORY_VALUES } from "../../../constants/enums";

console.log("🧪 Running Marketplace Validation & Category Tests...\n");

// 1. Test all 13 categories
const expectedCategories = [
  "TEXTBOOKS",
  "ELECTRONICS",
  "CALCULATORS",
  "COMPUTERS_ACCESSORIES",
  "LAB_DRAWING_TOOLS",
  "STATIONERY",
  "CYCLES_VEHICLES",
  "ROOM_HOSTEL_ESSENTIALS",
  "FURNITURE",
  "SPORTS_FITNESS",
  "CLOTHING",
  "MOBILE_ACCESSORIES",
  "OTHER",
];

for (const cat of expectedCategories) {
  assert(
    MARKETPLACE_CATEGORY_VALUES.includes(cat as any),
    `Category ${cat} should be in MARKETPLACE_CATEGORY_VALUES`
  );

  const res = createMarketplaceSchema.safeParse({
    body: {
      type: "SELLING",
      title: "Test Item Title",
      description: "### Item details\n• Good condition",
      price: 1500,
      category: cat,
      contactPhone: "+8801956014045",
      images: [],
    },
  });

  assert(
    res.success,
    `Category "${cat}" should pass schema validation: ${JSON.stringify(res.error?.issues)}`
  );
  console.log(`  ✓ Category "${cat}" is valid for marketplace listing`);
}

// 2. Reject invalid category
const invalidCatRes = createMarketplaceSchema.safeParse({
  body: {
    type: "SELLING",
    title: "Test Item",
    description: "Valid description",
    price: 1500,
    category: "INVALID_CAT",
    contactPhone: "+8801956014045",
  },
});
assert(!invalidCatRes.success, "Invalid category should be rejected");
console.log("  ✓ Invalid category is rejected");

// 3. Price validation: strictly non-negative number in BDT
const negativePriceRes = createMarketplaceSchema.safeParse({
  body: {
    type: "SELLING",
    title: "Test Item",
    description: "Valid description",
    price: -100,
    category: "TEXTBOOKS",
    contactPhone: "+8801956014045",
  },
});
assert(!negativePriceRes.success, "Negative price should be rejected");
console.log("  ✓ Negative price is rejected");

const missingPriceRes = createMarketplaceSchema.safeParse({
  body: {
    type: "SELLING",
    title: "Test Item",
    description: "Valid description",
    category: "TEXTBOOKS",
    contactPhone: "+8801956014045",
  },
});
assert(missingPriceRes.success, "Missing price should be accepted and default to 0");
assert(missingPriceRes.data.body.price === 0, "Price should default to 0");
console.log("  ✓ Missing price is optional and defaults to 0");

// 4. Phone validation: strictly mandatory 14-char BD number (+8801956014045)
const missingPhoneRes = createMarketplaceSchema.safeParse({
  body: {
    type: "SELLING",
    title: "Test Item",
    description: "Valid description",
    category: "TEXTBOOKS",
  },
});
assert(!missingPhoneRes.success, "Missing phone should be rejected (contactPhone is mandatory)");
console.log("  ✓ Missing phone is rejected (contactPhone is strictly mandatory)");

// 4. Phone validation: mandatory 14-char BD number (+8801956014045)
const validPhoneNumbers = [
  "+8801956014045",
  "+8801712345678",
  "+8801812345678",
  "+8801312345678",
  "+8801412345678",
  "+8801512345678",
  "+8801612345678",
];

for (const phone of validPhoneNumbers) {
  const phoneRes = createMarketplaceSchema.safeParse({
    body: {
      type: "SELLING",
      title: "Test Item",
      description: "Valid description",
      price: 500,
      category: "TEXTBOOKS",
      contactPhone: phone,
    },
  });
  assert(phoneRes.success, `Phone "${phone}" should be valid`);
}
console.log("  ✓ All standard Bangladeshi operator phone numbers (+8801[3-9]...) are accepted");

const invalidPhones = [
  "", // empty
  "01956014045", // missing +880 prefix (only 11 chars)
  "+880123456789", // operator digit 2 is invalid in BD
  "+880195601404", // only 13 chars
  "+88019560140455", // 15 chars
  "01712345678901", // not starting with +880
];

for (const phone of invalidPhones) {
  const invalidRes = createMarketplaceSchema.safeParse({
    body: {
      type: "SELLING",
      title: "Test Item",
      description: "Valid description",
      price: 500,
      category: "TEXTBOOKS",
      contactPhone: phone,
    },
  });
  assert(!invalidRes.success, `Invalid phone "${phone}" should be rejected`);
}
console.log("  ✓ Invalid phone numbers (wrong length, missing +880, invalid operator) are rejected");

// 5. Photos limit: max 4 photos
const fourImagesRes = createMarketplaceSchema.safeParse({
  body: {
    type: "SELLING",
    title: "Test Item",
    description: "Valid description",
    price: 500,
    category: "TEXTBOOKS",
    contactPhone: "+8801956014045",
    images: [
      "https://res.cloudinary.com/demo/image/upload/sample1.jpg",
      "https://res.cloudinary.com/demo/image/upload/sample2.jpg",
      "https://res.cloudinary.com/demo/image/upload/sample3.jpg",
      "https://res.cloudinary.com/demo/image/upload/sample4.jpg",
    ],
  },
});
assert(fourImagesRes.success, "4 photos should be accepted");
console.log("  ✓ 4 photos is valid and accepted");

const fiveImagesRes = createMarketplaceSchema.safeParse({
  body: {
    type: "SELLING",
    title: "Test Item",
    description: "Valid description",
    price: 500,
    category: "TEXTBOOKS",
    contactPhone: "+8801956014045",
    images: [
      "https://res.cloudinary.com/demo/image/upload/sample1.jpg",
      "https://res.cloudinary.com/demo/image/upload/sample2.jpg",
      "https://res.cloudinary.com/demo/image/upload/sample3.jpg",
      "https://res.cloudinary.com/demo/image/upload/sample4.jpg",
      "https://res.cloudinary.com/demo/image/upload/sample5.jpg",
    ],
  },
});
assert(!fiveImagesRes.success, "5 photos should be rejected (max 4)");
console.log("  ✓ 5 photos is rejected with max 4 limit");

// 6. Update schema validation
const updateRes = updateMarketplaceSchema.safeParse({
  body: {
    price: 2000,
    category: "CALCULATORS",
    contactPhone: "+8801956014045",
  },
});
assert(updateRes.success, "Valid partial update should be accepted");
console.log("  ✓ Partial update with new category and price accepted");

// 7. Whitespace trimming & minimum length validation
const whitespaceTitleRes = createMarketplaceSchema.safeParse({
  body: {
    type: "SELLING",
    title: "   ",
    description: "Valid description",
    price: 500,
    category: "TEXTBOOKS",
    contactPhone: "+8801956014045",
  },
});
assert(!whitespaceTitleRes.success, "Whitespace-only title should be rejected");
console.log("  ✓ Whitespace-only title is rejected");

const whitespaceDescRes = createMarketplaceSchema.safeParse({
  body: {
    type: "SELLING",
    title: "Valid Title",
    description: "   \n\t  ",
    price: 500,
    category: "TEXTBOOKS",
    contactPhone: "+8801956014045",
  },
});
assert(!whitespaceDescRes.success, "Whitespace-only description should be rejected");
console.log("  ✓ Whitespace-only description is rejected");

// 8. Optional images validation (listings without photos)
const withoutImagesRes = createMarketplaceSchema.safeParse({
  body: {
    type: "BUYING",
    title: "Looking for Calculus Book",
    description: "Need Thomas Calculus 14th edition",
    price: 300,
    category: "TEXTBOOKS",
    contactPhone: "+8801956014045",
  },
});
assert(withoutImagesRes.success, "Listing without images field should be accepted");
assert(Array.isArray(withoutImagesRes.data.body.images), "images should default to an empty array");
console.log("  ✓ Listing without images is accepted and defaults to empty array");

console.log("\n========================================");
console.log("Marketplace Unit Tests: ALL PASSED");
console.log("========================================\n");

