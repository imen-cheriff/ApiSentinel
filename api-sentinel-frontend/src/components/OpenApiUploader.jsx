import { useEffect, useRef, useState } from "react";
import api from "../services/api";
import { useTabNotification } from "../hooks/useTabNotification";

const STEPS = [
  { label: "Reading OpenAPI file…", phase: 0 },
  { label: "Running AI audit (Gemini)…", phase: 1 },
  { label: "Correlating with OWASP API Top 10…", phase: 1 },
  { label: "Generating report…", phase: 2 },
];

function maxStepForPhase(ph) {
  if (ph === 0) return 0;
  if (ph === 1) return 2;
  return STEPS.length - 1;
}

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
  const [phase, setPhase] = useState(0);
  const [displayStep, setDisplayStep] = useState(0);
  const phaseRef = useRef(0);
  const { notify, requestPermissionIfNeeded } = useTabNotification();

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    if (!isUploading) return;
    setElapsedMs(0);
    const t0 = Date.now();
    const clock = setInterval(() => setElapsedMs(Date.now() - t0), 250);
    return () => clearInterval(clock);
  }, [isUploading]);

  useEffect(() => {
    if (!isUploading) return;
    if (phase >= 2) {
      setDisplayStep(STEPS.length - 1);
      return;
    }
    const target = Math.min(timeStepForElapsed(elapsedMs), maxStepForPhase(phase));
    setDisplayStep(target);
  }, [isUploading, elapsedMs, phase]);

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
    if (!/\.(json|ya?ml)$/i.test(file.name)) {
      setError("Only .json, .yaml or .yml files are accepted");
      return;
    }

    requestPermissionIfNeeded();

    setError(null);
    setFileName(file.name);
    setIsUploading(true);
    setPhase(0);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const importRes = await api.post("/api/projects/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const project = importRes.data;

      setPhase(1);
      const auditRes = await api.post(`/api/projects/${project.id}/audit`);

      setPhase(2);
      await new Promise((r) => setTimeout(r, 400));

      notify({
        title: "Audit terminé ✅",
        body: `${project.projectName} — analyse OWASP prête à consulter.`,
      });

      setIsUploading(false);
      onUploadSuccess({ project, auditResult: auditRes.data });
    } catch (err) {
      const code = err.response?.data?.code;
      let errorMessage;
      if (code === "QUOTA_EXCEEDED") {
        errorMessage = "Quota Gemini quotidien épuisé, réessayez plus tard.";
      } else {
        errorMessage =
          err.response?.data?.message ||
          (phaseRef.current === 0
            ? "Import failed. Please check your file and try again."
            : "AI audit failed. Please try again.");
      }
      setError(errorMessage);
      notify({
        title: "Analyse échouée ❌",
        body: errorMessage,
        blinkText: "Échec de l'analyse",
      });
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
      className={`relative mx-auto w-full max-w-[760px] overflow-hidden rounded-[28px] text-center transition-all duration-250 ${isUploading ? "p-8 md:p-10" : "p-8 md:p-14"} ${
        isUploading
          ? "border border-blue-200/80 bg-gradient-to-br from-blue-50/90 via-white to-blue-50/80 shadow-[0_20px_45px_rgba(59,130,246,0.10),0_0_0_1px_rgba(59,130,246,0.08)]"
          : isDragging
            ? "border border-blue-400 bg-gradient-to-br from-blue-50 via-white to-blue-100/80 shadow-[0_18px_40px_rgba(59,130,246,0.14),0_0_0_1px_rgba(59,130,246,0.18)]"
            : "border border-dashed border-blue-300/80 bg-gradient-to-br from-white/80 via-blue-50/50 to-blue-100/30 shadow-[0_12px_30px_rgba(59,130,246,0.06)] hover:border-blue-400 hover:shadow-[0_18px_40px_rgba(59,130,246,0.10)]"
      }`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.10),transparent_58%)]" />

      {/* HUD corner brackets */}
      <span className={cornerClasses("top-0 left-0 rounded-tl-xl border-r-0 border-b-0", isDragging || isUploading)} />
      <span className={cornerClasses("top-0 right-0 rounded-tr-xl border-l-0 border-b-0", isDragging || isUploading)} />
      <span className={cornerClasses("bottom-0 left-0 rounded-bl-xl border-r-0 border-t-0", isDragging || isUploading)} />
      <span className={cornerClasses("bottom-0 right-0 rounded-br-xl border-l-0 border-t-0", isDragging || isUploading)} />

      {/* scanning sweep */}
      <div
        className="absolute left-0 right-0 h-16 -top-14 pointer-events-none animate-[sweep_4.5s_linear_infinite]"
        style={{
          background:
            "linear-gradient(180deg, transparent, rgba(59,130,246,0.10), transparent)",
        }}
      />

      {isUploading ? (
        <div className="relative z-10 text-left">
          <div className="flex items-start justify-between gap-4 mb-2">
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
                  className={`flex items-center gap-2.5 text-xs transition-colors duration-300 ${done
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

          <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-700 transition-all duration-500 ease-out"
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
        <div className="relative z-10 flex flex-col items-center justify-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 ring-1 ring-blue-200/80 shadow-inner shadow-blue-200/50">
            <svg
              className="h-8 w-8 text-blue-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            >
              <path d="M12 3v12" strokeLinecap="round" />
              <path d="M7 8l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
              <path
                d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <p className="max-w-[520px] text-sm font-medium text-slate-700 md:text-[15px]">
            Drag and drop your OpenAPI / Swagger file (.json, .yaml, .yml) here
          </p>
          <p className="my-3 text-xs text-slate-500">or</p>

          <input
            type="file"
            accept=".json,.yaml,.yml"
            onChange={handleFileInput}
            className="hidden"
            id="file-input"
          />
          <label
            htmlFor="file-input"
            className="cursor-pointer text-sm font-medium text-blue-600 transition-colors duration-200 hover:text-blue-700"
          >
            click to browse
          </label>
        </div>
      )}

      {error && (
        <p className="relative z-10 mt-4 text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}

function cornerClasses(position, active) {
  return `absolute w-3.5 h-3.5 border-[1.5px] transition-colors duration-200 ${position} ${active ? "border-blue-500" : "border-blue-300"
    }`;
}

export default OpenApiUploader;