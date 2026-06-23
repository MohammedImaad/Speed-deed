import { pdf } from "pdf-to-img";

/**
 * Render every page of a PDF to a PNG data URL. We rasterize and send images to
 * the vision model rather than extracting embedded text, so scanned PDFs (which
 * have no text layer) work the same as digital ones.
 */
export async function pdfToImageDataUrls(buffer: Buffer): Promise<string[]> {
  // scale=2 gives ~144 DPI — enough for the model to read small grade columns.
  const document = await pdf(buffer, { scale: 2 });
  const dataUrls: string[] = [];
  for await (const page of document) {
    dataUrls.push(`data:image/png;base64,${page.toString("base64")}`);
  }
  return dataUrls;
}
