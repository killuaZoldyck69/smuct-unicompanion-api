import {
  createAlumniSchema,
  bulkCreateAlumniSchema,
  updateAlumniSchema,
} from "../alumni.schema";

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

async function runAlumniTests() {
  console.log("🧪 Running Campus Alumni Module Validation Unit Tests...\n");

  // 1. Valid full payload
  console.log("  [1/9] Testing Create Alumni with valid full payload...");
  const validFull = {
    name: "Tanvir Hasan",
    email: "tanvir.hasan@smuct.edu.bd",
    batch: "16th Batch",
    graduationYear: 2021,
    department: "Computer Science & Engineering",
    degree: "B.Sc. in CSE",
    currentCompany: "Brain Station 23",
    currentPosition: "Senior Software Engineer",
    skills: ["TypeScript", "React Native", "Node.js", "Docker"],
    linkedInUrl: "https://linkedin.com/in/tanvirhasan",
    personalWebsiteUrl: "https://tanvir.dev",
    image: "https://res.cloudinary.com/demo/image/upload/v1/profile.jpg",
  };
  const parsedFull = createAlumniSchema.safeParse({ body: validFull });
  assert(parsedFull.success, "Full payload should pass schema validation");
  if (parsedFull.success) {
    assertEquals(parsedFull.data.body.name, "Tanvir Hasan", "Name matches");
    assertEquals(parsedFull.data.body.graduationYear, 2021, "Graduation year matches");
  }

  // 2. Minimum required fields
  console.log("  [2/9] Testing Create Alumni with minimum required fields...");
  const minPayload = {
    name: "Farhana Akter",
    batch: "18th",
    graduationYear: 2023,
    department: "Fashion Design & Technology",
  };
  const parsedMin = createAlumniSchema.safeParse({ body: minPayload });
  assert(parsedMin.success, "Minimum payload should pass");
  if (parsedMin.success) {
    assertEquals(parsedMin.data.body.name, "Farhana Akter", "Name matches");
    assertEquals(parsedMin.data.body.skills.length, 0, "Default skills should be empty array");
  }

  // 3. String graduationYear coercion
  console.log("  [3/9] Testing graduationYear string coercion...");
  const stringYearPayload = {
    ...minPayload,
    graduationYear: "2024",
  };
  const parsedStringYear = createAlumniSchema.safeParse({ body: stringYearPayload });
  assert(parsedStringYear.success, "String graduationYear must be coerced to number");
  if (parsedStringYear.success) {
    assertEquals(parsedStringYear.data.body.graduationYear, 2024, "Coerced to 2024 numeric");
  }

  // 4. Empty string tolerances for email and URLs
  console.log("  [4/9] Testing tolerance for empty email and empty URLs...");
  const emptyStringPayload = {
    ...minPayload,
    email: "",
    linkedInUrl: "",
    personalWebsiteUrl: "",
  };
  const parsedEmpty = createAlumniSchema.safeParse({ body: emptyStringPayload });
  assert(parsedEmpty.success, "Empty email and URLs must not fail validation");

  // 5. Missing required fields
  console.log("  [5/9] Testing rejection of missing required fields...");
  const missingName = { ...minPayload, name: "" };
  assert(!createAlumniSchema.safeParse({ body: missingName }).success, "Empty name must fail");

  const missingDept = { ...minPayload, department: "" };
  assert(!createAlumniSchema.safeParse({ body: missingDept }).success, "Empty department must fail");

  const missingBatch = { ...minPayload, batch: "" };
  assert(!createAlumniSchema.safeParse({ body: missingBatch }).success, "Empty batch must fail");

  // 6. Skills transformation from comma-separated string
  console.log("  [6/9] Testing skills transformation from comma-separated string...");
  const stringSkillsPayload = {
    ...minPayload,
    skills: "React, React Native; Node.js, Express",
  };
  const parsedSkills = createAlumniSchema.safeParse({ body: stringSkillsPayload });
  assert(parsedSkills.success, "String skills should transform to array");
  if (parsedSkills.success) {
    assertEquals(parsedSkills.data.body.skills.length, 4, "Should parse 4 skill items");
    assert(parsedSkills.data.body.skills.includes("React Native"), "Contains React Native");
  }

  // 7. Bulk create schema with array of alumni
  console.log("  [7/9] Testing Bulk Create Schema with array of records...");
  const bulkArray = [
    {
      name: "Alumnus One",
      batch: "15th",
      graduationYear: 2020,
      department: "CSE",
    },
    {
      name: "Alumnus Two",
      batch: "17th",
      graduationYear: 2022,
      department: "BBA",
      currentCompany: "Grameenphone",
    },
  ];
  const parsedBulkArray = bulkCreateAlumniSchema.safeParse({ body: bulkArray });
  assert(parsedBulkArray.success, "Bulk array should pass validation");
  if (parsedBulkArray.success) {
    assertEquals((parsedBulkArray.data.body as any).length, 2, "Bulk array has 2 records");
  }

  // 8. Bulk create schema with wrapped object { alumni: [...] }
  console.log("  [8/9] Testing Bulk Create Schema with wrapped object { alumni: [...] }...");
  const bulkObject = { alumni: bulkArray };
  const parsedBulkObject = bulkCreateAlumniSchema.safeParse({ body: bulkObject });
  assert(parsedBulkObject.success, "Wrapped object should pass and transform to array");
  if (parsedBulkObject.success) {
    assertEquals((parsedBulkObject.data.body as any).length, 2, "Transformed to 2 records");
  }

  // 9. Update Alumni Schema (partial updates)
  console.log("  [9/9] Testing Update Alumni Schema with partial edits...");
  const updatePayload = {
    currentCompany: "Google",
    currentPosition: "Staff Engineer",
  };
  const parsedUpdate = updateAlumniSchema.safeParse({ body: updatePayload });
  assert(parsedUpdate.success, "Partial update payload should pass");
  if (parsedUpdate.success) {
    assertEquals(parsedUpdate.data.body.currentCompany, "Google", "Company updated");
    assertEquals(parsedUpdate.data.body.name, undefined, "Name untouched");
  }

  console.log("\n✅ All 9 Campus Alumni Module Unit Tests Passed Successfully!\n");
}

runAlumniTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
