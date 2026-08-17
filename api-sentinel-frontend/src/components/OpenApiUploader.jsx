import { useEffect, useRef, useState } from "react";
import api from "../services/api";

// Real pipeline, in order. Each step is tied to an actual phase of work —
// no fixed fake timers deciding when we're "done".
//   phase 0 -> POST /api/projects/import   (parse the OpenAPI file)
//   phase 1 -> POST /api/projects/:id/audit (Gemini AI audit, can take up to ~1min)
//   phase 2 -> both calls resolved, about to navigate
const STEPS = [
  { label: "Reading OpenAPI file…", phase: 0 },
  { label: "Running AI audit (Gemini)…", phase: 1 },
  { label: "Correlating with OWASP API Top 10…", phase: 1 },
  { label: "Generating report…", phase: 2 },
];

// The checklist is allowed to visually crawl through the steps that belong
// to the phase currently in flight, but never past it — the "Generating
// report" step (phase 2) only becomes reachable once the audit call has
// truly resolved.
function maxStepForPhase(ph) {
  if (ph === 0) return 0; // import in flight -> only step 0 belongs here
  if (ph === 1) return 2; // audit in flight -> may crawl through steps 1-2
  return STEPS.length - 1; // both calls resolved -> final step
}

// Progressive pacing for the audit phase (~40s in practice): checkpoint 1
// ticks off around 5s, checkpoint 2 around 15s, checkpoint 3 around 25s.
// The final checkpoint ("Generating report") is NOT time-based — it appears
// the instant the real audit call resolves (phase becomes 2).
const CHECKPOINT_TIMES_MS = [5000, 15000, 25000];

function timeStepForElapsed(ms) {
  if (ms < CHECKPOINT_TIMES_MS[0]) return 0;
  if (ms < CHECKPOINT_TIMES_MS[1]) return 1;
  if (ms < CHECKPOINT_TIMES_MS[2]) return 2;
  return 3;
}

