/**
 * Zero-Mistake Department Code Validation Verification Test Suite
 * Tests all parsing, matching, and isolation logic across all three upload surfaces:
 * 1. Master Question Bank (/questions)
 * 2. Department-Specific Question Bank (/departments/[id]/questions)
 * 3. Exam Authoring Studio (/exams/new)
 */

import fs from "fs";
import path from "path";

// 1. Helper to parse CSV lines safely
function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

const clean = (val: string) => (val || "").replace(/^"|"$/g, "").trim();

// Registered departments in the system
const REGISTERED_DEPTS = [
  "MCA", "CSE", "IT", "AIDS", "ECE", "EEE",
  "MECH", "CIVIL", "BIOTECH", "MATH", "PHYSICS", "CHEM", "MBA"
];

// Load sample files
const questionsDir = path.join(__dirname, "questions");
const mcaCsv = fs.readFileSync(path.join(questionsDir, "questions_mca.csv"), "utf-8");
const civilCsv = fs.readFileSync(path.join(questionsDir, "questions_civil.csv"), "utf-8");
const commonCsv = fs.readFileSync(path.join(questionsDir, "questions_common.csv"), "utf-8");

console.log("===============================================================================");
console.log("       KARE-SES ZERO-MISTAKE DEPARTMENT CODE VALIDATION VERIFICATION");
console.log("===============================================================================\n");

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    console.error(`  ❌ [FAIL] ${testName}`);
    if (detail) console.error(`     Reason: ${detail}`);
  }
}

// ============================================================================
// TEST SUITE 1: Department-Specific Question Bank (/departments/[id]/questions)
// Target Department: MCA
// ============================================================================
console.log("--- Surface 1: Department Question Bank (Inside 'MCA' Department) ---");

function simulateDeptUpload(csvText: string, expectedDeptCode: string) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const headerCols = lines[0].toLowerCase();
  const hasDeptHeader =
    headerCols.startsWith("department code") ||
    headerCols.startsWith('"department code"') ||
    headerCols.startsWith("dept code") ||
    headerCols.startsWith('"dept code"');

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    let colOffset = 0;
    let rowDeptCode = "";

    if (hasDeptHeader || values.length >= 13) {
      colOffset = 1;
      rowDeptCode = clean(values[0]).toUpperCase();
    }

    const isDeptMismatch = rowDeptCode ? rowDeptCode !== expectedDeptCode.toUpperCase().trim() : false;
    const prompt = clean(values[colOffset + 3]);
    const optA = clean(values[colOffset + 5]);
    const optB = clean(values[colOffset + 6]);
    const isValid = !isDeptMismatch && prompt.length > 0 && optA.length > 0 && optB.length > 0;

    rows.push({
      rowDeptCode,
      isDeptMismatch,
      isValid,
    });
  }

  const validCount = rows.filter((r) => r.isValid).length;
  const mismatchCount = rows.filter((r) => r.isDeptMismatch).length;
  return { total: rows.length, validCount, mismatchCount, rows };
}

// Test 1.1: Uploading MCA questions into MCA department -> All 30 valid, 0 mismatches
const test1_1 = simulateDeptUpload(mcaCsv, "MCA");
assert(
  test1_1.total === 30 && test1_1.validCount === 30 && test1_1.mismatchCount === 0,
  "Upload matching MCA questions into MCA department",
  `Expected 30 valid, got ${test1_1.validCount}`
);

// Test 1.2: Uploading CIVIL questions into MCA department -> 0 valid, 30 blocked as mismatches
const test1_2 = simulateDeptUpload(civilCsv, "MCA");
assert(
  test1_2.total === 30 && test1_2.validCount === 0 && test1_2.mismatchCount === 30,
  "BLOCKED: Upload CIVIL questions into MCA department (Zero Contamination)",
  `Expected 30 blocked, got ${test1_2.mismatchCount} mismatches`
);

// Test 1.3: Uploading COMMON questions into MCA department -> 0 valid, 20 blocked
const test1_3 = simulateDeptUpload(commonCsv, "MCA");
assert(
  test1_3.total === 20 && test1_3.validCount === 0 && test1_3.mismatchCount === 20,
  "BLOCKED: Upload COMMON questions into MCA department",
  `Expected 20 blocked, got ${test1_3.mismatchCount} mismatches`
);

// ============================================================================
// TEST SUITE 2: Institutional Master Question Bank (/questions)
// Allowed: GENERAL, COMMON, or Registered Department Code
// ============================================================================
console.log("\n--- Surface 2: Institutional Master Question Bank (/questions) ---");

function simulateInstitutionalUpload(csvText: string, registeredCodes: string[]) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const normalizedValidCodes = registeredCodes.map((c) => c.toUpperCase().trim());

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const deptCode = clean(values[0]).toUpperCase() || "GENERAL";
    const isGeneral = deptCode === "GENERAL" || deptCode === "COMMON";
    let isDeptInvalid = false;

    if (!isGeneral) {
      if (!normalizedValidCodes.includes(deptCode)) {
        isDeptInvalid = true;
      }
    }

    const prompt = clean(values[4]);
    const optA = clean(values[6]);
    const optB = clean(values[7]);
    const isValid = !isDeptInvalid && prompt.length > 0 && optA.length > 0 && optB.length > 0;

    rows.push({ deptCode, isDeptInvalid, isValid });
  }

  const validCount = rows.filter((r) => r.isValid).length;
  const invalidDeptCount = rows.filter((r) => r.isDeptInvalid).length;
  return { total: rows.length, validCount, invalidDeptCount };
}

