import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import api from "../services/api";
import { cn } from "../lib/utils";
import { GridPattern } from "../components/GridPattern";
import { useTabNotification } from "../hooks/useTabNotification";
import { looksNonEnglish, translateToEnglish } from "../lib/translateText";
import { TranslatedText } from "../components/TranslatedText";
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
  FileCode2,
  Lock,
  Unlink,
  Eye,
  Server,
  Key,
  FileCheck,
  Radar,
  Network,
  Settings,
  Bug,
  Loader2,
  Languages,
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

const RISK_LEVEL_SCORE = {
  CRITICAL: 95,
  HIGH: 75,
  MEDIUM: 50,
  LOW: 20,
};

function riskScoreOf(audit) {
  return audit ? RISK_LEVEL_SCORE[audit.riskLevel] || 0 : 0;
}

function owaspCodeOf(category) {
  if (!category) return null;
  const match = category.match(/^([A-Za-z0-9]+:\d{4})/);
  return match ? match[1] : category;
}

function worstAuditOf(endpoint) {
  const results = endpoint.auditResults || [];
  if (results.length === 0) return null;
  return [...results].sort((a, b) => riskScoreOf(b) - riskScoreOf(a))[0];
}

const ALL_OWASP_CATEGORIES = [
  { label: "Broken Object Level Auth", code: "API1:2023", icon: Unlink },
  { label: "Broken Authentication", code: "API2:2023", icon: Lock },
  { label: "Broken Object Property Level Auth", code: "API3:2023", icon: Eye },
  { label: "Unrestricted Resource Consumption", code: "API4:2023", icon: Server },
  { label: "Broken Function Level Auth", code: "API5:2023", icon: Key },
  { label: "Unrestricted Access to Sensitive Flows", code: "API6:2023", icon: Radar },
  { label: "Server Side Request Forgery", code: "API7:2023", icon: Network },
  { label: "Security Misconfiguration", code: "API8:2023", icon: Settings },
  { label: "Improper Inventory Management", code: "API9:2023", icon: FileCheck },
  { label: "Unsafe Consumption of APIs", code: "API10:2023", icon: Bug },
];

/* ---------------- PDF Export ---------------- */
function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

function tint(hex, amount = 0.85) {
  const [r, g, b] = hexToRgb(hex);
  return [
    Math.round(r + (255 - r) * amount),
    Math.round(g + (255 - g) * amount),
    Math.round(b + (255 - b) * amount),
  ];
}

function scoreColorOf(score) {
  if (score >= 80) return "#16a34a";
  if (score >= 50) return "#ca8a04";
  return "#dc2626";
}

