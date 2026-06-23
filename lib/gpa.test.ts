import { describe, it, expect } from "vitest";
import { computeGpa, round2 } from "./gpa";
import { classifyGrade } from "./gradeScale";
import type { ParsedTranscript } from "./schema";

describe("classifyGrade", () => {
  it("maps letter grades to the spec scale", () => {
    expect(classifyGrade("A")).toEqual({ kind: "gpa", points: 4.0 });
    expect(classifyGrade("B+")).toEqual({ kind: "gpa", points: 3.3 });
    expect(classifyGrade("B-")).toEqual({ kind: "gpa", points: 2.7 });
    expect(classifyGrade("F")).toEqual({ kind: "gpa", points: 0.0 });
  });

  it("normalizes case and whitespace", () => {
    expect(classifyGrade("  a- ")).toEqual({ kind: "gpa", points: 3.7 });
  });

  it("treats Pass/Fail and Withdrawn as excluded", () => {
    expect(classifyGrade("Pass").kind).toBe("excluded");
    expect(classifyGrade("W").kind).toBe("excluded");
    expect(classifyGrade("Withdrawn").kind).toBe("excluded");
  });

  it("flags unrecognized grades as unknown", () => {
    expect(classifyGrade("Z+").kind).toBe("unknown");
  });
});

describe("computeGpa - worked example from the spec", () => {
  // The exact table given in the challenge. Expected GPA = 3.02.
  const transcript: ParsedTranscript = {
    isTranscript: true,
    reason: "",
    terms: [
      {
        name: "Term 1",
        courses: [
          { code: "CS101", title: "", credits: 3, grade: "A" },
          { code: "MATH201", title: "", credits: 4, grade: "B+" },
          { code: "ENG100", title: "", credits: 3, grade: "B-" },
          { code: "HIST110", title: "", credits: 3, grade: "C" },
          { code: "PE100", title: "", credits: 1, grade: "Pass" },
        ],
      },
    ],
  };

  const result = computeGpa(transcript);
  const term = result.terms[0];

  it("excludes the Pass course from GPA credits", () => {
    expect(term.gpaCredits).toBe(13);
    const pe = term.courses.find((c) => c.code === "PE100")!;
    expect(pe.counts).toBe(false);
    expect(pe.qualityPoints).toBeNull();
  });

  it("computes 39.3 quality points", () => {
    expect(round2(term.qualityPoints)).toBe(39.3);
  });

  it("computes term GPA of 3.02", () => {
    expect(term.gpa).toBe(3.02);
  });

  it("computes cumulative GPA of 3.02", () => {
    expect(result.cumulativeGpa).toBe(3.02);
  });
});

describe("computeGpa - edge cases", () => {
  it("returns null GPA for a term with only excluded courses", () => {
    const result = computeGpa({
      isTranscript: true,
      reason: "",
      terms: [
        {
          name: "Term 1",
          courses: [{ code: "PE100", title: "", credits: 1, grade: "Pass" }],
        },
      ],
    });
    expect(result.terms[0].gpa).toBeNull();
    expect(result.cumulativeGpa).toBeNull();
  });

  it("weights cumulative GPA across terms by credits, not by term average", () => {
    const result = computeGpa({
      isTranscript: true,
      reason: "",
      terms: [
        {
          name: "Term 1",
          courses: [{ code: "X1", title: "", credits: 4, grade: "A" }], // 16 pts
        },
        {
          name: "Term 2",
          courses: [{ code: "X2", title: "", credits: 1, grade: "C" }], // 2 pts
        },
      ],
    });
    // (16 + 2) / (4 + 1) = 3.6, not (4.0 + 2.0)/2 = 3.0
    expect(result.cumulativeGpa).toBe(3.6);
  });

  it("flags unknown grades without crashing", () => {
    const result = computeGpa({
      isTranscript: true,
      reason: "",
      terms: [
        {
          name: "Term 1",
          courses: [{ code: "X1", title: "", credits: 3, grade: "Z+" }],
        },
      ],
    });
    expect(result.hasUnknownGrades).toBe(true);
    expect(result.terms[0].gpa).toBeNull();
  });

  it("counts a letter F (0.0) but not a Pass/Fail Fail", () => {
    const result = computeGpa({
      isTranscript: true,
      reason: "",
      terms: [
        {
          name: "Term 1",
          courses: [
            { code: "X1", title: "", credits: 3, grade: "A" }, // 12 pts, 3 cr
            { code: "X2", title: "", credits: 3, grade: "F" }, // 0 pts, 3 cr counts
          ],
        },
      ],
    });
    // (12 + 0) / (3 + 3) = 2.0 — the F drags the GPA down.
    expect(result.terms[0].gpaCredits).toBe(6);
    expect(result.terms[0].gpa).toBe(2.0);
  });
});
