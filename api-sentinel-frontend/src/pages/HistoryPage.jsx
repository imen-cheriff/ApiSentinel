import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { cn } from "../lib/utils";
import { GridPattern } from "../components/GridPattern";
import {
    Shield,
    History as HistoryIcon,
    Download,
    RotateCw,
    Trash2,
    ArrowLeftRight,
    TrendingUp,
    Activity,
} from "lucide-react";

// Same relative-time helper style used on the dashboard.
function formatRelativeTime(timestamp) {
    if (!timestamp) return "À l'instant";
    const isoString = typeof timestamp === "string" ? timestamp.replace(" ", "T") : timestamp;
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "À l'instant";

    const diffInSeconds = Math.floor((new Date() - date) / 1000);
    if (diffInSeconds < 5) return "2 min ago";
    if (diffInSeconds < 60) return `${diffInSeconds} sec ago`;
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 14) return `${diffInDays} days ago`;
    const diffInWeeks = Math.floor(diffInDays / 7);
    return `${diffInWeeks} week${diffInWeeks > 1 ? "s" : ""} ago`;
}

// Score → status badge, thresholds match the mockup (29 red / 41,68 amber / 84 clean).
function statusForScore(score) {
    if (score == null) return { label: "PENDING", color: "#64748b" };
    if (score < 50) return { label: "ACTION REQUIRED", color: "#dc2626" };
    if (score < 80) return { label: "REVIEW", color: "#ca8a04" };
    return { label: "CLEAN", color: "#2563eb" };
}

function findingsCountOf(scan) {
    if (!scan.endpoints) return null;
    return scan.endpoints.reduce((sum, ep) => sum + (ep.auditResults?.length || 0), 0);
}

/* ---------------- Score evolution sparkline ---------------- */
function ScoreEvolutionChart({ points }) {
    const width = 1100;
    const height = 120;
    const padding = 10;

    if (points.length === 0) return null;

    const scores = points.map((p) => p.score ?? 0);
    const min = Math.min(...scores, 0);
    const max = Math.max(...scores, 100);
    const range = max - min || 1;

    const coords = points.map((p, i) => {
        const x = points.length === 1 ? width / 2 : (i / (points.length - 1)) * (width - padding * 2) + padding;
        const y = height - padding - ((p.score - min) / range) * (height - padding * 2);
        return { x, y };
    });

    const path = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");

    return (
        <div>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-28" preserveAspectRatio="none">
                <path d={path} fill="none" stroke="#2563eb" strokeWidth="2" />
                {coords.map((c, i) => (
                    <circle key={i} cx={c.x} cy={c.y} r={i === coords.length - 1 ? 4 : 3} fill="#2563eb" />
                ))}
            </svg>
            <div className="flex justify-between mt-2 font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {points.map((p, i) => (
                    <span key={i}>{formatRelativeTime(p.scanDate)}</span>
                ))}
            </div>
        </div>
    );
}

