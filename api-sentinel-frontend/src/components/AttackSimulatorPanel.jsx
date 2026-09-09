import { useState, useEffect } from "react";
import { Swords, ArrowRight, Bookmark, RotateCcw, Copy, Check } from "lucide-react";
import { simulateAttack } from "../services/api";
import { getErrorMessage } from "../services/apiErrors";

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

// Renders pre-formatted JSON with one colored <span> per line.
function JsonBlock({ text }) {
  return text.split("\n").map((line, i) => (
    <span key={i} className="block">
      {line.length > 0 ? <JsonLine text={line} /> : "\u00A0"}
    </span>
  ));
}

// Token coloring for a curl command line: the "curl" keyword, flags
// (-X, -H, --data, ...), the HTTP method, and quoted strings.
function CurlLine({ text }) {
  const tokens = text.match(/"(?:\\.|[^"\\])*"|\S+|\s+/g) || [text];
  return tokens.map((tok, i) => {
    if (/^\s+$/.test(tok)) return tok;
    if (/^".*"$/.test(tok)) {
      return (
        <span key={i} className="text-emerald-700">
          {tok}
        </span>
      );
    }
    if (tok === "curl") {
      return (
        <span key={i} className="text-sky-700 font-semibold">
          {tok}
        </span>
      );
    }
    if (/^--?[A-Za-z-]+$/.test(tok)) {
      return (
        <span key={i} className="text-purple-700">
          {tok}
        </span>
      );
    }
    if (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(tok)) {
      return (
        <span key={i} className="text-amber-700">
          {tok}
        </span>
      );
    }
    return tok;
  });
}

// Renders a (possibly multi-line) curl command with one colored line per row.
function CurlBlock({ text }) {
  return text.split("\n").map((line, i) => (
    <span key={i} className="block">
      {line.length > 0 ? <CurlLine text={line} /> : "\u00A0"}
    </span>
  ));
}

export default function AttackSimulatorPanel({ projectId, finding }) {
  const storageKey = `attack-simulator:${projectId ?? "default"}:${finding?.id ?? "default"}`;

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [copied, setCopied] = useState(false);

  // Whenever the selected finding changes, forget the previous finding's
  // result/error and load whatever was saved for THIS finding (if anything).
  // Without this, switching routes kept showing the last finding's simulation.
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

  const runSimulation = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await simulateAttack(projectId, finding);
      setResult(data);
      setSavedAt(null); // a fresh, unsaved run
    } catch (err) {
      console.error("simulateAttack failed:", err);
      setError(getErrorMessage(err, "Failed to run simulation. Try again."));
    } finally {
      setLoading(false);
    }
  };

  const copyRequest = async () => {
    if (!result?.attackerRequest) return;
    const textToCopy = formatJson(result.attackerRequest);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        // Fallback for non-secure contexts / older browsers where
        // navigator.clipboard is unavailable and writeText throws.
        const textarea = document.createElement("textarea");
        textarea.value = textToCopy;
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

  // Some backend/AI responses come back pretty-printed, others compact —
  // normalize to a consistently-indented string so the UI never looks
  // inconsistent from one route to the next.
  const formatJson = (value) => {
    if (value == null) return "";
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    if (typeof value === "string") {
      try {
        return JSON.stringify(JSON.parse(value), null, 2);
      } catch {
        return value; // not valid JSON — show as-is
      }
    }
    return String(value);
  };

  const handleSave = () => {
    const now = new Date();
    try {
      localStorage.setItem(storageKey, JSON.stringify({ result, savedAt: now.toISOString() }));
      setSavedAt(now);
    } catch (err) {
      console.error("Failed to save simulation:", err);
    }
  };

  if (!finding) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-sm text-gray-500">
        Select a finding to simulate an attack.
      </div>
    );
  }

  return (
    <div className="min-w-0 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <Swords size={18} className="text-blue-600" />
          Attack Path
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
              onClick={runSimulation}
            >
              <RotateCcw size={14} /> Regenerate
            </button>
          </div>
        )}
      </div>

      {!result && (
        <p className="text-sm text-gray-600">
          Generate an AI walkthrough of how this finding could be exploited — scenario,
          example request, example response, blast radius.
        </p>
      )}

      {!result && !loading && (
        <button
          onClick={runSimulation}
          className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-blue-700"
        >
          <ArrowRight size={14} /> Generate attack path
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
          <p className="text-sm text-blue-600">Building attack path…</p>
          <div className="h-1.5 bg-gray-100 rounded overflow-hidden">
            <div className="h-full w-2/3 bg-blue-500 animate-pulse rounded" />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <>
          <p className="text-xs text-gray-500 italic">
            Illustrative scenario generated by AI — no request was actually sent.
          </p>

          <section>
            <h3 className="text-xs font-semibold text-blue-600 tracking-wide mb-2">
              ATTACK SCENARIO
            </h3>
            <p className="text-sm text-gray-800 leading-relaxed break-words">{result.scenario}</p>
          </section>

          <section className="min-w-0">
            <h3 className="text-xs font-semibold text-blue-600 tracking-wide mb-2">
              EXAMPLE REQUEST
            </h3>
            <pre className="bg-sky-50/70 border border-sky-100 text-slate-700 text-xs rounded-lg p-4 whitespace-pre-wrap break-all font-mono">
              <CurlBlock text={formatJson(result.attackerRequest)} />
            </pre>
            <button
              onClick={copyRequest}
              className="mt-2 flex items-center gap-1.5 rounded-md bg-blue-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-blue-700"
            >
              {copied ? (
                <>
                  <Check size={14} /> Copied
                </>
              ) : (
                <>
                  <Copy size={14} /> Copy request
                </>
              )}
            </button>
          </section>

          <section className="min-w-0">
            <h3 className="text-xs font-semibold text-blue-600 tracking-wide mb-2">
              AI-GENERATED EXAMPLE RESPONSE
            </h3>
            <pre className="bg-sky-50/70 border border-sky-100 text-slate-700 text-xs rounded-lg p-4 whitespace-pre-wrap break-all font-mono">
              <JsonBlock text={formatJson(result.simulatedResponse)} />
            </pre>
          </section>

          <section>
            <h3 className="text-xs font-semibold text-blue-600 tracking-wide mb-2">
              BLAST RADIUS
            </h3>
            <ul className="space-y-1.5">
              {result.blastRadius.map((item, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-800 break-words">
                  <span className="text-blue-600 shrink-0">●</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}