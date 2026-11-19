/**
 * Helper utilities for detecting and filtering erroneously placed department tags in code_snippet fields.
 */

const KNOWN_DEPT_CODES = new Set([
  "GENERAL",
  "GENERAL_T",
  "GENERAL_TA",
  "COMMON",
  "COMMON_TAMIL",
  "AE",
  "AERO",
  "AGRI",
  "AHS",
  "ARCH",
  "BM",
  "BT",
  "CA",
  "CHY",
  "CIVIL",
  "COM",
  "CSHM",
  "ECE",
  "EEE",
  "ENG",
  "FOOD",
  "FS",
  "HORTI",
  "LIB",
  "IT",
  "LAW",
  "MATHS",
  "MBA",
  "MECH",
  "MSW",
  "P_ED",
  "VC",
  "TAM",
  "TAMIL",
  "YOGA",
  "PHY",
  "CSE",
]);

export function isBogusDepartmentSnippet(
  snippet?: string | null,
  deptCode?: string | null
): boolean {
  if (!snippet) return true;
  const s = snippet.trim();
  if (!s) return true;
  const upper = s.toUpperCase();
  if (KNOWN_DEPT_CODES.has(upper)) return true;
  if (deptCode && upper === deptCode.trim().toUpperCase()) return true;
  // If it's a short token with no code characters, it was an erroneously placed department label
  if (s.length <= 15 && !/[;{}=()+\-*/<>\n]/.test(s) && /^[A-Z0-9_\s-]+$/i.test(s)) {
    return true;
  }
  return false;
}

export function sanitizeCodeSnippet(
  snippet?: string | null,
  deptCode?: string | null
): string | undefined {
  if (isBogusDepartmentSnippet(snippet, deptCode)) {
    return undefined;
  }
  return snippet ? snippet.trim() : undefined;
}
