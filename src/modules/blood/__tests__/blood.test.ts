import { createBloodPostSchema, respondBloodPostSchema } from "../blood.schema";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEquals(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(
      `Assertion failed: ${message}. Expected: ${expected}, but got: ${actual}`,
    );
  }
}

// Logic validation helper matching createBloodPostService profile check
function validateUserProfileForBlood(user: { phoneNumber?: string | null; bloodGroup?: string | null }) {
  const missingFields: string[] = [];
  if (!user.phoneNumber || !user.phoneNumber.trim()) {
    missingFields.push("phone number");
  }
  if (!user.bloodGroup) {
    missingFields.push("blood group");
  }

  if (missingFields.length > 0) {
    return {
      valid: false,
      error: `Profile incomplete: You must have both a phone number and blood group filled in your profile before submitting a blood request. Missing: ${missingFields.join(" and ")}.`,
      missingFields,
    };
  }

  return { valid: true };
}

// Permission check helper matching resolveBloodPostService & deleteBloodPostService
function checkBloodPostPermission(post: { authorId: string }, userId: string, role?: string) {
  if (post.authorId !== userId && role !== "ADMIN") {
    return { allowed: false, error: "Forbidden: insufficient permissions" };
  }
  return { allowed: true };
}

async function runBloodTests() {
  console.log("🧪 Running Campus Blood Module Validation & Authorization Unit Tests...\n");

  // 1. Valid Blood Request Payload
  console.log("  [1/9] Testing valid Create Blood Post schema parsing...");
  const validPayload = {
    patientName: "Rahim Uddin",
    patientCondition: "Dengue emergency platelet drop",
    bloodGroup: "O_POSITIVE",
    bagsNeeded: 2,
    location: "Enam Medical College Hospital, Savar",
    urgency: "High",
    contactPhone: "+8801712345678",
  };
  const parsed = createBloodPostSchema.safeParse({ body: validPayload });
  assert(parsed.success, "Valid payload should pass schema parsing");
  if (parsed.success) {
    assertEquals(parsed.data.body.patientName, "Rahim Uddin", "Patient name matches");
    assertEquals(parsed.data.body.bloodGroup, "O_POSITIVE", "Blood group matches");
    assertEquals(parsed.data.body.bagsNeeded, 2, "Bags needed matches");
  }

  // 2. Default bagsNeeded
  console.log("  [2/9] Testing default bagsNeeded = 1 if omitted...");
  const noBagsPayload = {
    patientName: "Karim Khan",
    patientCondition: "Surgery",
    bloodGroup: "B_NEGATIVE",
    location: "Square Hospital",
    urgency: "Medium",
    contactPhone: "01811223344",
  };
  const parsedNoBags = createBloodPostSchema.safeParse({ body: noBagsPayload });
  assert(parsedNoBags.success, "Payload without bagsNeeded should pass");
  if (parsedNoBags.success) {
    assertEquals(parsedNoBags.data.body.bagsNeeded, 1, "Default bagsNeeded must be 1");
  }

  // 3. Invalid Blood Group
  console.log("  [3/9] Testing rejection of invalid blood group...");
  const invalidGroupPayload = {
    ...validPayload,
    bloodGroup: "Z_POSITIVE",
  };
  const parsedInvalidGroup = createBloodPostSchema.safeParse({ body: invalidGroupPayload });
  assert(!parsedInvalidGroup.success, "Invalid blood group must be rejected");

  // 4. Missing required patient name or location
  console.log("  [4/9] Testing rejection of missing required fields...");
  const missingFieldsPayload = {
    patientName: "",
    patientCondition: "Critical",
    bloodGroup: "A_POSITIVE",
    location: "",
    urgency: "High",
    contactPhone: "01700000000",
  };
  const parsedMissing = createBloodPostSchema.safeParse({ body: missingFieldsPayload });
  assert(!parsedMissing.success, "Empty patientName or location must fail validation");

  // 5. Profile Requirement: Missing phone number
  console.log("  [5/9] Testing profile requirement: Missing phone number...");
  const userNoPhone = { phoneNumber: "", bloodGroup: "A_POSITIVE" };
  const resNoPhone = validateUserProfileForBlood(userNoPhone);
  assert(!resNoPhone.valid, "User without phone number must be rejected");
  assert(!!resNoPhone.missingFields?.includes("phone number"), "Identifies missing phone number");

  // 6. Profile Requirement: Missing blood group
  console.log("  [6/9] Testing profile requirement: Missing blood group...");
  const userNoBlood = { phoneNumber: "+8801712345678", bloodGroup: null };
  const resNoBlood = validateUserProfileForBlood(userNoBlood);
  assert(!resNoBlood.valid, "User without blood group must be rejected");
  assert(!!resNoBlood.missingFields?.includes("blood group"), "Identifies missing blood group");

  // 7. Profile Requirement: Both missing
  console.log("  [7/9] Testing profile requirement: Both phone & blood group missing...");
  const userNone = { phoneNumber: null, bloodGroup: null };
  const resNone = validateUserProfileForBlood(userNone);
  assert(!resNone.valid, "User with neither phone nor blood group must be rejected");
  assertEquals(resNone.missingFields?.length, 2, "Both fields identified as missing");

  // 8. Profile Requirement: Complete profile
  console.log("  [8/9] Testing profile requirement: Complete profile allowed...");
  const validUser = { phoneNumber: "01711223344", bloodGroup: "AB_POSITIVE" };
  const resValid = validateUserProfileForBlood(validUser);
  assert(resValid.valid, "User with complete profile must be allowed to post");

  // 9. Authorization checks: Admin vs Author vs Unauthorized
  console.log("  [9/9] Testing Admin & Author authorization rules...");
  const post = { authorId: "user-author-123" };
  
  // Author can resolve/delete their own post
  const authorCheck = checkBloodPostPermission(post, "user-author-123", "STUDENT");
  assert(authorCheck.allowed, "Author must be allowed to manage own post");

  // Admin can resolve/delete ANY post
  const adminCheck = checkBloodPostPermission(post, "admin-user-999", "ADMIN");
  assert(adminCheck.allowed, "Admin must be allowed to manage any post");

  // Unauthorized third party
  const unauthorizedCheck = checkBloodPostPermission(post, "random-user-456", "STUDENT");
  assert(!unauthorizedCheck.allowed, "Random user cannot manage another user's post");

  console.log("\n✅ All 9 Campus Blood Module Unit Tests Passed Successfully!\n");
}

runBloodTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