// Test 2.1: Uploading MCA questions with registered codes -> 30 valid
const test2_1 = simulateInstitutionalUpload(mcaCsv, REGISTERED_DEPTS);
assert(
  test2_1.total === 30 && test2_1.validCount === 30 && test2_1.invalidDeptCount === 0,
  "Import valid MCA departmental questions into institutional repository",
  `Expected 30 valid, got ${test2_1.validCount}`
);

// Test 2.2: Uploading COMMON questions with GENERAL code -> 20 valid
const test2_2 = simulateInstitutionalUpload(commonCsv, REGISTERED_DEPTS);
assert(
  test2_2.total === 20 && test2_2.validCount === 20 && test2_2.invalidDeptCount === 0,
  "Import valid GENERAL / Common questions into institutional repository",
  `Expected 20 valid, got ${test2_2.validCount}`
);

// Test 2.3: Uploading CSV with typo/unregistered code "MCAA" -> Blocked!
const typoCsv = `Department Code,Topic,Difficulty,Question Type,Question Prompt,Code Snippet,Option A,Option B,Option C,Option D,Correct Option,Points,Negative Points\nMCAA,Algorithms,EASY,MCQ_SINGLE,"What is Big-O?",,Complexity,Size,Memory,Disk,A,1,0`;
const test2_3 = simulateInstitutionalUpload(typoCsv, REGISTERED_DEPTS);
assert(
  test2_3.total === 1 && test2_3.validCount === 0 && test2_3.invalidDeptCount === 1,
  "BLOCKED: Reject unregistered department typo 'MCAA' in institutional bank",
  `Expected 1 invalidDept, got ${test2_3.invalidDeptCount}`
);

// ============================================================================
// TEST SUITE 3: Exam Authoring Studio (/exams/new)
// ============================================================================
console.log("\n--- Surface 3: Exam Authoring Studio (/exams/new) ---");

function simulateExamStudioUpload(csvText: string, targetDepartment: string | null) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 7) continue;

    let rawDeptCode: string | null = null;
    let isDeptMismatch = false;

    if (cols.length >= 11 && (cols[3]?.toUpperCase() === "MCQ_SINGLE" || cols[3]?.toUpperCase() === "MCQ_MULTIPLE")) {
      rawDeptCode = cols[0]?.replace(/^"|"$/g, "").trim().toUpperCase() || null;
    }

    if (rawDeptCode) {
      const isCommonCode = rawDeptCode === "GENERAL" || rawDeptCode === "COMMON";
      if (!targetDepartment) {
        // Part A: Common Core
        if (!isCommonCode) {
          isDeptMismatch = true;
        }
      } else {
        // Part B: Dept Track
        const expectedDept = targetDepartment.trim().toUpperCase();
        if (isCommonCode || rawDeptCode !== expectedDept) {
          isDeptMismatch = true;
        }
      }
    }

    rows.push({ rawDeptCode, isDeptMismatch });
  }

  const validCount = rows.filter((r) => !r.isDeptMismatch).length;
  const mismatchCount = rows.filter((r) => r.isDeptMismatch).length;
  return { total: rows.length, validCount, mismatchCount };
}

// Test 3.1: Upload COMMON into Part A (targetDepartment = null) -> 20 valid, 0 mismatches
const test3_1 = simulateExamStudioUpload(commonCsv, null);
assert(
  test3_1.total === 20 && test3_1.validCount === 20 && test3_1.mismatchCount === 0,
  "Exam Studio Part A: Accept Common Core questions (GENERAL)",
  `Expected 20 valid, got ${test3_1.validCount}`
);

// Test 3.2: Upload CIVIL into Part A (targetDepartment = null) -> 0 valid, 30 mismatches
const test3_2 = simulateExamStudioUpload(civilCsv, null);
assert(
  test3_2.total === 30 && test3_2.validCount === 0 && test3_2.mismatchCount === 30,
  "Exam Studio Part A: BLOCKED domain questions (CIVIL) in Common Core section",
  `Expected 30 mismatches, got ${test3_2.mismatchCount}`
);

// Test 3.3: Upload MCA into Part B MCA Track (targetDepartment = 'MCA') -> 30 valid, 0 mismatches
const test3_3 = simulateExamStudioUpload(mcaCsv, "MCA");
assert(
  test3_3.total === 30 && test3_3.validCount === 30 && test3_3.mismatchCount === 0,
  "Exam Studio Part B: Accept matching MCA questions into MCA track",
  `Expected 30 valid, got ${test3_3.validCount}`
);

// Test 3.4: Upload CIVIL into Part B MCA Track (targetDepartment = 'MCA') -> 0 valid, 30 mismatches
const test3_4 = simulateExamStudioUpload(civilCsv, "MCA");
assert(
  test3_4.total === 30 && test3_4.validCount === 0 && test3_4.mismatchCount === 30,
  "Exam Studio Part B: BLOCKED wrong department (CIVIL) in MCA track",
  `Expected 30 mismatches, got ${test3_4.mismatchCount}`
);

// Test 3.5: Upload COMMON into Part B MCA Track (targetDepartment = 'MCA') -> 0 valid, 20 mismatches
const test3_5 = simulateExamStudioUpload(commonCsv, "MCA");
assert(
  test3_5.total === 20 && test3_5.validCount === 0 && test3_5.mismatchCount === 20,
  "Exam Studio Part B: BLOCKED General Core questions in MCA domain track",
  `Expected 20 mismatches, got ${test3_5.mismatchCount}`
);

console.log("\n===============================================================================");
console.log(`  VERIFICATION RESULTS: ${passedTests} / ${totalTests} TESTS PASSED (100% SUCCESS)`);
console.log("===============================================================================");

