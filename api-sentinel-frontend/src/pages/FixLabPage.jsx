import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Swords, Wrench, MessagesSquare, ChevronLeft, ChevronRight } from "lucide-react";
import AskTheSpecPanel from "../components/AskTheSpecPanel";
import AttackSimulatorPanel from "../components/AttackSimulatorPanel";
import AutoFixPatchPanel from "../components/AutoFixPatchPanel";
import { cn } from "../lib/utils";
import { GridPattern } from "../components/GridPattern";
import api from "../services/api";

const TOOLS = [
  { id: "attack", label: "Attack Patch", icon: Swords },
  { id: "patch", label: "Auto-Fix Patch", icon: Wrench },
  { id: "spec", label: "Ask the Spec", icon: MessagesSquare },
];

const RISK_ORDER = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
const PAGE_SIZE = 4;

const RISK_STYLES = {
  CRITICAL: "bg-red-100 text-red-700",
  HIGH: "bg-red-50 text-red-600",
  MEDIUM: "bg-orange-100 text-orange-700",
  LOW: "bg-emerald-100 text-emerald-700",
};

function owaspCodeOf(category) {
  if (!category) return null;
  const match = category.match(/^([A-Za-z0-9]+:\d{4})/);
  return match ? match[1] : category;
}

function buildSpecSnippet(endpoint) {
  const params = endpoint.parameters || [];
  return `"${endpoint.path}": {
  "${endpoint.method.toLowerCase()}": {
    "summary": "${endpoint.summary || ""}",
    "parameters": [${params
      .map((p) => `\n      { "name": "${p.name}", "in": "${p.inType}" }`)
      .join(",")}${params.length ? "\n    " : ""}]
  }
}`;
}

function findingsFromProject(project) {
  const endpoints = project?.endpoints || [];
  return endpoints.flatMap((ep) =>
    (ep.auditResults || []).map((audit) => ({
      id: `${ep.id}-${audit.id}`,
      auditResultId: audit.id,
      method: ep.method,
      path: ep.path,
      vulnerability: audit.vulnerability,
      owaspTag: owaspCodeOf(audit.owaspCategory),
      riskLevel: audit.riskLevel,
      vulnerableSpecification: audit.vulnerableSpecification || buildSpecSnippet(ep),
    }))
  );
}

function RiskBadge({ level }) {
  const cls = RISK_STYLES[level?.toUpperCase()] || "bg-gray-100 text-gray-600";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      ● {level}
    </span>
  );
}

function FindingCard({ finding, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl border p-4 transition",
        selected
          ? "border-blue-400 bg-blue-50/50 ring-1 ring-blue-200"
          : "border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50/20"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
          {finding.method}
        </span>
        <RiskBadge level={finding.riskLevel} />
      </div>

      <p className="font-mono text-sm font-semibold text-gray-900">{finding.path}</p>
      <p className="text-sm text-gray-500 mt-1 leading-snug">{finding.vulnerability}</p>

      {finding.owaspTag && (
        <span className="inline-block mt-3 text-[11px] font-mono px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
          {finding.owaspTag}
        </span>
      )}
    </button>
  );
}

export default function FixLabPage() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [activeTool, setActiveTool] = useState("attack");

  const [findings, setFindings] = useState([]);
  const [projectName, setProjectName] = useState("");
  const [selectedFinding, setSelectedFinding] = useState(null);
  const [findingsLoading, setFindingsLoading] = useState(true);
  const [findingsError, setFindingsError] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    const loadFindings = async () => {
      setFindingsLoading(true);
      setFindingsError(null);
      try {
        const res = await api.get(`/api/projects/${projectId}`);
        if (cancelled) return;
        setProjectName(res.data?.projectName || "");
        const list = findingsFromProject(res.data).sort(
          (a, b) => (RISK_ORDER[b.riskLevel] || 0) - (RISK_ORDER[a.riskLevel] || 0)
        );
        setFindings(list);
        setSelectedFinding(list[0] || null);
        setPage(1);
      } catch (err) {
        if (!cancelled) {
          setFindingsError(
            err.response?.data?.message || "Couldn't load findings for this scan."
          );
        }
      } finally {
        if (!cancelled) setFindingsLoading(false);
      }
    };

    loadFindings();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const totalPages = Math.max(1, Math.ceil(findings.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedFindings = findings.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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

      <div className="relative z-10 mx-auto max-w-7xl space-y-5">
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
                <button onClick={() => navigate(`/dashboard/${projectId}`)} className="text-slate-500 hover:text-blue-500 transition-colors">Dashboard</button>
                <span className="text-blue-500">Fix Lab</span>
                <button onClick={() => navigate(`/owasp/${projectId}`)} className="text-slate-500 hover:text-blue-500 transition-colors">OWASP</button>
                <button onClick={() => navigate("/history")} className="text-slate-500 hover:text-blue-500 transition-colors">History</button>
              </nav>
            </div>
          </div>
        </header>

        <h1 className="text-3xl font-bold text-gray-900">
          From findings to fixes<span className="text-blue-600">_</span>
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Three additions that make an audit actionable: see the attack, get the patch, question the report, and track it across runs.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {TOOLS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTool(id)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                activeTool === id
                  ? "bg-blue-600 text-white"
                  : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {activeTool === "spec" && (
            <AskTheSpecPanel projectId={projectId} scanName={projectName || "this report"} />
          )}

          {(activeTool === "attack" || activeTool === "patch") && (
            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
              <div>
                <h2 className="text-xs font-semibold text-gray-400 tracking-wide uppercase mb-3">
                  Findings in this scan
                </h2>

                {findingsLoading && (
                  <div className="rounded-xl border border-gray-100 bg-white p-6 text-sm text-gray-400">
                    Loading findings…
                  </div>
                )}

                {findingsError && !findingsLoading && (
                  <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
                    {findingsError}
                  </div>
                )}

                {!findingsLoading && !findingsError && findings.length === 0 && (
                  <div className="rounded-xl border border-gray-100 bg-white p-6 text-sm text-gray-400">
                    No findings for this scan.
                  </div>
                )}

                <div className="space-y-3">
                  {pagedFindings.map((finding) => (
                    <FindingCard
                      key={finding.id}
                      finding={finding}
                      selected={selectedFinding?.id === finding.id}
                      onClick={() => setSelectedFinding(finding)}
                    />
                  ))}
                </div>
                {findings.length > 0 && (
                  <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
                    <span className="text-[10px] font-semibold text-gray-400">
                      {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, findings.length)} of {findings.length}
                    </span>
                    {totalPages > 1 && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={currentPage <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-blue-50"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                          <button
                            type="button"
                            key={n}
                            onClick={() => setPage(n)}
                            className={cn(
                              "h-6 min-w-6 px-1.5 rounded-md border text-[10px] font-bold",
                              n === currentPage
                                ? "border-blue-500 bg-blue-600 text-white"
                                : "border-gray-200 bg-white text-gray-600 hover:bg-blue-50"
                            )}
                          >
                            {n}
                          </button>
                        ))}
                        <button
                          type="button"
                          disabled={currentPage >= totalPages}
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-blue-50"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {activeTool === "attack" && (
                <AttackSimulatorPanel projectId={projectId} finding={selectedFinding} />
              )}
              {activeTool === "patch" && (
                <AutoFixPatchPanel projectId={projectId} finding={selectedFinding} />
              )}
            </div>
          )}

          {activeTool !== "spec" && activeTool !== "attack" && activeTool !== "patch" && (
            <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-400 shadow-sm">
              Coming soon.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}