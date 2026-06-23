# Transcript GPA Calculator

Upload a university transcript (PDF or image — scan or phone photo) and get your
GPA broken down **per term** and **cumulative**. The document is read by an LLM;
the GPA math is done separately in plain, tested TypeScript.

**Live demo:** https://speed-deed-topaz.vercel.app/
(try it with `samples/sample_transcript.pdf`)

## How to run

Requires Node 18+ and an OpenAI API key.

```bash
npm install
cp .env.local.example .env.local   # then paste your key into OPENAI_API_KEY
npm run dev                        # http://localhost:3000
```

Run the tests:

```bash
npm test
```

## How it works

The single most important design decision, straight from the brief:

> Keep the parsing step separate from the GPA math: the reading can be fuzzy,
> but the calculation must be exact.

So the pipeline has two cleanly separated halves:

```
upload ─► [ fuzzy ]  pdf.ts + parser.ts ─► raw JSON ─► [ exact ]  gpa.ts ─► UI
            LLM / vision                    (Zod)        pure functions
```

1. **`lib/pdf.ts`** — rasterizes each PDF page to a high-DPI PNG with **MuPDF**
   (WASM, no native binaries — runs locally and on serverless). Images are used
   as-is. (Rasterizing rather than extracting embedded text means scanned PDFs
   with no text layer work the same as digital ones. High DPI matters: sending a
   PDF straight to the model loses fine glyphs like the "-" in "A-", which
   silently corrupts the GPA — see "what I'd improve".)
2. **`lib/parser.ts`** — sends the page image(s) to OpenAI `gpt-4o-mini` (vision)
   with a strict JSON schema (structured outputs). The model **only transcribes**
   — course code, credits, grade as written. It does no arithmetic and makes no
   "does this count" decision. The response is validated with **Zod**.
3. **`lib/gpa.ts`** — pure, deterministic functions that take the validated raw
   data and compute the result. No I/O, no LLM, fully unit-testable.
4. **`app/api/parse/route.ts`** — orchestrates the above and returns either a
   result or a clean error.
5. **`app/page.tsx`** — upload UI and results tables.

### Why an LLM instead of OCR

A transcript is a layout problem, not just a text problem (term headers, credit
columns, grade columns). A vision LLM reads the structure in one step and copes
with phone photos and odd layouts far better than OCR → regex. The cost is that
reading can be slightly fuzzy — which is exactly why the math is kept out of it.

### Correctness

The grade scale and the GPA formula live in code, never in the prompt:

- `lib/gradeScale.ts` — the fixed A=4.0 … F=0.0 table, plus the set of
  non-GPA grades (Pass/Fail, W, etc.).
- GPA = `sum(gradePoints × credits) / sum(credits)`, over GPA-bearing courses,
  rounded to 2 decimals.

`lib/gpa.test.ts` runs the brief's worked example end-to-end and asserts the
exact expected numbers — **13 GPA credits, 39.3 quality points, GPA 3.02** —
plus edge cases (Pass excluded, letter `F` counts as 0.0, credit-weighted
cumulative GPA across terms, unknown grades flagged not dropped).

### Requirements covered

- Per-term and cumulative GPA ✔
- Pass/Fail and Withdrawn shown but excluded from the GPA ✔ (greyed in the UI)
- Exact formula, rounded to 2 dp ✔
- Unreadable / non-transcript files → clear error, never a crash or wrong number
  ✔ (the model returns `isTranscript: false` with a reason; bad uploads, oversized
  files, corrupt PDFs, malformed model output and API failures all map to friendly
  messages)
- Multi-page transcripts spanning several years in one file ✔ (all pages go to
  the model together and terms are merged) — this was the chosen optional extra.

## What I'd improve with more time

- **A confidence / review step.** Let the user eyeball and correct the extracted
  table before trusting the number — parsing is the only fuzzy link in the chain.
- **More grading scales** (UK / ECTS / percentage) — the math layer is already
  scale-agnostic; it just needs more tables and a detection step.
- **Caching / cost control** — hash the file so re-uploads don't re-call the API.
- **Parser tests with fixture images** and a broader transcript-format corpus.
- **Streaming progress** for large multi-page PDFs.

## What I cut (to keep the core clean within ~4 hours)

- The "what-if" target-GPA calculator (built the multi-page extra instead).
- Multi-scale support beyond the spec's scale.
- Auth and persistence — it's stateless; nothing is stored between uploads.
- Heavier UI polish; styling is deliberately minimal.
```

## Project layout

```
app/
  page.tsx              upload UI + results tables
  api/parse/route.ts    upload → parse → compute → JSON
  layout.tsx, globals.css
lib/
  gradeScale.ts         fixed grade table + grade classification
  schema.ts             Zod schemas for the parser output
  parser.ts             OpenAI vision call (raw transcription only)
  pdf.ts                PDF pages → PNG data URLs
  gpa.ts                pure GPA math
  gpa.test.ts           tests (worked example + edge cases)
```
