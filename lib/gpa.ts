import { classifyGrade } from "./gradeScale";
import type { ParsedTranscript, RawCourse, RawTerm } from "./schema";

/** A course after the math layer has classified it. */
export interface ComputedCourse {
  code: string;
  title: string;
  credits: number;
  grade: string;
  /** Whether this course contributes to the GPA. */
  counts: boolean;
  /** Grade points (e.g. 4.0) when counts; null otherwise. */
  gradePoints: number | null;
  /** credits * gradePoints when counts; null otherwise. */
  qualityPoints: number | null;
  /** Set when the grade string wasn't recognized at all. */
  unknownGrade: boolean;
}

export interface ComputedTerm {
  name: string;
  courses: ComputedCourse[];
  /** Credits that count toward the GPA in this term. */
  gpaCredits: number;
  qualityPoints: number;
  /** Term GPA, or null if no GPA-bearing credits. */
  gpa: number | null;
}

export interface GpaResult {
  terms: ComputedTerm[];
  cumulativeGpaCredits: number;
  cumulativeQualityPoints: number;
  cumulativeGpa: number | null;
  /** True if any course had an unrecognized grade — surfaced as a warning. */
  hasUnknownGrades: boolean;
}

/** Round half-up to 2 decimals, matching the spec's "round to 2 decimals". */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function computeCourse(course: RawCourse): ComputedCourse {
  const classification = classifyGrade(course.grade);

  if (classification.kind === "gpa") {
    return {
      code: course.code,
      title: course.title ?? "",
      credits: course.credits,
      grade: course.grade,
      counts: true,
      gradePoints: classification.points,
      qualityPoints: course.credits * classification.points,
      unknownGrade: false,
    };
  }

  return {
    code: course.code,
    title: course.title ?? "",
    credits: course.credits,
    grade: course.grade,
    counts: false,
    gradePoints: null,
    qualityPoints: null,
    unknownGrade: classification.kind === "unknown",
  };
}

function computeTerm(term: RawTerm): ComputedTerm {
  const courses = term.courses.map(computeCourse);

  let gpaCredits = 0;
  let qualityPoints = 0;
  for (const c of courses) {
    if (c.counts) {
      gpaCredits += c.credits;
      qualityPoints += c.qualityPoints as number;
    }
  }

  return {
    name: term.name,
    courses,
    gpaCredits,
    qualityPoints,
    gpa: gpaCredits > 0 ? round2(qualityPoints / gpaCredits) : null,
  };
}

/**
 * Pure, deterministic GPA computation. Given validated raw transcript data,
 * produces per-term and cumulative GPA. No I/O, no LLM — fully unit-testable.
 *
 * GPA = sum(gradePoints * credits) / sum(credits), over GPA-bearing courses.
 */
export function computeGpa(parsed: ParsedTranscript): GpaResult {
  const terms = parsed.terms.map(computeTerm);

  let cumulativeGpaCredits = 0;
  let cumulativeQualityPoints = 0;
  let hasUnknownGrades = false;

  for (const term of terms) {
    cumulativeGpaCredits += term.gpaCredits;
    cumulativeQualityPoints += term.qualityPoints;
    if (term.courses.some((c) => c.unknownGrade)) hasUnknownGrades = true;
  }

  return {
    terms,
    cumulativeGpaCredits,
    cumulativeQualityPoints,
    cumulativeGpa:
      cumulativeGpaCredits > 0
        ? round2(cumulativeQualityPoints / cumulativeGpaCredits)
        : null,
    hasUnknownGrades,
  };
}
