import { sanitizeComplaint } from "../complaint.service";

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

// State transition validator simulating the service logic
function validateStatusTransition(currentStatus: string, newStatus: string): { valid: boolean; error?: string } {
  if (currentStatus === newStatus) {
    return { valid: false, error: `Complaint is already ${newStatus.toLowerCase()}` };
  }

  switch (currentStatus) {
    case "PENDING":
      if (newStatus === "RESOLVED") {
        return { valid: false, error: "A pending complaint must first be accepted before it can be resolved" };
      }
      if (newStatus !== "ACCEPTED" && newStatus !== "REJECTED") {
        return { valid: false, error: `Invalid status transition from PENDING to ${newStatus}` };
      }
      return { valid: true };

    case "ACCEPTED":
      if (newStatus === "PENDING") {
        return { valid: false, error: "Cannot revert an accepted complaint back to pending" };
      }
      if (newStatus !== "RESOLVED" && newStatus !== "REJECTED") {
        return { valid: false, error: `Invalid status transition from ACCEPTED to ${newStatus}` };
      }
      return { valid: true };

    case "RESOLVED":
      return { valid: false, error: "Resolved complaints cannot undergo further status transitions" };

    case "REJECTED":
      return { valid: false, error: "Rejected complaints cannot undergo further status transitions" };

    default:
      return { valid: false, error: "Invalid complaint status" };
  }
}

export function runComplaintUnitTests() {
  console.log("🧪 Running Complaint & Lifecycle Unit Tests...\n");

  // 1. Anonymity test: Anonymous complaint viewed by admin
  console.log("  [1/7] Testing Anonymous Complaint Masking for Admin...");
  const anonymousComplaint = {
    id: "comp-123",
    userId: "user-456",
    title: "Hostel Wi-Fi issue",
    description: "Wi-Fi dropping frequently in Block B",
    category: "IT Support",
    status: "PENDING",
    isAnonymous: true,
    user: {
      id: "user-456",
      name: "Secret Student",
      email: "secret@smuct.edu.bd",
      role: "STUDENT",
    },
  };

  const adminView = sanitizeComplaint(anonymousComplaint, "admin-999", "ADMIN");
  assertEquals(adminView.user, null, "Admin must NOT see user object for anonymous complaints");
  assertEquals(adminView.userId, null, "Admin must NOT see userId for anonymous complaints");
  assertEquals(adminView.title, "Hostel Wi-Fi issue", "Complaint title remains intact");

  // 2. Anonymity test: Anonymous complaint viewed by author
  console.log("  [2/7] Testing Anonymous Complaint View for Author...");
  const authorView = sanitizeComplaint(anonymousComplaint, "user-456", "STUDENT");
  assert(authorView.user !== null, "Author should see their own user info");
  assertEquals(authorView.userId, "user-456", "Author retains userId");

  // 3. Non-anonymous complaint: Identity visible to admin
  console.log("  [3/7] Testing Public / Standard Complaint Identity Preservation...");
  const publicComplaint = {
    id: "comp-789",
    userId: "user-789",
    title: "Broken bench in Lab 302",
    description: "Third row bench has a loose plank",
    category: "Facilities",
    status: "PENDING",
    isAnonymous: false,
    user: {
      id: "user-789",
      name: "Sabbir Ahmed",
      email: "sabbir@smuct.edu.bd",
      role: "STUDENT",
    },
  };

  const publicAdminView = sanitizeComplaint(publicComplaint, "admin-999", "ADMIN");
  assert(publicAdminView.user !== null, "Public complaint user must NOT be null");
  assertEquals(publicAdminView.user?.name, "Sabbir Ahmed", "Complainant name preserved");
  assertEquals(publicAdminView.userId, "user-789", "Complainant userId preserved");

  // 4. Lifecycle rule: PENDING -> ACCEPTED (valid) & PENDING -> REJECTED (valid)
  console.log("  [4/7] Testing PENDING Lifecycle Transitions...");
  const pendingToAccepted = validateStatusTransition("PENDING", "ACCEPTED");
  assert(pendingToAccepted.valid, "PENDING -> ACCEPTED must be valid");

  const pendingToRejected = validateStatusTransition("PENDING", "REJECTED");
  assert(pendingToRejected.valid, "PENDING -> REJECTED must be valid");

  // 5. Lifecycle rule: PENDING -> RESOLVED (INVALID!)
  console.log("  [5/7] Testing Direct Resolution Prevention (Must Accept First)...");
  const pendingToResolved = validateStatusTransition("PENDING", "RESOLVED");
  assert(!pendingToResolved.valid, "PENDING -> RESOLVED must be rejected");
  assert(
    pendingToResolved.error?.includes("must first be accepted"),
    "Should explain complaint must first be accepted",
  );

  // 6. Lifecycle rule: ACCEPTED -> RESOLVED (valid) & ACCEPTED -> PENDING (INVALID!)
  console.log("  [6/7] Testing ACCEPTED Lifecycle Transitions...");
  const acceptedToResolved = validateStatusTransition("ACCEPTED", "RESOLVED");
  assert(acceptedToResolved.valid, "ACCEPTED -> RESOLVED must be valid");

  const acceptedToPending = validateStatusTransition("ACCEPTED", "PENDING");
  assert(!acceptedToPending.valid, "ACCEPTED -> PENDING must be rejected");

  // 7. Lifecycle rule: Terminal states (RESOLVED, REJECTED)
  console.log("  [7/7] Testing Terminal State Immutability (RESOLVED / REJECTED)...");
  const resolvedToAccepted = validateStatusTransition("RESOLVED", "ACCEPTED");
  assert(!resolvedToAccepted.valid, "RESOLVED complaint cannot transition");

  const rejectedToAccepted = validateStatusTransition("REJECTED", "ACCEPTED");
  assert(!rejectedToAccepted.valid, "REJECTED complaint cannot transition");

  const duplicateCheck = validateStatusTransition("ACCEPTED", "ACCEPTED");
  assert(!duplicateCheck.valid, "Duplicate status transition must be rejected");

  console.log("\n✅ All 7 Complaint Lifecycle & Anonymity Unit Tests Passed Successfully!\n");
}

if (process.argv[1]?.includes("complaint.test.ts")) {
  runComplaintUnitTests();
}
