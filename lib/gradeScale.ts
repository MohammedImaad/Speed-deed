/**
 * The fixed grade scale from the challenge spec.
 * This is intentionally a plain data table, not prompt logic — the LLM never
 * decides grade points; the math layer looks them up here.
 */
export const GRADE_POINTS: Record<string, number> = {
  A: 4.0,
  "A-": 3.7,
  "B+": 3.3,
  B: 3.0,
  "B-": 2.7,
  "C+": 2.3,
  C: 2.0,
  "C-": 1.7,
  "D+": 1.3,
  D: 1.0,
  F: 0.0,
};

/**
 * Grades that are shown to the user but excluded from the GPA, per the spec
 * (Pass/Fail and Withdrawn). We normalize a few common spellings the parser
 * might emit. Anything here counts=false and contributes no credits/points.
 */
const NON_GPA_GRADES = new Set([
  "PASS",
  "P",
  "FAIL", // a Pass/Fail "Fail" — distinct from a letter-grade F
  "W",
  "WITHDRAWN",
  "WITHDRAW",
  "I", // incomplete
  "IP", // in progress
  "NP", // no pass
  "CR", // credit
  "NC", // no credit
  "AU", // audit
]);

export type GradeClassification =
  | { kind: "gpa"; points: number }
  | { kind: "excluded" }
  | { kind: "unknown" };

/**
 * Classify a raw grade string from the parser into how the math layer treats
 * it. Normalizes case/whitespace but does not guess — an unrecognized grade is
 * reported as "unknown" so the UI can flag it rather than silently drop it.
 */
export function classifyGrade(rawGrade: string): GradeClassification {
  const g = rawGrade.trim().toUpperCase();

  // Letter grades take priority (note: letter "F" is GPA-bearing at 0.0,
  // while a Pass/Fail "FAIL" is excluded — they are different inputs).
  if (g in GRADE_POINTS) {
    return { kind: "gpa", points: GRADE_POINTS[g] };
  }

  if (NON_GPA_GRADES.has(g)) {
    return { kind: "excluded" };
  }

  return { kind: "unknown" };
}
