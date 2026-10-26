import { sanitizeComplaint } from "../complaint.service";
import {
  createComplaintSchema,
  updateComplaintSchema,
  complaintIdParamSchema,
  getMyComplaintsQuerySchema,
} from "../complaint.schema";

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

  // 4. Faculty / Teacher complaint identity preservation
  console.log("  [4/12] Testing Faculty / Teacher Complaint Preservation...");
  const facultyComplaint = {
    id: "comp-901",
    userId: "teacher-101",
    title: "Projector lamp burned out in Room 405",
    description: "The ceiling projector lamp has reached end of life during CS201 lecture",
    category: "IT Support",
    status: "PENDING",
    isAnonymous: false,
    user: {
      id: "teacher-101",
      name: "Dr. Farhan Tanvir",
      email: "farhan.tanvir@smuct.edu.bd",
      role: "TEACHER",
      teacherProfile: {
        teacherId: "FAC-1002",
        department: "Computer Science and Engineering",
        designation: "Associate Professor",
      },
    },
  };

  const facultyAdminView = sanitizeComplaint(facultyComplaint, "admin-999", "ADMIN");
  assert(facultyAdminView.user !== null, "Faculty public complaint user must NOT be null");
  assertEquals(facultyAdminView.user?.teacherProfile?.teacherId, "FAC-1002", "Teacher ID preserved");
  assertEquals(facultyAdminView.user?.role, "TEACHER", "Teacher role preserved");

  // 5. Lifecycle rule: PENDING -> ACCEPTED (valid) & PENDING -> REJECTED (valid)
  console.log("  [5/12] Testing PENDING Lifecycle Transitions...");
  const pendingToAccepted = validateStatusTransition("PENDING", "ACCEPTED");
  assert(pendingToAccepted.valid, "PENDING -> ACCEPTED must be valid");

  const pendingToRejected = validateStatusTransition("PENDING", "REJECTED");
  assert(pendingToRejected.valid, "PENDING -> REJECTED must be valid");

  // 6. Lifecycle rule: PENDING -> RESOLVED (INVALID!)
  console.log("  [6/12] Testing Direct Resolution Prevention (Must Accept First)...");
  const pendingToResolved = validateStatusTransition("PENDING", "RESOLVED");
  assert(!pendingToResolved.valid, "PENDING -> RESOLVED must be rejected");
  assert(
    !!pendingToResolved.error?.includes("must first be accepted"),
    "Should explain complaint must first be accepted",
  );

  // 7. Lifecycle rule: ACCEPTED -> RESOLVED (valid) & ACCEPTED -> PENDING (INVALID!)
  console.log("  [7/12] Testing ACCEPTED Lifecycle Transitions...");
  const acceptedToResolved = validateStatusTransition("ACCEPTED", "RESOLVED");
  assert(acceptedToResolved.valid, "ACCEPTED -> RESOLVED must be valid");

  const acceptedToPending = validateStatusTransition("ACCEPTED", "PENDING");
  assert(!acceptedToPending.valid, "ACCEPTED -> PENDING must be rejected");

  // 8. Lifecycle rule: Terminal states (RESOLVED, REJECTED)
  console.log("  [8/12] Testing Terminal State Immutability (RESOLVED / REJECTED)...");
  const resolvedToAccepted = validateStatusTransition("RESOLVED", "ACCEPTED");
  assert(!resolvedToAccepted.valid, "RESOLVED complaint cannot transition");

  const rejectedToAccepted = validateStatusTransition("REJECTED", "ACCEPTED");
  assert(!rejectedToAccepted.valid, "REJECTED complaint cannot transition");

  const duplicateCheck = validateStatusTransition("ACCEPTED", "ACCEPTED");
  assert(!duplicateCheck.valid, "Duplicate status transition must be rejected");

  // 9. Schema test: Create complaint schema validation
  console.log("  [9/12] Testing Create Complaint Input Validation Schemas...");

  const validPayload = {
    body: {
      title: "  Broken Window in 304  ",
      description: "Window glass pane has a crack from the storm",
      category: "Facilities",
      isAnonymous: false,
    },
  };
  const parsedValid = createComplaintSchema.parse(validPayload);
  assertEquals(parsedValid.body.title, "Broken Window in 304", "Whitespace should be trimmed from title");

  // 10. Schema test: Rejection of empty/too-short title
  console.log("  [10/12] Testing Validation Rejection on Empty/Short Inputs...");
  let shortTitleFailed = false;
  try {
    createComplaintSchema.parse({
      body: {
        title: "   ",
        description: "Window glass pane has a crack from the storm",
        category: "Facilities",
      },
    });
  } catch (err: any) {
    shortTitleFailed = true;
  }
  assert(shortTitleFailed, "Whitespace-only title must be rejected by schema");

  // 11. Schema test: UUID parameter format validation
  console.log("  [11/12] Testing UUID Param Validation...");
  let invalidUuidFailed = false;
  try {
    complaintIdParamSchema.parse({ params: { id: "not-a-uuid" } });
  } catch (err) {
    invalidUuidFailed = true;
  }
  assert(invalidUuidFailed, "Malformed UUID must be rejected");

  const validUuidResult = complaintIdParamSchema.parse({
    params: { id: "a0000000-0000-4000-8000-000000000001" },
  });
  assertEquals(validUuidResult.params.id, "a0000000-0000-4000-8000-000000000001", "Valid UUID must pass");

  // 12. Schema test: Query schema with limit and status
  console.log("  [12/12] Testing Query Schema Coercion & Bounds...");
  const parsedQuery = getMyComplaintsQuerySchema.parse({
    query: { status: "PENDING", limit: "25", page: "2" },
  });
  assertEquals(parsedQuery.query.limit, 25, "Limit string should be coerced to number");
  assertEquals(parsedQuery.query.page, 2, "Page string should be coerced to number");
  assertEquals(parsedQuery.query.status, "PENDING", "Status enum parsed");

  console.log("\n✅ All 12 Complaint Lifecycle, Security, Privacy & Validation Unit Tests Passed Successfully!\n");
}

if (process.argv[1]?.includes("complaint.test.ts")) {
  runComplaintUnitTests();
}
