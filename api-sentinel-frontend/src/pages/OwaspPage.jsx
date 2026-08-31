import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import api from "../services/api";
import { cn } from "../lib/utils";
import { GridPattern } from "../components/GridPattern";
import {
  Shield,
  ShieldAlert,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Unlink,
  Lock,
  Eye,
  Server,
  Key,
  Radar,
  Network,
  Settings,
  FileCheck,
  Bug,
} from "lucide-react";

const SEVERITY_COLORS = { CRITICAL: "#dc2626", HIGH: "#ea580c", MEDIUM: "#ca8a04", LOW: "#16a34a" };
const RISK_LEVEL_SCORE = { CRITICAL: 95, HIGH: 75, MEDIUM: 50, LOW: 20 };

const OWASP_COVERAGE = [
  {
    label: "Broken Object Level Auth",
    code: "API1:2023",
    icon: Unlink,
    description:
      "APIs expose endpoints that handle object identifiers. Attackers swap the ID in a request to access objects they shouldn't be able to reach.",
  },
  {
    label: "Broken Authentication",
    code: "API2:2023",
    icon: Lock,
    description:
      "Authentication mechanisms are misimplemented, letting attackers compromise tokens or credentials and assume other users' identities.",
  },
  {
    label: "Broken Object Property Level Auth",
    code: "API3:2023",
    icon: Eye,
    description:
      "Missing validation on individual object properties lets attackers read or modify sensitive fields they shouldn't have access to.",
  },
  {
    label: "Unrestricted Resource Consumption",
    code: "API4:2023",
    icon: Server,
    description:
      "APIs consume compute, memory, and bandwidth per request. Without limits, attackers can exhaust resources and drive up costs or cause outages.",
  },
  {
    label: "Broken Function Level Auth",
    code: "API5:2023",
    icon: Key,
    description:
      "Complex role hierarchies make it easy to miss checks on sensitive functions, letting attackers reach admin-only operations.",
  },
  {
    label: "Unrestricted Access to Sensitive Flows",
    code: "API6:2023",
    icon: Radar,
    description:
      "Business-critical flows (checkout, signup, etc.) are exposed without limits on excessive or automated access, enabling abuse.",
  },
  {
    label: "Server Side Request Forgery",
    code: "API7:2023",
    icon: Network,
    description:
      "The API fetches a remote resource from a user-supplied URL without validation, letting attackers redirect requests to internal systems.",
  },
  {
    label: "Security Misconfiguration",
    code: "API8:2023",
    icon: Settings,
    description:
      "Insecure default settings, verbose errors, or missing hardening across the API stack open the door to a range of attacks.",
  },
  {
    label: "Improper Inventory Management",
    code: "API9:2023",
    icon: FileCheck,
    description:
      "Outdated or undocumented API versions and hosts stay reachable and unpatched, widening the attack surface silently.",
  },
  {
    label: "Unsafe Consumption of APIs",
    code: "API10:2023",
    icon: Bug,
    description:
      "Developers trust data from third-party APIs more than user input, applying weaker validation that attackers can exploit.",
  },
];

function riskScoreOf(audit) {
  return audit ? RISK_LEVEL_SCORE[audit.riskLevel] || 0 : 0;
}

function owaspCodeOf(category) {
  if (!category) return null;
  const match = category.match(/^([A-Za-z0-9]+:\d{4})/);
  return match ? match[1] : category;
}