function generateAuditPdf(project) {
  if (!project) return;

  const endpoints = project.endpoints || [];
  const allAudits = endpoints.flatMap((ep) =>
    (ep.auditResults || []).map((a) => ({ ...a, method: ep.method, path: ep.path }))
  );
  const totalFindings = allAudits.length;
  const totalEndpoints = endpoints.length;
  const affectedRoutes = endpoints.filter((ep) => (ep.auditResults || []).length > 0).length;
  const severityCounts = allAudits.reduce((acc, a) => {
    acc[a.riskLevel] = (acc[a.riskLevel] || 0) + 1;
    return acc;
  }, {});
  const criticalCount = severityCounts.CRITICAL || 0;
  const score = project.globalSecurityScore ?? 0;
  const scoreColor = scoreColorOf(score);

  const owaspCodesPresent = new Set(allAudits.map((a) => owaspCodeOf(a.owaspCategory)).filter(Boolean));
  const presentOwaspCoverage = ALL_OWASP_CATEGORIES.filter((c) => owaspCodesPresent.has(c.code));

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const contentWidth = pageWidth - marginX * 2;

  const generatedOn = new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });

  const drawHeaderBand = () => {
    doc.setFillColor(...hexToRgb("#1d4ed8"));
    doc.rect(0, 0, pageWidth, 92, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("API SENTINEL", marginX, 38);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("SECURITY AUDIT REPORT", marginX, 54);
    doc.setFontSize(9);
    doc.text(project.projectName || "Untitled project", marginX, 74);
    doc.setFontSize(8);
    doc.text(`Generated on ${generatedOn}`, pageWidth - marginX, 74, { align: "right" });
  };

  drawHeaderBand();
  let y = 118;

  /* ---- Global score card + stat boxes ---- */
  doc.setFillColor(...hexToRgb(scoreColor));
  doc.roundedRect(marginX, y, 110, 70, 6, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("SECURITY SCORE", marginX + 55, y + 16, { align: "center" });
  doc.setFontSize(26);
  doc.text(`${score}`, marginX + 55, y + 42, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("/ 100", marginX + 55, y + 56, { align: "center" });

  const statBoxes = [
    { label: "ROUTES SCANNED", value: `${totalEndpoints}`, color: "#2563eb" },
    { label: "VULNERABILITIES", value: `${totalFindings}`, color: "#2563eb" },
    { label: "CRITICAL", value: `${criticalCount}`, color: "#dc2626" },
    { label: "AFFECTED ROUTES", value: `${affectedRoutes}/${totalEndpoints}`, color: "#ea580c" },
  ];

  const boxGap = 10;
  const boxW = (contentWidth - 110 - 16 - boxGap * (statBoxes.length - 1)) / statBoxes.length;
  let boxX = marginX + 110 + 16;
  statBoxes.forEach((box) => {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...hexToRgb(box.color));
    doc.setLineWidth(1);
    doc.roundedRect(boxX, y, boxW, 70, 6, 6, "FD");
    doc.setTextColor(...hexToRgb(box.color));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(box.value, boxX + boxW / 2, y + 38, { align: "center" });
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(box.label, boxX + boxW / 2, y + 56, { align: "center", maxWidth: boxW - 8 });
    boxX += boxW + boxGap;
  });

  y += 100;

  /* ---- Severity breakdown bars ---- */
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Severity breakdown", marginX, y);
  y += 16;

  const barX = marginX + 75;
  const barW = contentWidth - 75 - 40;
  ["CRITICAL", "HIGH", "MEDIUM", "LOW"].forEach((level) => {
    const count = severityCounts[level] || 0;
    const total = totalEndpoints || 1;
    const ratio = Math.min(count / total, 1);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...hexToRgb(SEVERITY_COLORS[level]));
    doc.text(level, marginX, y + 6);
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(barX, y, barW, 8, 4, 4, "F");
    if (count > 0) {
      doc.setFillColor(...hexToRgb(SEVERITY_COLORS[level]));
      doc.roundedRect(barX, y, Math.max(barW * ratio, 10), 8, 4, 4, "F");
    }
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.text(`${count}`, barX + barW + 12, y + 7);
    y += 18;
  });

  y += 10;

  /* ---- OWASP coverage ---- */
  if (presentOwaspCoverage.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text("OWASP API Top 10 coverage", marginX, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      head: [["Code", "Category"]],
      body: presentOwaspCoverage.map((c) => [c.code, c.label]),
      theme: "plain",
      styles: { fontSize: 8, cellPadding: 5, textColor: [51, 65, 85], lineColor: [226, 232, 240], lineWidth: 0.5 },
      headStyles: { fillColor: hexToRgb("#1d4ed8"), textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 80, fontStyle: "bold" } },
    });
    y = doc.lastAutoTable.finalY + 22;
  }

  /* ---- Detailed findings table ---- */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(`Detailed findings (${totalFindings})`, marginX, y);
  y += 8;

  if (totalFindings === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("No vulnerabilities detected for this project.", marginX, y + 16);
  } else {
    const rows = [...allAudits]
      .sort((a, b) => (RISK_LEVEL_SCORE[b.riskLevel] || 0) - (RISK_LEVEL_SCORE[a.riskLevel] || 0))
      .map((a) => [
        a.method,
        a.path,
        a.riskLevel,
        owaspCodeOf(a.owaspCategory) || "—",
        a.vulnerability || "—",
        a.remediation || "—",
      ]);

    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX, bottom: 40 },
      head: [["Method", "Route", "Severity", "OWASP", "Vulnerability", "Remediation"]],
      body: rows,
      theme: "striped",
      styles: { fontSize: 7.5, cellPadding: 5, overflow: "linebreak", valign: "top", lineColor: [226, 232, 240] },
      headStyles: { fillColor: hexToRgb("#1d4ed8"), textColor: 255, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 42 },
        1: { cellWidth: 88 },
        2: { cellWidth: 48 },
        3: { cellWidth: 48 },
        4: { cellWidth: 122 },
        5: { cellWidth: 122 },
      },
      didParseCell: (data) => {
        if (data.section !== "body") return;
        if (data.column.index === 2) {
          const color = SEVERITY_COLORS[data.cell.raw] || "#64748b";
          data.cell.styles.textColor = hexToRgb(color);
          data.cell.styles.fillColor = tint(color, 0.85);
          data.cell.styles.fontStyle = "bold";
        }
        if (data.column.index === 0) {
          const color = METHOD_COLORS[data.cell.raw] || "#64748b";
          data.cell.styles.textColor = hexToRgb(color);
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
  }

  /* ---- Footer + page numbers on every page ---- */
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text("API Sentinel — Confidential security audit report", marginX, pageHeight - 20);
    doc.text(`Page ${i} / ${pageCount}`, pageWidth - marginX, pageHeight - 20, { align: "right" });
  }

  const safeName = (project.projectName || "audit").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`${safeName}-security-report.pdf`);
}

