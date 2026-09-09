import { useState, useEffect, useMemo } from "react";
import { Wrench, Bookmark, RotateCcw, Copy, Check, Download, Info } from "lucide-react";
import { generateAutoFixPatch } from "../services/api";
import { getErrorMessage } from "../services/apiErrors";
import { cn } from "../lib/utils";

// Simple LCS-based line diff. Specs are short (tens of lines), so an
// O(m*n) table is plenty fast and keeps this dependency-free.
function diffLines(oldStr, newStr) {
  const oldLines = (oldStr ?? "").split("\n");
  const newLines = (newStr ?? "").split("\n");
  const m = oldLines.length;
  const n = newLines.length;

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] =
        oldLines[i] === newLines[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const rows = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) {
      rows.push({ type: "context", text: oldLines[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ type: "removed", text: oldLines[i] });
      i++;
    } else {
      rows.push({ type: "added", text: newLines[j] });
      j++;
    }
  }
  while (i < m) {
    rows.push({ type: "removed", text: oldLines[i] });
    i++;
  }
  while (j < n) {
    rows.push({ type: "added", text: newLines[j] });
    j++;
  }
  return rows;
}

// Light, dependency-free JSON token coloring for a single line.
function JsonLine({ text }) {
  const keyMatch = text.match(/^(\s*)("(?:\\.|[^"\\])*")(\s*:\s*)(.*)$/);
  if (keyMatch) {
    const [, indent, key, colon, rest] = keyMatch;
    return (
      <>
        {indent}
        <span className="text-sky-700">{key}</span>
        <span className="text-gray-400">{colon}</span>
        <JsonValue text={rest} />
      </>
    );
  }
  return <JsonValue text={text} />;
}

function JsonValue({ text }) {
  const trailingComma = text.endsWith(",");
  const core = trailingComma ? text.slice(0, -1) : text;
  const trimmed = core.trim();
  let cls = "";
  if (/^".*"$/.test(trimmed)) cls = "text-emerald-700";
  else if (/^(true|false|null)$/.test(trimmed)) cls = "text-purple-700";
  else if (/^-?\d+(\.\d+)?$/.test(trimmed)) cls = "text-amber-700";
  return (
    <>
      <span className={cls}>{core}</span>
      {trailingComma && <span className="text-gray-400">,</span>}
    </>
  );
}

const ROW_BG = {
  added: "bg-emerald-50",
  removed: "bg-red-50",
  context: "",
};

const BORDER_CLASS = {
  gray: "border-gray-100",
  sky: "border-sky-100",
};

// Single <pre> with one <span className="block"> per line, instead of a
// div per row — keeps line-height consistent with no per-row padding, so
// there's no visible gap between lines.
function SpecBlock({ rows, border = "gray" }) {
  return (
    <pre
      className={cn(
        "max-h-96 overflow-y-auto overflow-x-hidden rounded-lg border bg-white p-4",
        "font-mono text-[11px] leading-5 whitespace-pre-wrap break-words text-slate-700",
        BORDER_CLASS[border]
      )}
    >
      {rows.map((row, i) => (
        <span key={i} className={cn("block", ROW_BG[row.type])}>
          {row.text.length > 0 ? <JsonLine text={row.text} /> : "\u00A0"}
        </span>
      ))}
    </pre>
  );
}

function EmptySpecNotice({ finding }) {
  return (
    <div className="flex gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50/60 px-4 py-4 text-xs text-gray-500">
      <Info size={14} className="shrink-0 mt-0.5 text-gray-400" />
      <span>
        No vulnerable snippet is stored for this finding. Audit results currently save only the
        vulnerability, OWASP tag and risk level — not the original OpenAPI operation for{" "}
        <span className="font-mono text-gray-600">
          {finding.method} {finding.path}
        </span>
        — so there's nothing to show or diff against here yet.
      </span>
    </div>
  );
}