/* ---------------- CSV Export ---------------- */
// Wraps a field for CSV: quotes it whenever it contains a comma, quote, or newline.
function csvField(value) {
    const str = value === null || value === undefined ? "" : String(value);
    if (/[",\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function csvRow(fields) {
    return fields.map(csvField).join(",");
}

// Builds and downloads a clean, well-organised CSV of the scan history:
// a title/summary block up top, then one tidy row per scan.
function exportScansToCsv(scans) {
    if (!scans || scans.length === 0) return;

    const scoredScans = scans.filter((s) => (s.securityScore ?? s.globalSecurityScore) != null);
    const avgScore = scoredScans.length
        ? Math.round(
              scoredScans.reduce((sum, s) => sum + (s.securityScore ?? s.globalSecurityScore), 0) /
                  scoredScans.length
          )
        : "—";
    const totalRoutes = scans.reduce((sum, s) => sum + (s.endpoints?.length || 0), 0);
    const totalFindings = scans.reduce((sum, s) => sum + (findingsCountOf(s) || 0), 0);
    const generatedOn = new Date().toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });

    const lines = [];
    lines.push(csvRow(["API SENTINEL — SCAN HISTORY EXPORT"]));
    lines.push(csvRow([`Generated on`, generatedOn]));
    lines.push("");
    lines.push(csvRow(["SUMMARY"]));
    lines.push(csvRow(["Total scans", scans.length]));
    lines.push(csvRow(["Average security score", avgScore === "—" ? avgScore : `${avgScore}/100`]));
    lines.push(csvRow(["Total routes scanned", totalRoutes]));
    lines.push(csvRow(["Total findings", totalFindings]));
    lines.push("");
    lines.push(csvRow(["SCAN DETAILS"]));
    lines.push(
        csvRow(["Specification", "Scanned", "Scan Date (ISO)", "Score", "Status", "Routes", "Findings"])
    );

    scans.forEach((scan) => {
        const score = scan.securityScore ?? scan.globalSecurityScore;
        const status = statusForScore(score);
        lines.push(
            csvRow([
                scan.projectName || "Untitled",
                formatRelativeTime(scan.scanDate),
                scan.scanDate || "",
                score != null ? `${score}/100` : "—",
                status.label,
                scan.endpoints?.length ?? "—",
                findingsCountOf(scan) ?? "—",
            ])
        );
    });

    // Leading BOM so Excel opens accents/UTF-8 correctly instead of mangling them.
    const csvContent = "\uFEFF" + lines.join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `api-sentinel-history-${dateStamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function historyCornerClasses(position) {
    return `absolute w-3.5 h-3.5 border-[1.5px] border-blue-300 transition-colors duration-200 ${position}`;
}

function HistoryPage() {
    const navigate = useNavigate();
    const [scans, setScans] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api
            .get("/api/projects")
            .then((res) => {
                // Newest first, matching the mockup.
                const sorted = [...res.data].sort(
                    (a, b) => new Date(b.scanDate) - new Date(a.scanDate)
                );
                setScans(sorted);
            })
            .finally(() => setLoading(false));
    }, []);

    const chartPoints = useMemo(
        () =>
            [...scans]
                .reverse()
                .map((s) => ({ scanDate: s.scanDate, score: s.globalSecurityScore ?? 0 })),
        [scans]
    );

    const handleDelete = async (id) => {
        await api.delete(`/api/projects/${id}`);
        setScans((prev) => prev.filter((s) => s.id !== id));
    };

    const handleRerun = (id) => {
        navigate(`/dashboard/${id}`);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#eef2f8] flex flex-col items-center justify-center font-mono text-slate-500 gap-3">
                <Activity className="w-6 h-6 animate-spin text-blue-600" />
                <span className="text-xs tracking-wider uppercase">Loading scan history…</span>
            </div>
        );
    }

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

            <div className="relative z-10 max-w-7xl mx-auto space-y-6">
                {/* Header */}
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
                            <nav className="flex items-center gap-4 mt-1 text-xs font-semibold">
                                <button onClick={() => navigate("/dashboard")} className="text-slate-500 hover:text-blue-700 transition-colors">Dashboard</button>
                                <span className="text-blue-700">History</span>
                                <button onClick={() => navigate("/owasp")} className="text-slate-500 hover:text-blue-700 transition-colors">OWASP</button>
                            </nav>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => exportScansToCsv(scans)}
                            disabled={scans.length === 0}
                            className="px-3 py-1.5 rounded-lg bg-white/90 border border-blue-200 text-slate-700 hover:bg-blue-50 transition-colors flex items-center gap-1.5 shadow-sm text-xs disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white/90"
                        >
                            <Download className="w-3.5 h-3.5" /> Export CSV
                        </button>
                        <button
                            onClick={() => navigate("/")}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-sm text-xs"
                        >
                            <RotateCw className="w-3.5 h-3.5" /> New analysis
                        </button>
                    </div>
                </header>

                <div>
                    <h1 className="font-bold text-2xl tracking-tight text-slate-900">Scan history</h1>
                    <p className="text-xs text-slate-500 mt-1">
                        {scans.length} audit{scans.length !== 1 ? "s" : ""} archived · scores are recomputed
                        on every run
                    </p>
                </div>

                {/* Score evolution */}
                <section className="relative overflow-hidden rounded-2xl border border-blue-200/80 bg-gradient-to-b from-white/95 via-white/85 to-white/75 backdrop-blur-md p-6 shadow-[0_4px_20px_-4px_rgba(59,130,246,0.08),inset_0_1px_1px_rgba(255,255,255,0.9)]">
                    <span className={historyCornerClasses("top-0 left-0 rounded-tl-md border-r-0 border-b-0")} />
                    <span className={historyCornerClasses("top-0 right-0 rounded-tr-md border-l-0 border-b-0")} />
                    <span className={historyCornerClasses("bottom-0 left-0 rounded-bl-md border-r-0 border-t-0")} />
                    <span className={historyCornerClasses("bottom-0 right-0 rounded-br-md border-l-0 border-t-0")} />
                    <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold tracking-wider text-blue-600 uppercase mb-4">
                        <TrendingUp className="size-3.5" /> SCORE EVOLUTION
                    </div>
                    <ScoreEvolutionChart points={chartPoints} />
                </section>

                {/* Table */}
                <section className="rounded-2xl border border-blue-200/80 bg-gradient-to-b from-white/95 via-white/85 to-white/75 backdrop-blur-md shadow-[0_4px_20px_-4px_rgba(59,130,246,0.08),inset_0_1px_1px_rgba(255,255,255,0.9)] overflow-hidden">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-blue-100">
                                <th className="px-5 py-3">Specification</th>
                                <th className="px-5 py-3">Scanned</th>
                                <th className="px-5 py-3">Score</th>
                                <th className="px-5 py-3">Routes</th>
                                <th className="px-5 py-3">Findings</th>
                                <th className="px-5 py-3">Status</th>
                                <th className="px-5 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-blue-100/70">
                            {scans.map((scan) => {
                                const score = scan.securityScore ?? scan.globalSecurityScore;
                                const findings = findingsCountOf(scan);
                                const status = statusForScore(score);
                                return (
                                    <tr key={scan.id} className="text-xs hover:bg-blue-50/40 transition-colors">
                                        <td className="px-5 py-3">
                                            <div className="font-bold text-slate-800">{scan.projectName?.replace(/\.json$/, "") || "Untitled"}</div>
                                            <div className="text-slate-400 text-[11px]">{scan.projectName}</div>
                                        </td>
                                        <td className="px-5 py-3 text-slate-500">{formatRelativeTime(scan.scanDate)}</td>
                                        <td className="px-5 py-3 font-bold" style={{ color: status.color }}>
                                            {score != null ? `${score}/100` : "—"}
                                        </td>
                                        <td className="px-5 py-3 text-slate-700">{scan.endpoints?.length ?? "—"}</td>
                                        <td className="px-5 py-3 text-slate-700">{findings ?? "—"}</td>
                                        <td className="px-5 py-3">
                                            <span
                                                className="text-[10px] font-bold px-2 py-0.5 rounded border"
                                                style={{
                                                    color: status.color,
                                                    backgroundColor: `${status.color}12`,
                                                    borderColor: `${status.color}30`,
                                                }}
                                            >
                                                {status.label}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    onClick={() => handleRerun(scan.id)}
                                                    className="p-1.5 rounded-md border border-blue-200 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                    title="Open"
                                                >
                                                    <RotateCw className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => navigate("/compare", { state: { headId: scan.id } })}
                                                    className="p-1.5 rounded-md border border-blue-200 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                    title="Compare"
                                                >
                                                    <ArrowLeftRight className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(scan.id)}
                                                    className="p-1.5 rounded-md border border-blue-200 text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {scans.length === 0 && (
                        <div className="text-center py-12">
                            <HistoryIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                            <p className="text-sm font-semibold text-slate-600">No scans yet</p>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}

export default HistoryPage;