/* ---------------- Score Gauge Component ---------------- */
function scoreGaugeColorOf(score) {
  if (score >= 80) return "#2563eb"; // bleu - CLEAN
  if (score >= 50) return "#ca8a04"; // jaune/orange - REVIEW
  return "#dc2626"; // rouge - ACTION REQUIRED
}

function ScoreGauge({ score, size = 130 }) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const gaugeColor = scoreGaugeColorOf(score); // ← nouveau

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg className="size-full -rotate-90 transform" viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} className="stroke-slate-200" strokeWidth={strokeWidth} fill="transparent" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="transition-all duration-1000 ease-out"
          style={{ stroke: gaugeColor }}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
        />
      </svg>
      <div className="absolute text-center">
        <span
          className="font-mono text-3xl font-bold tracking-tight"
          style={{ color: gaugeColor }}
        >
          {score}
        </span>
        <span className="block font-mono text-[10px] text-slate-500">/ 100</span>
      </div>
    </div>
  );
}


/* ---------------- Endpoint Card ---------------- */
function EndpointCard({ endpoint, onClick, showOriginal }) {
  const audit = worstAuditOf(endpoint);
  const methodColor = METHOD_COLORS[endpoint.method] || "#64748b";
  const severityColor = audit ? SEVERITY_COLORS[audit.riskLevel] : "#16a34a";
  const riskScore = riskScoreOf(audit);
  const findingsCount = endpoint.auditResults?.length || 0;
  const findingCopy = audit ? audit.vulnerability : endpoint.summary || "No direct vulnerability detected.";

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative bg-gradient-to-b from-white/95 via-white/85 to-white/75 backdrop-blur-md border border-blue-200/80 rounded-xl p-4 flex flex-col justify-between shadow-[0_4px_20px_-4px_rgba(59,130,246,0.08),inset_0_1px_1px_rgba(255,255,255,0.9)] transition-all duration-300 hover:border-blue-400 hover:shadow-lg hover:-translate-y-0.5",
        audit ? "cursor-pointer" : "cursor-default"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className="font-mono text-[10px] font-bold px-2 py-0.5 rounded border"
          style={{ color: methodColor, backgroundColor: `${methodColor}12`, borderColor: `${methodColor}30` }}
        >
          {endpoint.method}
        </span>
        {audit ? (
          <span
            className="font-mono text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1"
            style={{ color: severityColor, backgroundColor: `${severityColor}12`, borderColor: `${severityColor}30` }}
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
          <TranslatedText text={findingCopy} showOriginal={showOriginal} showToggle={false} />
        </p>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap mb-4">
        {audit && owaspCodeOf(audit.owaspCategory) && (
          <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100/80 border border-slate-200 text-slate-600">
            {owaspCodeOf(audit.owaspCategory)}
          </span>
        )}
      </div>

      <div className="space-y-3">
        <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${riskScore || (audit ? 75 : 10)}%`, backgroundColor: severityColor }}
          />
        </div>
        <div className="border-b border-slate-200/60" />
        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
          <span>
            {findingsCount > 0
              ? `${findingsCount} finding${findingsCount > 1 ? "s" : ""} · risk ${riskScore}/100`
              : "0 findings · secure"}
          </span>
          {audit && <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Audit In-Progress Screen ---------------- */
const AUDIT_STEPS = [
  "AI contract analysis (Gemini)…",
  "OWASP vulnerability detection…",
  "Security score calculation…",
];
const AUDIT_STEP_INTERVAL_MS = 15_000;

function formatElapsed(ms) {
  const totalSec = Math.floor(ms / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function auditCornerClasses(position) {
  return `absolute w-3.5 h-3.5 border-[1.5px] border-blue-500 transition-colors duration-200 ${position}`;
}

function AuditProgressScreen({ projectName, endpointCount, error, onRetry }) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (error) return;
    const t0 = Date.now();
    const clock = setInterval(() => setElapsedMs(Date.now() - t0), 250);
    return () => clearInterval(clock);
  }, [error]);

  useEffect(() => {
    if (error) return;
    const id = setInterval(() => {
      setActiveStep((s) => Math.min(s + 1, AUDIT_STEPS.length - 1));
    }, AUDIT_STEP_INTERVAL_MS);
    return () => clearInterval(id);
  }, [error]);

  return (
    <div className="relative min-h-screen w-full bg-[#eef2f8] text-slate-900 font-mono flex items-center justify-center px-6 overflow-hidden">
      <div className="fixed inset-0 pointer-events-none z-0">
        <GridPattern
          width={20}
          height={20}
          x={-1}
          y={-1}
          className={cn("stroke-blue-500/20", "[mask-image:linear-gradient(to_bottom_right,white,transparent_40%,transparent_60%,white)]")}
        />
      </div>

      <div
        className={cn(
          "relative z-10 w-full max-w-md rounded-2xl text-left overflow-hidden p-8",
          error
            ? "border border-red-200 bg-red-50/95 shadow-[0_0_0_1px_rgba(220,38,38,0.06)]"
            : "border border-blue-200 bg-blue-50/95 shadow-[0_0_0_1px_rgba(29,78,216,0.06)]"
        )}
      >
        <span className={auditCornerClasses("top-0 left-0 rounded-tl-md border-r-0 border-b-0")} />
        <span className={auditCornerClasses("top-0 right-0 rounded-tr-md border-l-0 border-b-0")} />
        <span className={auditCornerClasses("bottom-0 left-0 rounded-bl-md border-r-0 border-t-0")} />
        <span className={auditCornerClasses("bottom-0 right-0 rounded-br-md border-l-0 border-t-0")} />

        {error ? (
          <div className="relative z-10">
            <div className="flex items-center gap-2.5 mb-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <p className="text-sm font-medium text-red-800">AI analysis failed</p>
            </div>
            <p className="text-xs text-red-700/90 mb-6 ml-6.5 leading-relaxed">{error}</p>
            <button
              onClick={onRetry}
              className="w-full px-3 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5 text-xs"
            >
              <RotateCw className="w-3.5 h-3.5" /> Retry analysis
            </button>
          </div>
        ) : (
          <div className="relative z-10">
            <div className="flex items-start justify-between gap-4 mb-1">
              <div className="flex items-center gap-2.5 min-w-0">
                <Loader2 className="w-4 h-4 shrink-0 text-blue-600 animate-spin" />
                <p className="text-sm font-medium text-blue-800 truncate">{AUDIT_STEPS[activeStep]}</p>
              </div>
              <span className="text-xs tabular-nums text-blue-500 shrink-0 pt-0.5 font-medium">{formatElapsed(elapsedMs)}</span>
            </div>

            <p className="text-[11px] text-blue-400/80 mb-5 ml-7 truncate">
              {projectName} · {endpointCount} routes
            </p>

            <ul className="space-y-2.5 mb-6">
              {AUDIT_STEPS.map((label, i) => {
                const done = i < activeStep;
                const active = i === activeStep;
                return (
                  <li
                    key={label}
                    className={cn(
                      "flex items-center gap-2.5 text-xs transition-colors duration-300",
                      done ? "text-blue-700" : active ? "text-blue-600" : "text-blue-300"
                    )}
                  >
                    {done ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                    ) : (
                      <span className={cn("w-3.5 h-3.5 shrink-0 flex items-center justify-center text-[10px] leading-none", active ? "text-blue-500" : "text-blue-200")}>
                        –
                      </span>
                    )}
                    <span>{label}</span>
                  </li>
                );
              })}
            </ul>

            <div className="h-0.5 bg-blue-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-700 ease-out"
                style={{ width: `${Math.max(((activeStep + 1) / AUDIT_STEPS.length) * 100, 8)}%` }}
              />
            </div>

            <p className="text-[10px] text-blue-400 mt-4 text-center">AI analysis may take up to one minute.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Format Relative Time ---------------- */
function formatRelativeTime(timestamp) {
  if (!timestamp) return "Just now";
  const isoString = typeof timestamp === "string" ? timestamp.replace(" ", "T") : timestamp;
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "Just now";

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 5) return "Just now";
  if (diffInSeconds < 60) return `${diffInSeconds} sec ago`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} hr ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays} days ago`;
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths} months ago`;
  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears} year${diffInYears > 1 ? "s" : ""} ago`;
}

/* ---------------- Header (inline, no AppHeader needed) ---------------- */
function DashboardHeader({ project, scanComplete, onExport, onNewAnalysis }) {
  const navigate = useNavigate();
  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-blue-200/60 pb-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-14 items-center justify-center overflow-hidden rounded-lg bg-transparent">
          <img
            src="/api_sentinel_logo_.png"
            alt="API Sentinel logo"
            className="h-12 w-12 object-contain"
          />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-base tracking-tight text-blue-500 uppercase">API SENTINEL</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">SECURITY AUDIT CONSOLE</span>
          </div>
          <nav className="flex items-center gap-4 mt-1 text-xs font-semibold">
            <span className="text-blue-500">Dashboard</span>
            <button onClick={() => navigate(`/fixlab/${project.id}`, { state: { project } })} className="text-slate-500 hover:text-blue-500 transition-colors">Fix Lab</button>
            <button onClick={() => navigate(`/owasp/${project.id}`, { state: { project } })} className="text-slate-500 hover:text-blue-500 transition-colors">OWASP</button>
            <button onClick={() => navigate("/history")} className="text-slate-500 hover:text-blue-500 transition-colors">
              History
            </button>
          </nav>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {scanComplete && (
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 font-bold text-[10px] border border-emerald-500/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            SCAN COMPLETE
          </span>
        )}
        <button
          onClick={onExport}
          className="px-3 py-1.5 rounded-lg bg-white/90 border border-blue-200 text-slate-700 hover:bg-blue-50 transition-colors flex items-center gap-1.5 shadow-sm text-xs"
        >
          <Download className="w-3.5 h-3.5" /> Export
        </button>
        <button
          onClick={onNewAnalysis}
          className="px-3 py-1.5 rounded-lg bg-blue-500 text-white font-semibold hover:bg-blue-600 transition-colors flex items-center gap-1.5 shadow-sm text-xs"
        >
          <RotateCw className="w-3.5 h-3.5" /> New analysis
        </button>
      </div>
    </header>
  );
}