export default function AutoFixPatchPanel({ projectId, finding }) {
  const storageKey = `auto-fix-patch:${projectId ?? "default"}:${finding?.id ?? "default"}`;

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setError(null);
    setCopied(false);
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved?.result) {
        setResult(saved.result);
        setSavedAt(saved.savedAt ? new Date(saved.savedAt) : null);
      } else {
        setResult(null);
        setSavedAt(null);
      }
    } catch {
      setResult(null);
      setSavedAt(null);
    }
  }, [storageKey]);

  const hasVulnerable = !!finding?.vulnerableSpecification?.trim();

  const diff = useMemo(() => {
    if (!result?.patchedSpecification) return [];
    if (!hasVulnerable) {
      return result.patchedSpecification.split("\n").map((text) => ({ type: "context", text }));
    }
    return diffLines(finding.vulnerableSpecification, result.patchedSpecification);
  }, [finding?.vulnerableSpecification, result?.patchedSpecification, hasVulnerable]);

  const vulnerableRows = useMemo(() => diff.filter((r) => r.type !== "added"), [diff]);
  const patchedRows = useMemo(() => diff.filter((r) => r.type !== "removed"), [diff]);
  const addedCount = useMemo(() => diff.filter((r) => r.type === "added").length, [diff]);
  const removedCount = useMemo(() => diff.filter((r) => r.type === "removed").length, [diff]);

  const runPatch = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await generateAutoFixPatch(projectId, finding);
      setResult(data);
      setSavedAt(null); // a fresh, unsaved run
    } catch (err) {
      console.error("generateAutoFixPatch failed:", err);
      setError(getErrorMessage(err, "Failed to generate patch. Try again."));
    } finally {
      setLoading(false);
    }
  };

  const copyPatch = async () => {
    if (!result?.patchedSpecification) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(result.patchedSpecification);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = result.patchedSpecification;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
      setError("Couldn't copy to clipboard.");
    }
  };

  const downloadPatch = () => {
    if (!result?.patchedSpecification) return;
    const blob = new Blob([result.patchedSpecification], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const slug = (finding?.path || "patch").replace(/[^\w-]+/g, "_");
    a.download = `${slug}.patched.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSave = () => {
    const now = new Date();
    try {
      localStorage.setItem(storageKey, JSON.stringify({ result, savedAt: now.toISOString() }));
      setSavedAt(now);
    } catch (err) {
      console.error("Failed to save patch:", err);
    }
  };

  if (!finding) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-sm text-gray-500">
        Select a finding to generate a patch.
      </div>
    );
  }

  return (
    <div className="min-w-0 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <Wrench size={18} className="text-blue-600" />
          Auto-Fix Patch
        </h2>

        {result && (
          <div className="flex items-center gap-2 flex-wrap">
            {savedAt && (
              <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 border border-green-200">
                SAVED {savedAt.toLocaleDateString()} {savedAt.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={!!savedAt}
              className="flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white"
            >
              <Bookmark size={13} /> {savedAt ? "Saved" : "Save result"}
            </button>
            <button
              className="flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              onClick={runPatch}
            >
              <RotateCcw size={14} /> Regenerate
            </button>
          </div>
        )}
      </div>

      {!result && (
        <p className="text-sm text-gray-600">
          Get a corrected OpenAPI snippet you can drop straight into the spec, plus how to
          verify it.
        </p>
      )}

      {!result && !loading && (
        <button
          onClick={runPatch}
          className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-blue-700"
        >
          <Wrench size={14} /> Generate patch
        </button>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap bg-sky-50/70 border border-sky-100 rounded-lg px-4 py-3 text-sm">
        <span className="min-w-0 break-words">
          <span className="text-blue-600 font-medium">{finding.method}</span>{" "}
          <span className="font-mono">{finding.path}</span> · {finding.vulnerability}
        </span>
        <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
          {finding.riskLevel}
        </span>
      </div>

      {loading && (
        <div className="space-y-2">
          <p className="text-sm text-blue-600">Drafting the patched spec…</p>
          <div className="h-1.5 bg-gray-100 rounded overflow-hidden">
            <div className="h-full w-2/3 bg-blue-500 animate-pulse rounded" />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <>
          <div className="space-y-4 min-w-0">

            <section className="min-w-0">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-xs font-semibold text-blue-600 tracking-wide">
                  PATCHED SPECIFICATION
                </h3>
                {hasVulnerable && addedCount > 0 && (
                  <span className="text-xs font-mono text-emerald-600">+{addedCount}</span>
                )}
              </div>
              <SpecBlock rows={patchedRows} border="sky" />
            </section>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={copyPatch}
              className="flex items-center gap-1.5 rounded-md bg-blue-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-blue-700"
            >
              {copied ? (
                <>
                  <Check size={14} /> Copied
                </>
              ) : (
                <>
                  <Copy size={14} /> Copy patch
                </>
              )}
            </button>
            <button
              onClick={downloadPatch}
              className="flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <Download size={14} /> Download patched snippet
            </button>
          </div>

          <section>
            <h3 className="text-xs font-semibold text-blue-600 tracking-wide mb-2">
              HOW TO VERIFY
            </h3>
            <ol className="space-y-1.5">
              {(result.verificationSteps || []).map((step, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-800 break-words">
                  <span className="text-blue-600 font-mono shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}