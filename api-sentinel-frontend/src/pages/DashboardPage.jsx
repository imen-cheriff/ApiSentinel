import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import mockAudit from "../mocks/audit-results-scenarios.json";
import { cn } from "../lib/utils";
import { GridPattern } from "../components/GridPattern";
import {
  Shield,
  ShieldAlert,
  Activity,
  Search,
  CheckCircle2,
  ChevronRight,
  Download,
  RotateCw,
  AlertTriangle,
  Layers,
  FileCode2,
  Lock,
  Unlink,
  Eye,
  Server,
  Key,
  Database,
  FileCheck,
  Radar,
  Network,
  Bug,
  X,
} from "lucide-react";

const SEVERITY_COLORS = {
  CRITICAL: "#dc2626",
  HIGH: "#ea580c",
  MEDIUM: "#ca8a04",
  LOW: "#16a34a",
};

const METHOD_COLORS = {
  GET: "#2563eb",
  POST: "#16a34a",
  PUT: "#ea580c",
  DELETE: "#dc2626",
};

const OWASP_COVERAGE = [
  { label: "Broken Object Level Auth", code: "API1:2023", icon: Unlink },
  { label: "Excessive Data Exposure", code: "API3:2023", icon: Eye },
  { label: "Resource Consumption", code: "API4:2023", icon: Server },
  { label: "Broken Function Level Auth", code: "API5:2023", icon: Key },
  { label: "Mass Assignment", code: "API6:2023", icon: Database },
  { label: "Improper Inventory / Logs", code: "API9:2023", icon: FileCheck },
];

/* ---------------- Score Gauge Component ---------------- */
function ScoreGauge({ score, size = 130 }) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg className="size-full -rotate-90 transform" viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="stroke-slate-200"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="stroke-blue-600 transition-all duration-1000 ease-out"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
        />
      </svg>
      <div className="absolute text-center">
        <span className="font-mono text-3xl font-bold tracking-tight text-slate-800">{score}</span>
        <span className="block font-mono text-[10px] text-slate-500">/ 100</span>
      </div>
    </div>
  );
}

