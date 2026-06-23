"use client";

import { useRef, useState } from "react";
import type { GpaResult } from "@/lib/gpa";

type ApiResponse = { result: GpaResult; pageCount: number };

function fmt(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pick(f: File | null) {
    setFile(f);
    setData(null);
    setError(null);
  }

  async function submit() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/parse", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Something went wrong.");
      } else {
        setData(json);
      }
    } catch {
      setError("Network error — is the dev server running?");
    } finally {
      setLoading(false);
    }
  }

  const result = data?.result;

  return (
    <main className="wrap">
      <h1>Transcript GPA Calculator</h1>
      <p className="sub">
        Upload a transcript (PDF or image). It reads the courses and grades,
        then computes your GPA per term and overall.
      </p>

      <div
        className={`drop${dragOver ? " over" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pick(e.dataTransfer.files?.[0] ?? null);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
        <div>📄 Click to choose a file, or drag it here</div>
        <div className="hint">PDF, PNG, or JPG · up to 15 MB</div>
        {file && <div className="filename">Selected: {file.name}</div>}
      </div>

      <button className="btn" disabled={!file || loading} onClick={submit}>
        {loading ? "Reading transcript…" : "Calculate GPA"}
      </button>

      {error && <div className="error">⚠️ {error}</div>}

      {result && (
        <>
          <div className="summary">
            <span className="big">
              {result.cumulativeGpa !== null ? fmt(result.cumulativeGpa) : "—"}
            </span>
            <span className="label">
              cumulative GPA · {result.cumulativeGpaCredits} GPA credits
              {data && data.pageCount > 1 ? ` · ${data.pageCount} pages` : ""}
            </span>
          </div>

          {result.hasUnknownGrades && (
            <div className="warn">
              Some grades weren&apos;t recognized and were excluded from the GPA.
              They&apos;re marked below — double-check them against your
              transcript.
            </div>
          )}

          {result.terms.map((term, i) => (
            <div className="term" key={i}>
              <h3>
                <span>{term.name}</span>
                <span className="gpa">
                  {term.gpa !== null ? `GPA ${fmt(term.gpa)}` : "no GPA"}
                </span>
              </h3>
              <table>
                <thead>
                  <tr>
                    <th>Course</th>
                    <th className="num">Credits</th>
                    <th className="num">Grade</th>
                    <th className="num">Quality pts</th>
                  </tr>
                </thead>
                <tbody>
                  {term.courses.map((c, j) => (
                    <tr key={j} className={c.counts ? "" : "excluded"}>
                      <td>
                        {c.code}
                        {c.title ? ` — ${c.title}` : ""}
                        {!c.counts && !c.unknownGrade && (
                          <span className="tag">excluded</span>
                        )}
                        {c.unknownGrade && (
                          <span className="tag unknown">unknown grade</span>
                        )}
                      </td>
                      <td className="num">{c.credits}</td>
                      <td className="num">{c.grade}</td>
                      <td className="num">
                        {c.qualityPoints !== null
                          ? c.qualityPoints.toFixed(1)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
    </main>
  );
}