function formatElapsed(ms) {
  const totalSec = Math.floor(ms / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function OpenApiUploader({ onUploadSuccess }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [phase, setPhase] = useState(0); // 0 = importing, 1 = auditing, 2 = done
  const [displayStep, setDisplayStep] = useState(0);
  const phaseRef = useRef(0);
  const resultsRef = useRef({ project: null, auditResult: null });

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Real elapsed-time clock, running for as long as we're actually waiting.
  useEffect(() => {
    if (!isUploading) return;
    setElapsedMs(0);
    const t0 = Date.now();
    const clock = setInterval(() => setElapsedMs(Date.now() - t0), 250);
    return () => clearInterval(clock);
  }, [isUploading]);

  // Drive the checklist from real elapsed time, following the requested
  // pacing (0-5s / 5-15s / 15-25s), but never further than what the real
  // phase has actually reached. The last step is the exception: as soon as
  // the audit genuinely resolves (phase 2), jump straight to it.
  useEffect(() => {
    if (!isUploading) return;
    if (phase >= 2) {
      setDisplayStep(STEPS.length - 1);
      return;
    }
    const target = Math.min(timeStepForElapsed(elapsedMs), maxStepForPhase(phase));
    setDisplayStep(target);
  }, [isUploading, elapsedMs, phase]);

  // Once the checklist has visually caught up to the final step AND both
  // real API calls have genuinely resolved, hand off to the dashboard.
  useEffect(() => {
    if (phase !== 2 || displayStep !== STEPS.length - 1) return;
    if (!resultsRef.current.auditResult) return;
    const t = setTimeout(() => {
      onUploadSuccess(resultsRef.current);
      setIsUploading(false);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, displayStep]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  };

  const processFile = async (file) => {
    if (!file.name.endsWith(".json")) {
      setError("Only .json files are accepted");
      return;
    }

    setError(null);
    setFileName(file.name);
    setIsUploading(true);
    setPhase(0);

    const formData = new FormData();
    formData.append("file", file);

    try {
      // Step 1: import + parse the spec. We stay on this page and wait for
      // the real response — no artificial delay.
      const importRes = await api.post("/api/projects/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const project = importRes.data;

      // Step 2: run the real AI audit. This can take up to ~1 minute — we
      // keep showing progress here instead of navigating away first.
      setPhase(1);
      const auditRes = await api.post(`/api/projects/${project.id}/audit`);

      // Both real calls are done now.
      resultsRef.current = { project, auditResult: auditRes.data };
      setPhase(2);
      await new Promise((r) => setTimeout(r, 400)); // let the "done" tick register visually

      onUploadSuccess({ project, auditResult: auditRes.data });
    } catch (err) {
      setError(
        phaseRef.current === 0
          ? "Import failed. Please check your file and try again."
          : "AI audit failed. Please try again."
      );
      setIsUploading(false);
    }
  };

  const allDone = phase >= 2 && displayStep === STEPS.length - 1;
  const headerLabel = allDone ? "Analysis complete" : STEPS[displayStep].label;
  const progressPct = Math.min(100, ((displayStep + 1) / STEPS.length) * 100);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative rounded-2xl text-center overflow-hidden transition-all duration-200 ${
        isUploading ? "p-10" : "p-14"
      } ${
        isUploading
          ? "border border-blue-200 bg-blue-50/90 shadow-[0_0_0_1px_rgba(29,78,216,0.06)]"
          : isDragging
            ? "border border-blue-500 bg-blue-50 shadow-[0_0_0_1px_rgba(29,78,216,0.2),0_0_32px_rgba(29,78,216,0.12)]"
            : "border border-dashed border-blue-200 bg-white/80 hover:border-blue-400 hover:-translate-y-0.5 backdrop-blur-sm"
      }`}
    >
      {/* HUD corner brackets */}
      <span className={cornerClasses("top-0 left-0 rounded-tl-md border-r-0 border-b-0", isDragging || isUploading)} />
      <span className={cornerClasses("top-0 right-0 rounded-tr-md border-l-0 border-b-0", isDragging || isUploading)} />
      <span className={cornerClasses("bottom-0 left-0 rounded-bl-md border-r-0 border-t-0", isDragging || isUploading)} />
      <span className={cornerClasses("bottom-0 right-0 rounded-br-md border-l-0 border-t-0", isDragging || isUploading)} />

      {/* scanning sweep */}
      <div
        className="absolute left-0 right-0 h-16 -top-16 pointer-events-none animate-[sweep_4.5s_linear_infinite]"
        style={{
          background:
            "linear-gradient(180deg, transparent, rgba(29,78,216,0.08), transparent)",
        }}
      />

      {isUploading ? (
        <div className="relative z-10 text-left">
          <div className="flex items-start justify-between gap-4 mb-1">
            <div className="flex items-center gap-2.5 min-w-0">
              {!allDone ? (
                <svg
                  className="w-4 h-4 shrink-0 text-blue-600 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-20"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <path
                    d="M22 12a10 10 0 0 0-10-10"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4 shrink-0 text-blue-600"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    d="M3 8.5l3.5 3.5L13 4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              <p className="text-sm font-medium text-blue-800 truncate">
                {headerLabel}
              </p>
            </div>
            <span className="text-xs tabular-nums text-blue-500 shrink-0 pt-0.5 font-medium">
              {formatElapsed(elapsedMs)}
            </span>
          </div>

          {fileName && (
            <p className="text-[11px] text-blue-400/80 mb-5 ml-7 truncate">
              {fileName}
            </p>
          )}

          <ul className="space-y-2.5 mb-6">
            {STEPS.map((step, i) => {
              const done = i < displayStep || allDone;
              const active = i === displayStep && !allDone;
              return (
                <li
                  key={step.label}
                  className={`flex items-center gap-2.5 text-xs transition-colors duration-300 ${
                    done
                      ? "text-blue-700"
                      : active
                        ? "text-blue-600"
                        : "text-blue-300"
                  }`}
                >
                  {done ? (
                    <svg
                      className="w-3.5 h-3.5 shrink-0 text-blue-600"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        d="M3 8.5l3.5 3.5L13 4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : active ? (
                    <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center text-[10px] leading-none text-blue-500">
                      –
                    </span>
                  ) : (
                    <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center text-[10px] leading-none text-blue-200">
                      –
                    </span>
                  )}
                  <span>{step.label}</span>
                </li>
              );
            })}
          </ul>

          <div className="h-0.5 bg-blue-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-500 ease-out"
              style={{ width: `${Math.max(progressPct, 8)}%` }}
            />
          </div>

          {phase === 1 && (
            <p className="text-[10px] text-blue-400 mt-4 text-center">
              The AI audit can take up to a minute.
            </p>
          )}
        </div>
      ) : (
        <div className="relative z-10">
          <svg
            className="w-10 h-10 mx-auto mb-4 text-blue-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          >
            <path d="M12 3v12" strokeLinecap="round" />
            <path d="M7 8l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
            <path
              d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <p className="text-slate-700 text-sm font-medium mb-1">
            Drag and drop your OpenAPI / Swagger file (.json) here
          </p>
          <p className="text-slate-600 text-xs mb-3">or</p>

          <input
            type="file"
            accept=".json"
            onChange={handleFileInput}
            className="hidden"
            id="file-input"
          />
          <label
            htmlFor="file-input"
            className="text-blue-600 text-sm cursor-pointer border-b border-blue-300 pb-0.5 hover:text-blue-700 hover:border-blue-500 transition-colors"
          >
            click to browse
          </label>
        </div>
      )}

      {error && (
        <p className="relative z-10 text-red-500 text-xs mt-4">{error}</p>
      )}
    </div>
  );
}

function cornerClasses(position, active) {
  return `absolute w-3.5 h-3.5 border-[1.5px] transition-colors duration-200 ${position} ${
    active ? "border-blue-500" : "border-blue-300"
  }`;
}

export default OpenApiUploader;