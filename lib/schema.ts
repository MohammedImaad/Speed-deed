import { z } from "zod";

/**
 * The shape the LLM parser must return. This is *raw transcription only* —
 * course codes, credits, and the grade as written. No GPA, no quality points,
 * no "counts" decisions. All of that is computed deterministically in gpa.ts.
 */
export const RawCourseSchema = z.object({
  code: z.string(),
  title: z.string().optional().default(""),
  credits: z.number(),
  grade: z.string(),
});

export const RawTermSchema = z.object({
  name: z.string(),
  courses: z.array(RawCourseSchema),
});

export const ParsedTranscriptSchema = z.object({
  /** False when the document is unreadable or clearly not a transcript. */
  isTranscript: z.boolean(),
  /** A short reason shown to the user when isTranscript is false. */
  reason: z.string().optional().default(""),
  terms: z.array(RawTermSchema),
});

export type RawCourse = z.infer<typeof RawCourseSchema>;
export type RawTerm = z.infer<typeof RawTermSchema>;
export type ParsedTranscript = z.infer<typeof ParsedTranscriptSchema>;