/* ---------------- Category Card ---------------- */
function OwaspCategoryCard({ category, findings, onOpenFinding }) {
  const Icon = category.icon;
  const hasFindings = findings.length > 0;
  const sortedFindings = hasFindings
    ? [...findings].sort((a, b) => riskScoreOf(b.audit) - riskScoreOf(a.audit))
    : [];

  return (
    <div className="group/card bg-gradient-to-b from-white/95 via-white/85 to-white/75 backdrop-blur-md border border-blue-200/80 rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(59,130,246,0.08),inset_0_1px_1px_rgba(255,255,255,0.9)] flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm min-w-0">
            {hasFindings ? (
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
            )}
            <span className="truncate">{category.label}</span>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-500 shrink-0">
            {category.code}
          </span>
        </div>

        {/* Definition — small text under the title, revealed on hover */}
        <div className="grid grid-rows-[0fr] duration-150 delay-0 ease-out group-hover/card:grid-rows-[1fr] group-hover/card:duration-300 group-hover/card:delay-[1000ms] transition-[grid-template-rows]">
          <div className="overflow-hidden">
            <p className="text-[10.5px] leading-snug text-slate-400 font-mono pb-2">
              {category.description}
            </p>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 font-mono font-semibold uppercase tracking-wider mb-3">
          {hasFindings
            ? `${findings.length} open finding${findings.length > 1 ? "s" : ""}`
            : "No issues detected"}
        </p>
      </div>

      {hasFindings && (
        <div className="space-y-1.5">
          {sortedFindings.map(({ endpoint, audit }) => {
            const color = SEVERITY_COLORS[audit.riskLevel] || "#64748b";
            return (
              <button
                key={`${endpoint.id}-${audit.id}`}
                onClick={() => onOpenFinding(endpoint.id, audit.id)}
                className="flex items-center justify-between gap-2 w-full bg-white/80 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-300 rounded-lg px-3 py-2 transition-colors text-left"
              >
                <span className="text-xs text-blue-600 font-mono truncate">{endpoint.path}</span>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded border ml-2 shrink-0 flex items-center gap-1"
                  style={{ color, backgroundColor: `${color}12`, borderColor: `${color}30` }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                  {audit.riskLevel}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- Main Page ---------------- */
function OwaspPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [project, setProject] = useState(location.state?.project ?? null);
  const [loading, setLoading] = useState(!location.state?.project);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (project && String(project.id) === String(projectId)) return;

    setLoading(true);
    api
      .get(`/api/projects/${projectId}`)
      .then((res) => setProject(res.data))
      .catch(() => setError("Could not load this scan."))
      .finally(() => setLoading(false));
  }, [projectId]);

  const findingsByCode = useMemo(() => {
    const map = {};
    OWASP_COVERAGE.forEach((c) => (map[c.code] = []));
    (project?.endpoints || []).forEach((endpoint) => {
      (endpoint.auditResults || []).forEach((audit) => {
        const code = owaspCodeOf(audit.owaspCategory);
        if (code && map[code]) {
          map[code].push({ endpoint, audit });
        }
      });
    });
    return map;
  }, [project]);

  const openFinding = (endpointId, auditId) => {
    navigate(`/dashboard/${projectId}/findings/${endpointId}/${auditId}`, { state: { project } });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#eef2f8] flex flex-col items-center justify-center font-mono text-slate-500 gap-3">
        <Activity className="w-6 h-6 animate-spin text-blue-600" />
        <span className="text-xs tracking-wider uppercase">Loading OWASP coverage…</span>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-[#eef2f8] flex flex-col items-center justify-center font-mono text-slate-500 gap-3">
        <AlertTriangle className="w-6 h-6 text-red-500" />
        <span className="text-xs tracking-wider uppercase">{error || "Scan not found."}</span>
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
        {/* Header — identical markup/classes to Dashboard & History, OWASP tab active here */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-blue-200/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/90 border border-blue-200 rounded-lg text-blue-700 shadow-sm">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-blue-800 uppercase">API SENTINEL</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">SECURITY AUDIT CONSOLE</span>
              </div>
              <nav className="flex items-center gap-4 mt-1 text-xs font-semibold">
                <button onClick={() => navigate(`/dashboard/${projectId}`, { state: { project } })} className="text-slate-500 hover:text-blue-700 transition-colors">
                  Dashboard
                </button>
                <span className="text-blue-700">OWASP</span>
                <button onClick={() => navigate("/history")} className="text-slate-500 hover:text-blue-700 transition-colors">
                  History
                </button>
              </nav>
            </div>
          </div>
        </header>

        <div>
          <h1 className="font-bold text-2xl tracking-tight text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-blue-600" /> OWASP API Top 10 coverage
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {project.fileName || project.name || "This scan"} · OWASP API Security Top 10 · 2023 edition
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
          {OWASP_COVERAGE.map((category) => (
            <OwaspCategoryCard
              key={category.code}
              category={category}
              findings={findingsByCode[category.code] || []}
              onOpenFinding={openFinding}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default OwaspPage;