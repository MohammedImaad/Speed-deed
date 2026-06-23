import * as mupdf from "mupdf";

// Render scale. ~2.5x ≈ 180 DPI — enough resolution that small grade modifiers
// ("A-", "B+") survive, which they do not when the model reads a PDF directly.
const SCALE = 2.5;

// Cap pages we send to the model to keep latency and cost bounded.
const MAX_PAGES = 12;

/**
 * Rasterize every page of a PDF to a PNG data URL using MuPDF (WASM). We send
 * images rather than the raw PDF because the model reads high-resolution images
 * far more reliably — sending a PDF directly loses fine glyphs like the "-" in
 * "A-". MuPDF is pure WASM with no native binaries, so it runs on serverless.
 */
export function pdfToImageDataUrls(buffer: Buffer): string[] {
  const doc = mupdf.Document.openDocument(
    new Uint8Array(buffer),
    "application/pdf"
  );

  const count = Math.min(doc.countPages(), MAX_PAGES);
  const dataUrls: string[] = [];

  for (let i = 0; i < count; i++) {
    const page = doc.loadPage(i);
    const pixmap = page.toPixmap(
      mupdf.Matrix.scale(SCALE, SCALE),
      mupdf.ColorSpace.DeviceRGB,
      false, // no alpha
      true // anti-aliased
    );
    const png = pixmap.asPNG();
    const base64 = Buffer.from(png).toString("base64");
    dataUrls.push(`data:image/png;base64,${base64}`);
    pixmap.destroy();
    page.destroy();
  }

  return dataUrls;
}
