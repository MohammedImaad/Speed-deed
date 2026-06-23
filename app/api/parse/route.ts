import { NextRequest, NextResponse } from "next/server";
import { parseTranscript, ParseError } from "@/lib/parser";
import { pdfToImageDataUrls } from "@/lib/pdf";
import { computeGpa } from "@/lib/gpa";

export const runtime = "nodejs";
export const maxDuration = 60;

// Serverless platforms (e.g. Vercel) cap request bodies at ~4.5 MB. Stay under
// that so large uploads get a clear message instead of a platform-level reject.
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB
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
  if (file.size > MAX_BYTES) {
    return fail("File is too large (max 4 MB). Try a smaller scan or photo.", 413);
  }

  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isImage = ACCEPTED_IMAGE.test(file.type);
  if (!isPdf && !isImage) {
    return fail("Unsupported file type. Upload a PDF or an image (PNG/JPG).");
  }

  // 1. Turn the upload into page image(s). PDFs are rasterized at high DPI
  //    (the model reads images far more reliably than a raw PDF); an uploaded
  //    image is used as-is.
  let dataUrls: string[];
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    if (isPdf) {
      dataUrls = pdfToImageDataUrls(buffer);
      if (dataUrls.length === 0) return fail("That PDF has no readable pages.");
    } else {
      dataUrls = [`data:${file.type};base64,${buffer.toString("base64")}`];
    }
  } catch {
    return fail("Could not read that file. It may be corrupt.");
  }

  // 2. Parse (fuzzy, LLM). 3. Compute (exact, deterministic).
  try {
    const parsed = await parseTranscript({ kind: "images", dataUrls });

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
    return NextResponse.json({ result });
  } catch (err) {
    if (err instanceof ParseError) return fail(err.message, 502);
    return fail("Something went wrong reading the transcript.", 500);
  }
}
