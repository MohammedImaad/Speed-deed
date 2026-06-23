import { NextRequest, NextResponse } from "next/server";
import { pdfToImageDataUrls } from "@/lib/pdf";
import { parseTranscript, ParseError } from "@/lib/parser";
import { computeGpa } from "@/lib/gpa";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const ACCEPTED_IMAGE = /^image\/(png|jpe?g|webp|gif)$/;

/** Return a clean JSON error with the given status — never a stack trace. */
function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    return fail("Could not read the upload.");
  }

  if (!file) return fail("No file was uploaded.");
  if (file.size === 0) return fail("The uploaded file is empty.");
  if (file.size > MAX_BYTES) return fail("File is too large (max 15 MB).");

  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isImage = ACCEPTED_IMAGE.test(file.type);
  if (!isPdf && !isImage) {
    return fail("Unsupported file type. Upload a PDF or an image (PNG/JPG).");
  }

  // 1. Get page image(s).
  let imageDataUrls: string[];
  try {
    if (isPdf) {
      const buffer = Buffer.from(await file.arrayBuffer());
      imageDataUrls = await pdfToImageDataUrls(buffer);
      if (imageDataUrls.length === 0) {
        return fail("That PDF has no readable pages.");
      }
    } else {
      const buffer = Buffer.from(await file.arrayBuffer());
      const mime = ACCEPTED_IMAGE.test(file.type) ? file.type : "image/png";
      imageDataUrls = [`data:${mime};base64,${buffer.toString("base64")}`];
    }
  } catch {
    return fail("Could not process that file. It may be corrupt.");
  }

  // 2. Parse (fuzzy, LLM). 3. Compute (exact, deterministic).
  try {
    const parsed = await parseTranscript(imageDataUrls);

    if (!parsed.isTranscript) {
      return fail(
        parsed.reason || "This doesn't look like a transcript.",
        422
      );
    }
    if (parsed.terms.length === 0) {
      return fail("No courses could be read from this transcript.", 422);
    }

    const result = computeGpa(parsed);
    return NextResponse.json({ result, pageCount: imageDataUrls.length });
  } catch (err) {
    if (err instanceof ParseError) return fail(err.message, 502);
    return fail("Something went wrong reading the transcript.", 500);
  }
}