/*----------------- Project Not Found Screen ---------------- */
function ProjectNotFoundScreen({ loadError, onBackHome, onBackHistory }) {
  return (
    <div className="relative min-h-screen w-full bg-[#eef2f8] text-slate-900 font-mono flex items-center justify-center px-6 overflow-hidden">
      <div className="fixed inset-0 pointer-events-none z-0">
        <GridPattern
          width={20} height={20} x={-1} y={-1}
          className={cn(
            "fill-red-400/10 stroke-red-500/25",
            "[mask-image:linear-gradient(to_bottom_right,white,transparent_40%,transparent_60%,white)]"
          )}
        />
      </div>

      <div className="relative z-10 w-full max-w-[430px] rounded-[26px] text-left overflow-hidden p-7 border border-red-200/90 bg-gradient-to-br from-red-50/95 via-red-50/90 to-white/90 shadow-[0_18px_45px_rgba(239,68,68,0.12),0_0_0_1px_rgba(239,68,68,0.08)] backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100 ring-1 ring-red-200/80 shadow-inner shadow-red-200/50">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
          </div>
          <p className="text-[15px] font-semibold tracking-[0.02em] text-red-800">
            {loadError.notFound ? "Project not found" : "Could not load project"}
          </p>
        </div>
        <p className="text-sm text-red-700/90 mb-7 ml-1 leading-relaxed max-w-[320px]">
          {loadError.notFound
            ? "This project doesn't exist, or it may have been deleted."
            : loadError.message}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onBackHistory}
            className="flex-1 px-4 py-3 rounded-xl bg-white/80 border border-red-200 text-red-700 font-semibold hover:bg-red-50 transition-all duration-200 flex items-center justify-center gap-2 text-xs shadow-sm hover:shadow-md"
          >
            View history
          </button>
          <button
            onClick={onBackHome}
            className="flex-1 px-4 py-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition-all duration-200 flex items-center justify-center gap-2 text-xs shadow-[0_8px_18px_rgba(220,38,38,0.28)] hover:shadow-[0_10px_20px_rgba(220,38,38,0.32)]"
          >
            <RotateCw className="w-3.5 h-3.5" /> New analysis
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Main Dashboard Page ---------------- */
function DashboardPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [project, setProject] = useState(null);
  const [loadingProject, setLoadingProject] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState(null);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState(null);
  const [methodFilter, setMethodFilter] = useState(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const { notify, requestPermissionIfNeeded } = useTabNotification();

  const loadProject = () => {
    setLoadingProject(true);
    setLoadError(null);
    return api
      .get(`/api/projects/${projectId}`)
      .then((res) => {
        setProject(res.data);
        return res.data;
      })
      .catch((err) => {
        setProject(null);
        setLoadError({
          notFound: err.response?.status === 404,
          message:
            err.response?.data?.message ||
            "This project could not be loaded.",
        });
      })
      .finally(() => setLoadingProject(false));
  };

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const runAudit = () => {
    requestPermissionIfNeeded();
    setAuditLoading(true);
    setAuditError(null);
    api
      .post(`/api/projects/${projectId}/audit`)
      .then(() => loadProject())
      .then(() => {
        notify({
          title: "Audit terminé ✅",
          body: "Le rapport de sécurité est prêt.",
        });
      })
      .catch((err) => {
        setAuditError(err.response?.data?.message || "AI analysis failed. Please try again shortly.");
      })
      .finally(() => setAuditLoading(false));
  };

  useEffect(() => {
    if (project && project.globalSecurityScore == null && !auditLoading && !auditError) {
      runAudit();
    }
  }, [project]);

  useEffect(() => {
    setShowOriginal(false);
  }, [projectId]);

  useEffect(() => {
    if (!project?.endpoints) return;
    const texts = new Set();
    for (const ep of project.endpoints) {
      const audit = worstAuditOf(ep);
      const copy = audit?.vulnerability || ep.summary;
      if (looksNonEnglish(copy)) texts.add(copy);
    }
    texts.forEach((text) => {
      translateToEnglish(text);
    });
  }, [project]);

  if (loadingProject && !project) {
    return (
      <div className="min-h-screen bg-[#eef2f8] flex flex-col items-center justify-center font-mono text-slate-500 gap-3">
        <Activity className="w-6 h-6 animate-spin text-blue-600" />
        <span className="text-xs tracking-wider uppercase">Loading the Threat Dashboard…</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <ProjectNotFoundScreen
        loadError={loadError}
        onBackHome={() => navigate("/")}
        onBackHistory={() => navigate("/history")}
      />
    );
  }

  if (!project || project.globalSecurityScore == null) {
    return (
      <AuditProgressScreen
        projectName={project?.projectName}
        endpointCount={project?.endpoints?.length || 0}
        error={auditError}
        onRetry={runAudit}
      />
    );
  }

  const endpoints = project.endpoints || [];
  const allAudits = endpoints.flatMap((ep) => ep.auditResults || []);
  const hasForeignCopy = endpoints.some((ep) => {
    const audit = worstAuditOf(ep);
    return looksNonEnglish(audit?.vulnerability || ep.summary);
  });

  const filteredEndpoints = endpoints.filter((ep) => {
    const audit = worstAuditOf(ep);
    if (search && !ep.path.toLowerCase().includes(search.toLowerCase())) return false;
    if (severityFilter && audit?.riskLevel !== severityFilter) return false;
    if (methodFilter && ep.method !== methodFilter) return false;
    return true;
  });

  const topRiskyEndpoints = endpoints
    .map((ep) => ({ ...ep, audit: worstAuditOf(ep) }))
    .filter((ep) => ep.audit)
    .sort((a, b) => riskScoreOf(b.audit) - riskScoreOf(a.audit))
    .slice(0, 5);

  const maxRiskScore = allAudits.reduce((max, a) => Math.max(max, riskScoreOf(a)), 0);
  const severityCounts = allAudits.reduce((acc, a) => {
    acc[a.riskLevel] = (acc[a.riskLevel] || 0) + 1;
    return acc;
  }, {});

  const totalFindings = allAudits.length;
  const totalEndpointsCount = endpoints.length;
  const affectedRoutesCount = endpoints.filter((ep) => (ep.auditResults || []).length > 0).length;
  const findingsDensity = totalEndpointsCount > 0 ? (totalFindings / totalEndpointsCount).toFixed(1) : "0.0";
  const remediationCount = allAudits.filter((a) => a.remediation).length;
  const criticalCount = severityCounts.CRITICAL || 0;

  const owaspCodesPresent = new Set(allAudits.map((a) => owaspCodeOf(a.owaspCategory)).filter(Boolean));
  const presentOwaspCoverage = ALL_OWASP_CATEGORIES.filter((c) => owaspCodesPresent.has(c.code));

  return (
    <div className="relative min-h-screen w-full bg-[#eef2f8] text-slate-900 font-mono px-6 py-8 overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none z-0">
        <GridPattern
          width={20}
          height={20}
          x={-1}
          y={-1}
          className={cn("stroke-blue-500/20", "[mask-image:linear-gradient(to_bottom_right,white,transparent_40%,transparent_60%,white)]")}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto space-y-5">
        <DashboardHeader
          project={project}
          scanComplete={!auditLoading}
          onExport={() => generateAuditPdf(project)}
          onNewAnalysis={() => navigate("/")}
        />

        {/* HERO CARD */}
        <section className="relative overflow-hidden rounded-2xl border border-blue-200/80 bg-gradient-to-b from-white/95 via-white/85 to-white/75 backdrop-blur-md p-6 shadow-[0_4px_20px_-4px_rgba(59,130,246,0.08),inset_0_1px_1px_rgba(255,255,255,0.9)]">
          <div className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-6">
              <ScoreGauge score={project.globalSecurityScore ?? 0} size={130} />
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 font-mono text-[11px] font-bold tracking-wider text-blue-600 uppercase">
                  <Radar className="size-3.5 text-blue-600" /> TARGETS ANALYZED
                </p>
                <h1 className="font-mono text-xl font-bold tracking-tight text-slate-900">
                  {project.projectName} <span className="text-slate-400 font-normal">· openapi.json</span>
                </h1>
                <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[11px]">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200/80 bg-white/80 px-2.5 py-1 text-slate-600 shadow-sm">
                    {formatRelativeTime(project.scanDate)}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200/80 bg-white/80 px-2.5 py-1 text-slate-600 shadow-sm">
                    <Lock className="size-3 text-blue-600" /> OWASP API Top 10 · 2023
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-500/10 px-2.5 py-1 font-bold text-blue-700 shadow-sm">
                    <AlertTriangle className="size-3 text-blue-600" /> Action required
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 divide-x divide-y divide-blue-200/60 overflow-hidden rounded-xl border border-blue-200/80 bg-white/60 sm:grid-cols-4 sm:divide-y-0 shadow-sm">
              <div className="p-4">
                <Network className="size-4 text-blue-600" />
                <p className="mt-3 font-mono text-2xl font-bold tabular-nums text-slate-900">{totalEndpointsCount}</p>
                <p className="mt-0.5 font-mono text-[10px] font-bold tracking-wider text-slate-500 uppercase">ROUTES SCANNED</p>
              </div>
              <div className="p-4">
                <Bug className="size-4 text-blue-600" />
                <p className="mt-3 font-mono text-2xl font-bold tabular-nums text-slate-900">{totalFindings}</p>
                <p className="mt-0.5 font-mono text-[10px] font-bold tracking-wider text-slate-500 uppercase">VULNERABILITIES</p>
              </div>
              <div className="p-4 bg-red-50/20">
                <AlertTriangle className="size-4 text-red-600" />
                <p className="mt-3 font-mono text-2xl font-bold tabular-nums text-red-600">{criticalCount}</p>
                <p className="mt-0.5 font-mono text-[10px] font-bold tracking-wider text-red-600 uppercase">CRITICAL</p>
              </div>
              <div className="p-4 bg-amber-50/20">
                <Activity className="size-4 text-amber-600" />
                <p className="mt-3 font-mono text-2xl font-bold tabular-nums text-amber-600">{maxRiskScore}</p>
                <p className="mt-0.5 font-mono text-[10px] font-bold tracking-wider text-amber-600 uppercase">MAX RISK</p>
              </div>
            </div>
          </div>
        </section>

        {/* THREE CARDS ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="bg-gradient-to-b from-white/95 via-white/85 to-white/75 backdrop-blur-md border border-blue-200/80 rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(59,130,246,0.08),inset_0_1px_1px_rgba(255,255,255,0.9)] flex flex-col justify-between">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">SEVERITY BREAKDOWN</div>
              <div className="space-y-2 mb-6">
                {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((level) => {
                  const count = severityCounts[level] || 0;
                  const total = totalEndpointsCount || 1;
                  return (
                    <div key={level} className="flex items-center gap-3 text-xs">
                      <span className="w-16 font-bold text-[10px]" style={{ color: SEVERITY_COLORS[level] }}>
                        {level}
                      </span>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(count / total) * 100}%`, backgroundColor: SEVERITY_COLORS[level] }} />
                      </div>
                      <span className="w-4 text-right font-bold text-slate-700">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="pt-4 border-t border-blue-100/80 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500"><span>Total Findings</span><span className="font-bold text-slate-800">{totalFindings}</span></div>
              <div className="flex justify-between text-slate-500"><span>Affected routes</span><span className="font-bold text-slate-800">{affectedRoutesCount}/{totalEndpointsCount}</span></div>
              <div className="flex justify-between text-slate-500"><span>Density</span><span className="font-bold text-slate-800">{findingsDensity} / route</span></div>
              <div className="flex justify-between text-slate-500"><span>Remediation suggestions</span><span className="font-bold text-slate-800">{remediationCount}</span></div>
            </div>
          </div>

          <div className="bg-gradient-to-b from-white/95 via-white/85 to-white/75 backdrop-blur-md border border-blue-200/80 rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(59,130,246,0.08),inset_0_1px_1px_rgba(255,255,255,0.9)] flex flex-col justify-between">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-500" /> HIGHEST-RISK ROUTES
              </div>
              <div className="divide-y divide-blue-100/80">
                {topRiskyEndpoints.map((ep) => {
                  const audit = ep.audit;
                  const severityColor = audit
                    ? audit.riskLevel === "CRITICAL"
                      ? SEVERITY_COLORS.CRITICAL
                      : audit.riskLevel === "HIGH"
                        ? SEVERITY_COLORS.HIGH
                        : audit.riskLevel === "MEDIUM"
                          ? SEVERITY_COLORS.MEDIUM
                          : SEVERITY_COLORS.LOW
                    : "#94a3b8";

                  return (
                    <div
                      key={ep.id}
                      onClick={() => navigate(`/dashboard/${project.id}/findings/${ep.id}/${ep.audit.id}`, { state: { project } })}
                      className="flex items-center justify-between py-2.5 px-1 hover:bg-blue-50/50 cursor-pointer transition-colors rounded-md"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: severityColor }} />
                        <span className="truncate font-bold text-xs" style={{ color: severityColor }}>{ep.path}</span>
                      </div>
                      <span className="font-mono font-bold text-xs ml-2 shrink-0" style={{ color: severityColor }}>{riskScoreOf(ep.audit)}</span>
                    </div>
                  );
                })}
                {topRiskyEndpoints.length === 0 && (
                  <p className="text-xs text-slate-400 py-2">No risky routes.</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-b from-white/95 via-white/85 to-white/75 backdrop-blur-md border border-blue-200/80 rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(59,130,246,0.08),inset_0_1px_1px_rgba(255,255,255,0.9)] flex flex-col justify-between">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-blue-600" /> COUVERTURE OWASP
              </div>
              <div className="space-y-2">
                {presentOwaspCoverage.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.code} className="flex items-center justify-between p-2 rounded-xl bg-slate-50/80 border border-slate-200/80 hover:border-blue-300 hover:bg-blue-50/50 transition-all shadow-sm">
                      <div className="flex items-center gap-2.5 truncate text-slate-700">
                        <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="truncate text-xs font-semibold text-slate-800">{item.label}</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-500 shrink-0">{item.code}</span>
                    </div>
                  );
                })}
                {presentOwaspCoverage.length === 0 && (
                  <p className="text-xs text-slate-400 py-2">No relevant OWASP categories.</p>
                )}
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
              placeholder="Search for an endpoint..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/90 border border-blue-200 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto justify-end">
            {hasForeignCopy && (
              <button
                type="button"
                onClick={() => setShowOriginal((v) => !v)}
                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded border border-blue-200 bg-white text-blue-600 hover:bg-blue-50 transition-colors mr-1"
              >
                <Languages className="w-3 h-3" />
                {showOriginal ? "Show English" : "Show original"}
              </button>
            )}
            <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Filters:</span>
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
              {filteredEndpoints.length}/{totalEndpointsCount} routes
            </span>
          </div>
        </div>

        {/* Endpoint Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEndpoints.map((endpoint) => {
            const audit = worstAuditOf(endpoint);
            return (
              <EndpointCard
                key={endpoint.id}
                endpoint={endpoint}
                showOriginal={showOriginal}
                onClick={() => {
                  if (!audit) return;
                  navigate(`/dashboard/${project.id}/findings/${endpoint.id}/${audit.id}`, { state: { project } });
                }}
              />
            );
          })}
        </div>

        {filteredEndpoints.length === 0 && (
          <div className="text-center py-12 border border-dashed border-blue-200 rounded-xl bg-white/40">
            <FileCode2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-600">No endpoint matches the criteria</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default DashboardPage;