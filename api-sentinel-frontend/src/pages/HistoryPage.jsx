import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
    const height = 160;
    const padding = 16;
    const [hovered, setHovered] = useState(null);

    if (points.length === 0) return null;

    const scores = points.map((p) => p.score ?? 0);
    const min = Math.min(...scores, 0);
    const max = Math.max(...scores, 100);
    const range = max - min || 1;

    const coords = points.map((p, i) => {
        const x = points.length === 1 ? width / 2 : (i / (points.length - 1)) * (width - padding * 2) + padding;
        const y = height - padding - ((p.score - min) / range) * (height - padding * 2);
        return { x, y, score: p.score, scanDate: p.scanDate };
    });

    const linePath = coords.reduce((acc, c, i) => {
        if (i === 0) return `M ${c.x} ${c.y}`;
        const prev = coords[i - 1];
        const midX = (prev.x + c.x) / 2;
        return `${acc} C ${midX} ${prev.y}, ${midX} ${c.y}, ${c.x} ${c.y}`;
    }, "");

    const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${height - padding} L ${coords[0].x} ${height - padding} Z`;

    const gridLines = [0, 0.25, 0.5, 0.75, 1];

    // Only show a handful of readable labels instead of one per point
    const MAX_LABELS = 6;
    const labelIndices = (() => {
        const n = points.length;
        if (n <= MAX_LABELS) return points.map((_, i) => i);
        const idx = new Set();
        for (let i = 0; i < MAX_LABELS; i++) {
            idx.add(Math.round((i * (n - 1)) / (MAX_LABELS - 1)));
        }
        return [...idx].sort((a, b) => a - b);
    })();

    return (
        <div>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="scoreAreaFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="scoreLineStroke" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#60a5fa" />
                        <stop offset="100%" stopColor="#2563eb" />
                    </linearGradient>
                </defs>

                {gridLines.map((f, i) => {
                    const y = padding + f * (height - padding * 2);
                    return (
                        <line
                            key={i}
                            x1={padding}
                            y1={y}
                            x2={width - padding}
                            y2={y}
                            stroke="#bfdbfe"
                            strokeOpacity="0.6"
                            strokeWidth="1"
                            strokeDasharray={i === gridLines.length - 1 ? "0" : "4 5"}
                        />
                    );
                })}
                {/* Subtle vertical guides only under the labels we actually show */}
                {labelIndices.map((i) => (
                    <line
                        key={`v-${i}`}
                        x1={coords[i].x}
                        y1={padding}
                        x2={coords[i].x}
                        y2={height - padding}
                        stroke="#dbeafe"
                        strokeOpacity="0.7"
                        strokeWidth="1"
                    />
                ))}

                <path d={areaPath} fill="url(#scoreAreaFill)" stroke="none" />
                <path d={linePath} fill="none" stroke="url(#scoreLineStroke)" strokeWidth="2.5" strokeLinecap="round" />

                {coords.map((c, i) => {
                    const isLast = i === coords.length - 1;
                    const isHovered = hovered === i;
                    return (
                        <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
                            <circle cx={c.x} cy={c.y} r={10} fill="transparent" />
                            {(isLast || isHovered) && (
                                <circle cx={c.x} cy={c.y} r={7} fill="#2563eb" fillOpacity="0.15" />
                            )}
                            <circle
                                cx={c.x}
                                cy={c.y}
                                r={isHovered ? 5 : isLast ? 4.5 : 3.5}
                                fill="#2563eb"
                                stroke="white"
                                strokeWidth="1.5"
                                className="transition-all duration-150"
                            />
                            {isHovered && (
                                <g>
                                    <rect
                                        x={Math.min(Math.max(c.x - 40, padding), width - padding - 80)}
                                        y={Math.max(c.y - 40, 0)}
                                        width="80"
                                        height="30"
                                        rx="5"
                                        fill="#1e3a8a"
                                    />
                                    <text
                                        x={Math.min(Math.max(c.x, padding + 40), width - padding - 40)}
                                        y={Math.max(c.y - 25, 15)}
                                        textAnchor="middle"
                                        fontSize="11"
                                        fontWeight="700"
                                        fill="white"
                                    >
                                        {c.score != null ? `${c.score}/100` : "—"}
                                    </text>
                                    <text
                                        x={Math.min(Math.max(c.x, padding + 40), width - padding - 40)}
                                        y={Math.max(c.y - 13, 27)}
                                        textAnchor="middle"
                                        fontSize="8"
                                        fontWeight="600"
                                        fill="#bfdbfe"
                                    >
                                        {formatRelativeTime(c.scanDate)}
                                    </text>
                                </g>
                            )}
                        </g>
                    );
                })}
            </svg>

            {/* Readable timeline: only a few evenly-spaced ticks + labels */}
            <div className="relative h-8 mt-1">
                {labelIndices.map((i) => {
                    const c = coords[i];
                    const isFirst = i === 0;
                    const isLast = i === points.length - 1;
                    return (
                        <div
                            key={i}
                            className={cn(
                                "absolute top-0 flex flex-col items-center",
                                isFirst ? "translate-x-0" : isLast ? "-translate-x-full" : "-translate-x-1/2"
                            )}
                            style={{ left: `${(c.x / width) * 100}%` }}
                        >
                            <span className={cn("w-px h-1.5 mb-1", isLast ? "bg-blue-500" : "bg-blue-200")} />
                            <span
                                className={cn(
                                    "font-mono text-[10px] font-bold uppercase tracking-wider whitespace-nowrap",
                                    isLast ? "text-blue-600" : "text-slate-400"
                                )}
                            >
                                {formatRelativeTime(points[i].scanDate)}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

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
    if (score == null) return "#64748b";
    if (score >= 80) return "#2563eb";
    if (score >= 50) return "#ca8a04";
    return "#dc2626";
}

function exportScansToPdf(scans) {
    if (!scans || scans.length === 0) return;

    const scoredScans = scans.filter((s) => (s.securityScore ?? s.globalSecurityScore) != null);
    const avgScore = scoredScans.length
        ? Math.round(
              scoredScans.reduce((sum, s) => sum + (s.securityScore ?? s.globalSecurityScore), 0) /
                  scoredScans.length
          )
        : null;
    const totalRoutes = scans.reduce((sum, s) => sum + (s.endpoints?.length || 0), 0);
    const totalFindings = scans.reduce((sum, s) => sum + (findingsCountOf(s) || 0), 0);
    const generatedOn = new Date().toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 40;

    doc.setFillColor(...hexToRgb("#1d4ed8"));
    doc.rect(0, 0, pageWidth, 92, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("API SENTINEL", marginX, 38);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("SCAN HISTORY EXPORT", marginX, 54);
    doc.setFontSize(8);
    doc.text(`Généré le ${generatedOn}`, pageWidth - marginX, 74, { align: "right" });

    let y = 118;

    const statBoxes = [
        { label: "TOTAL SCANS", value: `${scans.length}`, color: "#2563eb" },
        { label: "AVG SCORE", value: avgScore != null ? `${avgScore}/100` : "—", color: scoreColorOf(avgScore) },
        { label: "ROUTES SCANNED", value: `${totalRoutes}`, color: "#2563eb" },
        { label: "TOTAL FINDINGS", value: `${totalFindings}`, color: "#2563eb" },
    ];
    const boxWidth = (pageWidth - marginX * 2 - 3 * 12) / 4;
    statBoxes.forEach((box, i) => {
        const x = marginX + i * (boxWidth + 12);
        doc.setFillColor(...tint(box.color, 0.9));
        doc.roundedRect(x, y, boxWidth, 56, 6, 6, "F");
        doc.setTextColor(...hexToRgb(box.color));
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text(box.label, x + boxWidth / 2, y + 18, { align: "center" });
        doc.setFontSize(16);
        doc.text(box.value, x + boxWidth / 2, y + 40, { align: "center" });
    });

    y += 80;

    autoTable(doc, {
        startY: y,
        margin: { left: marginX, right: marginX },
        head: [["Specification", "Scanned", "Score", "Status", "Routes", "Findings"]],
        body: scans.map((scan) => {
            const score = scan.securityScore ?? scan.globalSecurityScore;
            const status = statusForScore(score);
            return [
                scan.projectName || "Untitled",
                formatRelativeTime(scan.scanDate),
                score != null ? `${score}/100` : "—",
                status.label,
                scan.endpoints?.length ?? "—",
                findingsCountOf(scan) ?? "—",
            ];
        }),
        theme: "grid",
        styles: { font: "helvetica", fontSize: 8.5, cellPadding: 6, lineColor: [219, 234, 254], lineWidth: 0.5 },
        headStyles: { fillColor: hexToRgb("#1d4ed8"), textColor: 255, fontStyle: "bold", fontSize: 8 },
        columnStyles: {
            2: { halign: "center", fontStyle: "bold" },
            3: { halign: "center", fontStyle: "bold" },
            4: { halign: "center" },
            5: { halign: "center" },
        },
        didParseCell: (data) => {
            if (data.section !== "body") return;
            const scan = scans[data.row.index];
            const score = scan.securityScore ?? scan.globalSecurityScore;
            const status = statusForScore(score);
            if (data.column.index === 2 || data.column.index === 3) {
                data.cell.styles.fillColor = tint(status.color, 0.85);
                data.cell.styles.textColor = hexToRgb(status.color);
            }
        },
    });

    const dateStamp = new Date().toISOString().slice(0, 10);
    doc.save(`api-sentinel-history-${dateStamp}.pdf`);
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
                                <button onClick={() => navigate("/owasp")} className="text-slate-500 hover:text-blue-700 transition-colors">OWASP</button>
                                <span className="text-blue-700">History</span>
                                
                            </nav>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => exportScansToPdf(scans)}
                            disabled={scans.length === 0}
                            className="px-3 py-1.5 rounded-lg bg-white/90 border border-blue-200 text-slate-700 hover:bg-blue-50 transition-colors flex items-center gap-1.5 shadow-sm text-xs disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white/90"
                        >
                            <Download className="w-3.5 h-3.5" /> Export PDF
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