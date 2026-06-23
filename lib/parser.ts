import OpenAI from "openai";
import { ParsedTranscriptSchema, type ParsedTranscript } from "./schema";

const MODEL = "gpt-4o-mini";

/**
 * Parser input: one or more page images as data URLs. PDFs are rasterized to
 * images upstream (see lib/pdf.ts) before reaching the model, because the model
 * reads high-resolution images far more reliably than a raw PDF.
 */
export type ParserInput = { kind: "images"; dataUrls: string[] };

/**
 * JSON schema handed to the model via structured outputs. This guarantees the
 * response shape. Crucially it asks for RAW data only — codes, credits, grades
 * exactly as written. No GPA, no quality points, no "does it count" decision.
 * All math is done deterministically afterward in gpa.ts.
 */
const RESPONSE_FORMAT = {
  type: "json_schema" as const,
  json_schema: {
    name: "transcript",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        isTranscript: {
          type: "boolean",
          description:
            "True only if this document is an academic transcript with courses and grades. False for anything else (blank, unrelated document, unreadable).",
        },
        reason: {
          type: "string",
          description:
            "If isTranscript is false, a short user-facing explanation. Otherwise empty string.",
        },
        terms: {
          type: "array",
          description:
            "One entry per academic term/semester. Merge the same term if it spans multiple pages.",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: {
                type: "string",
                description: 'Term label as written, e.g. "Fall 2023".',
              },
              courses: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    code: {
                      type: "string",
                      description: 'Course code, e.g. "CS101".',
                    },
                    title: {
                      type: "string",
                      description: "Course title if present, else empty string.",
                    },
                    credits: {
                      type: "number",
                      description:
                        "Credit hours / units for the course as a number.",
                    },
                    grade: {
                      type: "string",
                      description:
                        'Grade exactly as written: a letter ("A", "B+"), or "Pass"/"Fail"/"W"/"Withdrawn". Do not convert to numbers.',
                    },
                  },
                  required: ["code", "title", "credits", "grade"],
                },
              },
            },
            required: ["name", "courses"],
          },
        },
      },
      required: ["isTranscript", "reason", "terms"],
    },
  },
};

const SYSTEM_PROMPT = `You are a precise transcript reader. You are given a university transcript as one or more page images.
Extract every course with its term, course code, title, credit hours, and grade exactly as printed.
Rules:
- Transcribe only. Do NOT compute GPA, quality points, or decide what counts — that is done elsewhere.
- Keep grades EXACTLY as written, character for character. Grades very often carry a trailing modifier: a plus ("+") or a minus ("-"), e.g. "A-", "B+", "C-". These modifiers change the grade and are easy to miss — look closely and never drop them. "A" and "A-" are different grades.
- Words like "Pass", "Fail", "Withdrawn", or "W" are also valid grades — copy them verbatim.
- Group courses under the term/semester they appear in. If a term continues across pages, merge it into one term entry.
- If the document is not a transcript or is unreadable, set isTranscript to false and explain briefly in reason.`;

export class ParseError extends Error {}

/** Build the user message content from the page images. */
function buildUserContent(input: ParserInput) {
  return [
    {
      type: "text" as const,
      text: "Here is the transcript. Extract the courses and grades.",
    },
    ...input.dataUrls.map((url) => ({
      type: "image_url" as const,
      image_url: { url, detail: "high" as const },
    })),
  ];
}

/**
 * Read a transcript (PDF or image) with the vision model and return validated
 * raw structured data. Throws ParseError on a missing key, API failure, or
 * output that doesn't match the schema.
 */
export async function parseTranscript(
  input: ParserInput
): Promise<ParsedTranscript> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ParseError(
      "OPENAI_API_KEY is not set. Add it to .env.local (see .env.local.example)."
    );
  }

  const client = new OpenAI({ apiKey });

  let completion;
  try {
    completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0,
      response_format: RESPONSE_FORMAT,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserContent(input) },
      ],
    });
  } catch (err) {
    throw new ParseError(
      `The document reader failed: ${(err as Error).message}`
    );
  }

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new ParseError("The document reader returned an empty response.");
  }

  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    throw new ParseError("The document reader returned malformed data.");
  }

  const result = ParsedTranscriptSchema.safeParse(json);
  if (!result.success) {
    throw new ParseError("The extracted data did not match the expected shape.");
  }

  return result.data;
}