/* ---------------- Endpoint Card ---------------- */
function EndpointCard({ endpoint, audit, onClick }) {
  const methodColor = METHOD_COLORS[endpoint.method] || "#64748b";
  const severityColor = audit ? SEVERITY_COLORS[audit.riskLevel] : "#16a34a";
  const riskScore = audit?.riskScore || 0;

  return (
    <div
      onClick={onClick}
      className="group relative cursor-pointer bg-gradient-to-b from-white/95 via-white/85 to-white/75 backdrop-blur-md border border-blue-200/80 rounded-xl p-4 flex flex-col justify-between shadow-[0_4px_20px_-4px_rgba(59,130,246,0.08),inset_0_1px_1px_rgba(255,255,255,0.9)] transition-all duration-300 hover:border-blue-400 hover:shadow-lg hover:-translate-y-0.5"
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className="font-mono text-[10px] font-bold px-2 py-0.5 rounded border"
          style={{
            color: methodColor,
            backgroundColor: `${methodColor}12`,
            borderColor: `${methodColor}30`,
          }}
        >
          {endpoint.method}
        </span>
        {audit ? (
          <span
            className="font-mono text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1"
            style={{
              color: severityColor,
              backgroundColor: `${severityColor}12`,
              borderColor: `${severityColor}30`,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: severityColor }} />
            {audit.riskLevel}
          </span>
        ) : (
          <span className="text-[10px] font-mono text-emerald-600 font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> SECURE
          </span>
        )}
      </div>

      <div className="space-y-1 mb-3">
        <h4 className="font-mono text-xs font-bold text-slate-800 break-all tracking-tight group-hover:text-blue-700 transition-colors">
          {endpoint.path}
        </h4>
        <p className="text-[11px] text-slate-500 font-mono line-clamp-2">
          {audit ? audit.vulnerability : endpoint.summary || "Aucune vulnérabilité directe détectée."}
        </p>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap mb-4">
        {(audit?.owaspCodes || ["API1:2023", "API3:2023"]).map((code) => (
          <span
            key={code}
            className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100/80 border border-slate-200 text-slate-600"
          >
            {code}
          </span>
        ))}
      </div>

      <div className="space-y-3">
        <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${riskScore || (audit ? 75 : 10)}%`,
              backgroundColor: severityColor,
            }}
          />
        </div>

        <div className="border-b border-slate-200/60" />

        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
          <span>{audit ? `2 findings · risque ${riskScore}/100` : "0 findings · sécurisé"}</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
        </div>
      </div>
    </div>
  );
}

/* ---------------- Modal Pop-up Component ---------------- */
function EndpointModal({ endpoint, audit, onClose }) {
  if (!endpoint) return null;

  const methodColor = METHOD_COLORS[endpoint.method] || "#64748b";
  const riskLevel = audit?.riskLevel || "INFO";
  const sevColor = SEVERITY_COLORS[riskLevel] || "#64748b";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl rounded-2xl border border-blue-200/80 bg-white/95 backdrop-blur-md p-6 text-slate-800 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <X className="size-4" />
        </button>

        {/* Modal Header */}
        <div className="space-y-3 pr-8">
          <div className="flex items-center gap-3 font-mono text-xs">
            <span
              className="rounded border px-2 py-0.5 font-bold tracking-wider"
              style={{
                color: methodColor,
                backgroundColor: `${methodColor}15`,
                borderColor: `${methodColor}30`,
              }}
            >
              {endpoint.method}
            </span>
            <span className="text-slate-500 uppercase tracking-wider text-[11px] font-bold">
              {audit ? "1 VULNÉRABILITÉ DÉTECTÉE" : "0 VULNÉRABILITÉS DÉTECTÉES"}
            </span>
          </div>

          <h2 className="font-mono text-base font-bold tracking-tight text-slate-900 break-all">
            {endpoint.path}
          </h2>
        </div>

        {/* Modal Body */}
        <div className="mt-5 space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          {audit ? (
            <div className="rounded-xl border border-blue-200/80 bg-slate-50/80 p-5 space-y-4 shadow-sm">
              {/* Header Info */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    {audit.vulnerability}
                  </h3>
                  <span className="font-mono text-[11px] text-slate-500">
                    {audit.owaspCategory}
                  </span>
                </div>

                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] tracking-wider uppercase font-bold shrink-0"
                  style={{
                    color: sevColor,
                    backgroundColor: `${sevColor}15`,
                    borderColor: `${sevColor}40`,
                  }}
                >
                  <span className="size-1.5 rounded-full bg-current animate-pulse" />
                  {audit.riskLevel}
                </span>
              </div>

              {/* Description */}
              <p className="text-xs leading-relaxed text-slate-600 font-sans">
                {audit.description}
              </p>

              {/* Remediation */}
              {audit.remediation && (
                <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3.5 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-mono text-[10px] font-bold text-emerald-800 tracking-wider uppercase">
                    <CheckCircle2 className="size-3.5 text-emerald-600" /> RECOMMANDATION
                  </div>
                  <p className="pl-5 leading-relaxed text-emerald-950 font-sans">
                    {audit.remediation}
                  </p>
                </div>
              )}

              {/* Test Scenario Details */}
              {audit.testScenario && (
                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3.5 text-xs space-y-2">
                  <div className="flex items-center justify-between font-mono text-[10px] font-bold text-blue-900 tracking-wider uppercase">
                    <span>SCÉNARIO DE TEST : {audit.testScenario.title}</span>
                    <span className="text-blue-700">
                      STATUT ATTENDU: {audit.testScenario.expectedStatusOnSuccess}
                    </span>
                  </div>

                  {audit.testScenario.steps && (
                    <ul className="list-disc list-inside space-y-1 text-slate-700 font-sans pl-1">
                      {audit.testScenario.steps.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ul>
                  )}

                  {audit.testScenario.payloadExample && (
                    <div className="mt-2">
                      <span className="block font-mono text-[10px] text-slate-500 mb-1">
                        EXEMPLE DE PAYLOAD:
                      </span>
                      <pre className="p-2 bg-slate-900 text-slate-100 rounded text-[11px] font-mono overflow-x-auto whitespace-pre-wrap">
                        {audit.testScenario.payloadExample}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 text-xs font-mono">
              Aucune vulnérabilité ou audit disponible pour cette route.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Format Relative Time ---------------- */
function formatRelativeTime(timestamp) {
  if (!timestamp) return "À l'instant";

  // Standardize SQL format "YYYY-MM-DD HH:MM:SS" into ISO format "YYYY-MM-DDTHH:MM:SS"
  const isoString = typeof timestamp === "string" ? timestamp.replace(" ", "T") : timestamp;
  const date = new Date(isoString);

  if (isNaN(date.getTime())) return "À l'instant";

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 5) return "À l'instant";
  if (diffInSeconds < 60) return `il y a ${diffInSeconds} sec`;

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `il y a ${diffInMinutes} min`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `il y a ${diffInHours} h`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `il y a ${diffInDays} j`;

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `il y a ${diffInMonths} mois`;

  const diffInYears = Math.floor(diffInDays / 365);
  return `il y a ${diffInYears} an${diffInYears > 1 ? "s" : ""}`;
}

/* ---------------- Main Dashboard Page ---------------- */
function DashboardPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState(null);
  const [methodFilter, setMethodFilter] = useState(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);

  useEffect(() => {
    api.get(`/api/projects/${projectId}`).then((res) => setProject(res.data));
  }, [projectId]);

  if (!project) {
    return (
      <div className="min-h-screen bg-[#eef2f8] flex flex-col items-center justify-center font-mono text-slate-500 gap-3">
        <Activity className="w-6 h-6 animate-spin text-blue-600" />
        <span className="text-xs tracking-wider uppercase">Chargement du Threat Dashboard…</span>
      </div>
    );
  }

  const auditByPath = Object.fromEntries(
    (mockAudit.auditResults || []).map((a) => [a.path, a])
  );

  const filteredEndpoints = (project.endpoints || []).filter((ep) => {
    const audit = auditByPath[ep.path];
    if (search && !ep.path.toLowerCase().includes(search.toLowerCase())) return false;
    if (severityFilter && audit?.riskLevel !== severityFilter) return false;
    if (methodFilter && ep.method !== methodFilter) return false;
    return true;
  });

  const topRiskyEndpoints = (project.endpoints || [])
    .map((ep) => ({ ...ep, audit: auditByPath[ep.path] }))
    .filter((ep) => ep.audit)
    .sort((a, b) => (b.audit?.riskScore || 0) - (a.audit?.riskScore || 0))
    .slice(0, 5);

  return (
    <div className="relative min-h-screen w-full bg-[#eef2f8] text-slate-900 font-mono px-6 py-8 overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none z-0">
        <GridPattern
          width={20}
          height={20}
          x={-1}
          y={-1}
          className={cn(
            "stroke-blue-500/20",
            "[mask-image:linear-gradient(to_bottom_right,white,transparent_40%,transparent_60%,white)]"
          )}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto space-y-5">
        {/* Top Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-blue-200/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/90 border border-blue-200 rounded-lg text-blue-700 shadow-sm">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-blue-800 uppercase">
                  API SENTINEL
                </span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                  SECURITY AUDIT CONSOLE
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 font-bold text-[10px] border border-emerald-500/20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              SCAN TERMINÉ
            </span>
            <button className="px-3 py-1.5 rounded-lg bg-white/90 border border-blue-200 text-slate-700 hover:bg-blue-50 transition-colors flex items-center gap-1.5 shadow-sm text-xs">
              <Download className="w-3.5 h-3.5" /> Exporter
            </button>
            <button
              onClick={() => navigate("/")} // Change "/upload" to your route path if different (e.g. "/import")
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-sm text-xs"
            >
              <RotateCw className="w-3.5 h-3.5" /> Nouvelle analyse
            </button>
          </div>
        </header>

        {/* HERO CARD */}
        <section className="relative overflow-hidden rounded-2xl border border-blue-200/80 bg-gradient-to-b from-white/95 via-white/85 to-white/75 backdrop-blur-md p-6 shadow-[0_4px_20px_-4px_rgba(59,130,246,0.08),inset_0_1px_1px_rgba(255,255,255,0.9)]">
          <div className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-6">
              <ScoreGauge score={mockAudit.globalSecurityScore} size={130} />
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 font-mono text-[11px] font-bold tracking-wider text-blue-600 uppercase">
                  <Radar className="size-3.5 text-blue-600" /> CIBLES ANALYSÉES
                </p>
                <h1 className="font-mono text-xl font-bold tracking-tight text-slate-900">
                  {project.projectName} <span className="text-slate-400 font-normal">· openapi.json</span>
                </h1>
                <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[11px]">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200/80 bg-white/80 px-2.5 py-1 text-slate-600 shadow-sm">
                    {formatRelativeTime(
                      project.scan_date || project.scanDate || project.lastScanDate || mockAudit.scannedAt
                    )}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200/80 bg-white/80 px-2.5 py-1 text-slate-600 shadow-sm">
                    <Lock className="size-3 text-blue-600" /> OWASP API Top 10 · 2023
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-500/10 px-2.5 py-1 font-bold text-blue-700 shadow-sm">
                    <AlertTriangle className="size-3 text-blue-600" /> Action requise
                  </span>
                </div>
              </div>
            </div>

            {/* Target KPI Group */}
            <div className="grid grid-cols-2 divide-x divide-y divide-blue-200/60 overflow-hidden rounded-xl border border-blue-200/80 bg-white/60 sm:grid-cols-4 sm:divide-y-0 shadow-sm">
              <div className="p-4">
                <Network className="size-4 text-blue-600" />
                <p className="mt-3 font-mono text-2xl font-bold tabular-nums text-slate-900">
                  {project.endpoints?.length || 0}
                </p>
                <p className="mt-0.5 font-mono text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                  ROUTES SCANNÉES
                </p>
              </div>

              <div className="p-4">
                <Bug className="size-4 text-blue-600" />
                <p className="mt-3 font-mono text-2xl font-bold tabular-nums text-slate-900">
                  {mockAudit.auditResults?.length || 0}
                </p>
                <p className="mt-0.5 font-mono text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                  VULNÉRABILITÉS
                </p>
              </div>

              <div className="p-4 bg-red-50/20">
                <AlertTriangle className="size-4 text-red-600" />
                <p className="mt-3 font-mono text-2xl font-bold tabular-nums text-red-600">
                  {mockAudit.summary?.criticalRisks || 0}
                </p>
                <p className="mt-0.5 font-mono text-[10px] font-bold tracking-wider text-red-600 uppercase">
                  CRITIQUES
                </p>
              </div>

              <div className="p-4 bg-amber-50/20">
                <Activity className="size-4 text-amber-600" />
                <p className="mt-3 font-mono text-2xl font-bold tabular-nums text-amber-600">94</p>
                <p className="mt-0.5 font-mono text-[10px] font-bold tracking-wider text-amber-600 uppercase">
                  RISQUE MAX
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* THREE CARDS ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="bg-gradient-to-b from-white/95 via-white/85 to-white/75 backdrop-blur-md border border-blue-200/80 rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(59,130,246,0.08),inset_0_1px_1px_rgba(255,255,255,0.9)] flex flex-col justify-between">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                RÉPARTITION PAR SÉVÉRITÉ
              </div>
              <div className="space-y-2 mb-6">
                {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((level) => {
                  const count = mockAudit.summary?.[`${level.toLowerCase()}Risks`] || 0;
                  const totalEndpoints = project.endpoints?.length || 1;
                  return (
                    <div key={level} className="flex items-center gap-3 text-xs">
                      <span className="w-16 font-bold text-[10px]" style={{ color: SEVERITY_COLORS[level] }}>
                        {level}
                      </span>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(count / totalEndpoints) * 100}%`,
                            backgroundColor: SEVERITY_COLORS[level],
                          }}
                        />
                      </div>
                      <span className="w-4 text-right font-bold text-slate-700">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-blue-100/80 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Findings totaux</span>
                <span className="font-bold text-slate-800">8</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Routes affectées</span>
                <span className="font-bold text-slate-800">6/6</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Densité</span>
                <span className="font-bold text-slate-800">1.3 / route</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Correctifs proposés</span>
                <span className="font-bold text-slate-800">8</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-b from-white/95 via-white/85 to-white/75 backdrop-blur-md border border-blue-200/80 rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(59,130,246,0.08),inset_0_1px_1px_rgba(255,255,255,0.9)] flex flex-col justify-between">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-500" /> ROUTES LES PLUS À RISQUE
              </div>
              <div className="divide-y divide-blue-100/80">
                {topRiskyEndpoints.map((ep) => (
                  <div
                    key={ep.id}
                    onClick={() => setSelectedEndpoint(ep)}
                    className="flex items-center justify-between py-2.5 px-1 hover:bg-blue-50/50 cursor-pointer transition-colors rounded-md"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                      <span className="truncate text-slate-700 font-bold text-xs">{ep.path}</span>
                    </div>
                    <span className="font-mono font-bold text-red-600 text-xs ml-2 shrink-0">
                      {ep.audit?.riskScore || 88}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-b from-white/95 via-white/85 to-white/75 backdrop-blur-md border border-blue-200/80 rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(59,130,246,0.08),inset_0_1px_1px_rgba(255,255,255,0.9)] flex flex-col justify-between">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-blue-600" /> COUVERTURE OWASP
              </div>
              <div className="space-y-2">
                {OWASP_COVERAGE.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.code}
                      className="flex items-center justify-between p-2 rounded-xl bg-slate-50/80 border border-slate-200/80 hover:border-blue-300 hover:bg-blue-50/50 transition-all shadow-sm"
                    >
                      <div className="flex items-center gap-2.5 truncate text-slate-700">
                        <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="truncate text-xs font-semibold text-slate-800">{item.label}</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-500 shrink-0">
                        {item.code}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Pipeline Bar */}
        <div className="bg-gradient-to-b from-white/95 via-white/85 to-white/75 backdrop-blur-md border border-blue-200/80 rounded-xl px-5 py-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)]">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-600" /> PIPELINE D'ANALYSE
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <div>
                <div className="font-bold text-slate-800 text-[11px]">Parsing du contrat OpenAPI</div>
                <div className="text-[10px] text-slate-400">{project.endpoints?.length || 0} routes · 18 schémas</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <div>
                <div className="font-bold text-slate-800 text-[11px]">Analyse statique des schémas</div>
                <div className="text-[10px] text-slate-400">42 règles appliquées</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <div>
                <div className="font-bold text-slate-800 text-[11px]">Corrélations OWASP Top 10</div>
                <div className="text-[10px] text-slate-400">{mockAudit.auditResults?.length || 0} findings retenus</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <div>
                <div className="font-bold text-slate-800 text-[11px]">Scoring & priorisation</div>
                <div className="text-[10px] text-slate-400">Score global {mockAudit.globalSecurityScore}/100</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-gradient-to-b from-white/95 via-white/85 to-white/75 backdrop-blur-md border border-blue-200/80 rounded-xl p-3 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un endpoint..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/90 border border-blue-200 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto justify-end">
            <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Filtres:</span>
            {Object.keys(SEVERITY_COLORS).map((level) => {
              const isActive = severityFilter === level;
              return (
                <button
                  key={level}
                  onClick={() => setSeverityFilter(isActive ? null : level)}
                  className="text-[10px] font-bold px-2 py-1 rounded border transition-all"
                  style={{
                    borderColor: isActive ? SEVERITY_COLORS[level] : "#dbeafe",
                    backgroundColor: isActive ? `${SEVERITY_COLORS[level]}15` : "#ffffff",
                    color: isActive ? SEVERITY_COLORS[level] : "#64748b",
                  }}
                >
                  {level}
                </button>
              );
            })}
            <div className="h-4 w-px bg-blue-200 mx-1" />
            {Object.keys(METHOD_COLORS).map((method) => {
              const isActive = methodFilter === method;
              return (
                <button
                  key={method}
                  onClick={() => setMethodFilter(isActive ? null : method)}
                  className="text-[10px] font-bold px-2 py-1 rounded border transition-all"
                  style={{
                    borderColor: isActive ? METHOD_COLORS[method] : "#dbeafe",
                    backgroundColor: isActive ? `${METHOD_COLORS[method]}15` : "#ffffff",
                    color: isActive ? METHOD_COLORS[method] : "#64748b",
                  }}
                >
                  {method}
                </button>
              );
            })}
            <span className="text-[10px] text-slate-400 ml-2 font-bold">
              {filteredEndpoints.length}/{project.endpoints?.length || 0} routes
            </span>
          </div>
        </div>

        {/* 3-Column Endpoint Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEndpoints.map((endpoint) => (
            <EndpointCard
              key={endpoint.id}
              endpoint={endpoint}
              audit={auditByPath[endpoint.path]}
              onClick={() => setSelectedEndpoint(endpoint)}
            />
          ))}
        </div>

        {filteredEndpoints.length === 0 && (
          <div className="text-center py-12 border border-dashed border-blue-200 rounded-xl bg-white/40">
            <FileCode2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-600">Aucun endpoint ne correspond aux critères</p>
          </div>
        )}
      </div>

      <EndpointModal
        endpoint={selectedEndpoint}
        audit={selectedEndpoint ? auditByPath[selectedEndpoint.path] : null}
        onClose={() => setSelectedEndpoint(null)}
      />
    </div>
  );
}

export default DashboardPage;