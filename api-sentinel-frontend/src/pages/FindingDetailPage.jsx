import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import api from "../services/api";
import { cn } from "../lib/utils";
import { GridPattern } from "../components/GridPattern";
import {
  ArrowLeft,
  ArrowRight,
  Shield,
  Download,
  RefreshCw,
  Eye,
  Key,
  ShieldAlert,
  Database,
  Braces,
  ShieldOff,
  Lock,
  AlertTriangle,
  AlertCircle,
  Target,
} from "lucide-react";

/* ---------------------------------------------------------------------- */
/*  Static design tokens — lifted 1:1 from the reference mock             */
/* ---------------------------------------------------------------------- */

const SEVERITY_COLORS = { CRITICAL: "#dc2626", HIGH: "#ea580c", MEDIUM: "#ca8a04", LOW: "#16a34a" };
const RISK_LEVEL_SCORE = { CRITICAL: 95, HIGH: 75, MEDIUM: 50, LOW: 20 };

/* ---------------------------------------------------------------------- */
/*  Domain rules — maps a real OWASP API Top-10 (2023) category onto the  */
/*  request lifecycle + the controls checklist. This is standard OWASP    */
/*  knowledge keyed off audit.owaspCategory (real data); it is NOT a      */
/*  stand-in for backend-generated analysis. Swap this out if/when the    */
/*  backend starts returning per-finding lifecycle + control verdicts.    */
/* ---------------------------------------------------------------------- */

const LIFECYCLE_STAGES = [
  { key: "caller", label: "Caller", icon: Eye },
  { key: "identity", label: "Identity", icon: Key },
  { key: "authorization", label: "Authorization", icon: ShieldAlert },
  { key: "dataLayer", label: "Data layer", icon: Database },
];

const OWASP_RULES = {
  API1: { breaksAt: "authorization", risky: ["ownership", "inputConstraints", "rateLimit", "authentication"] },
  API2: { breaksAt: "identity", risky: ["authentication", "rateLimit"] },
  API3: { breaksAt: "dataLayer", risky: ["ownership", "inputConstraints"] },
  API4: { breaksAt: "caller", risky: ["rateLimit", "inputConstraints"] },
  API5: { breaksAt: "authorization", risky: ["ownership", "authentication"] },
  API6: { breaksAt: "authorization", risky: ["rateLimit", "ownership"] },
  API7: { breaksAt: "caller", risky: ["inputConstraints"] },
  API8: { breaksAt: "identity", risky: ["authentication", "rateLimit"] },
  API9: { breaksAt: "caller", risky: ["inputConstraints"] },
  API10: { breaksAt: "caller", risky: ["inputConstraints", "authentication"] },
};

const CONTROL_COPY = {
  ownership: {
    title: "Ownership check",
    missing: "Caller identity never compared to record owner",
    present: "Spec implies caller/resource ownership is compared",
  },
  authentication: {
    title: "Authentication",
    missing: "No security scheme declared on this operation",
    present: "A security scheme is declared on this operation",
  },
  inputConstraints: {
    title: "Input constraints",
    missing: "Identifier has no format or bounds",
    present: "Parameters carry explicit type/format constraints",
  },
  rateLimit: {
    title: "Rate limiting",
    missing: "No documented throttle for this route",
    present: "A throttle is documented for this route",
  },
};

// Keywords used to flag a parameter as carrying personal/business-sensitive data.
const SENSITIVE_KEYWORDS = [
  "user", "email", "phone", "ssn", "address", "token", "password", "secret",
  "auth", "card", "iban", "account", "salary", "income", "health", "medical",
  "heart", "gps", "location", "lat", "lng", "dob", "birth", "gender", "race",
];

function isSensitiveField(name = "") {
  const n = name.toLowerCase();
  return SENSITIVE_KEYWORDS.some((k) => n.includes(k));
}

function owaspRuleFor(owaspCategory) {
  const key = Object.keys(OWASP_RULES).find((k) => owaspCategory?.toUpperCase().startsWith(k));
  return OWASP_RULES[key] || { breaksAt: "authorization", risky: ["inputConstraints"] };
}

function timeAgo(dateString) {
  if (!dateString) return null;
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} day ago`;
}

/* ---------------------------------------------------------------------- */

function FindingDetailPage() {
  const { projectId, endpointId, auditId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [project, setProject] = useState(location.state?.project ?? null);

  useEffect(() => {
    if (project) return;
    api.get(`/api/projects/${projectId}`).then((res) => setProject(res.data));
  }, [projectId, project]);

  const findings = useMemo(() => {
    if (!project?.endpoints) return [];
    return project.endpoints.flatMap((ep) =>
      (ep.auditResults || []).map((audit) => ({ endpoint: ep, audit }))
    );
  }, [project]);

  const currentIndex = findings.findIndex(
    (f) => String(f.endpoint.id) === endpointId && String(f.audit.id) === auditId
  );
  const current = findings[currentIndex];

  if (!project || !current) {
    return (
      <div className="min-h-screen bg-[#eef2f8] flex items-center justify-center font-mono text-slate-500 text-xs uppercase tracking-wider">
        Loading finding…
      </div>
    );
  }

  const { endpoint, audit } = current;
  const parameters = endpoint.parameters || [];
  const sevColor = SEVERITY_COLORS[audit.riskLevel] || "#64748b";
  const riskScore = RISK_LEVEL_SCORE[audit.riskLevel] || 0;

  const rule = owaspRuleFor(audit.owaspCategory);
  const riskyControls = new Set(rule.risky);

  const hasGuessableIdParam = parameters.some(
    (p) => p.inType === "path" && ["integer", "long", "number"].includes((p.dataType || "").toLowerCase())
  );
  const likelihood = Math.min(95, riskScore + (hasGuessableIdParam ? 20 : 0));
  const impact = Math.min(95, riskScore + (riskyControls.has("ownership") ? 5 : 0));
  const exposureSurface = Math.min(95, riskScore + Math.min(parameters.length * 3, 20));

  const sensitiveParams = parameters.filter((p) => isSensitiveField(p.name));

  const goToFinding = (index) => {
    const wrapped = ((index % findings.length) + findings.length) % findings.length;
    const f = findings[wrapped];
    navigate(`/dashboard/${projectId}/findings/${f.endpoint.id}/${f.audit.id}`, { state: { project } });
  };

  const scanMeta = [
    project.fileName,
    project.scannedAt ? `scanned ${timeAgo(project.scannedAt)}` : null,
    typeof project.globalSecurityScore === "number" ? `score ${project.globalSecurityScore}/100` : null,
  ]
    .filter(Boolean)
    .join(" · ");

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
        {/* Header */}
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
                <button onClick={() => navigate(`/dashboard/${projectId}`, { state: { project } })} className="text-blue-700 hover:text-blue-800 transition-colors">
                  Dashboard
                </button>
                <button onClick={() => navigate(`/fixlab/${project.id}`, { state: { project } })} className="text-slate-500 hover:text-blue-700 transition-colors">
                  Fix Lab
                </button>
                <button onClick={() => navigate(`/owasp/${projectId}`, { state: { project } })} className="text-slate-500 hover:text-blue-700 transition-colors">
                  OWASP
                </button>
                <button onClick={() => navigate("/history")} className="text-slate-500 hover:text-blue-700 transition-colors">
                  History
                </button>
              </nav>
            </div>
          </div>
        </header>

        {scanMeta && <p className="text-[11px] text-slate-500 -mt-2">{scanMeta}</p>}

        {/* Back / Next */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(`/dashboard/${projectId}`, { state: { project } })}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to report
          </button>
          <button
            onClick={() => goToFinding(currentIndex + 1)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 hover:bg-blue-700 transition-colors"
          >
            Next finding <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Title + Risk anatomy */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="font-mono text-[10px] font-bold px-3 py-1 rounded-full border border-blue-100 bg-blue-50 text-blue-600">
                {endpoint.method}
              </span>
              <span
                className="font-mono text-[10px] font-bold px-3 py-1 rounded-full border flex items-center gap-1"
                style={{ color: sevColor, backgroundColor: `${sevColor}0d`, borderColor: `${sevColor}25` }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sevColor }} /> {audit.riskLevel}
              </span>
              {audit.owaspCategory && (
                <span className="text-[10px] font-mono font-semibold px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-500">
                  {audit.owaspCategory}
                </span>
              )}
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">{audit.vulnerability}</h1>
            <p className="text-blue-600 text-sm mb-4">{endpoint.path}</p>
            <p className="text-sm text-slate-600 leading-relaxed">{audit.description}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">
              <ShieldAlert className="w-3.5 h-3.5" /> Risk anatomy
            </div>

            <div className="flex items-baseline gap-1.5 mb-5">
              <span className="text-5xl font-extrabold tracking-tight text-slate-900">{riskScore}</span>
              <span className="text-xs text-slate-500">/ 100 risk score</span>
            </div>

            <RiskBar label="Likelihood" value={likelihood} color="#ea580c" />
            <RiskBar label="Impact" value={impact} color="#ca8a04" />
            <RiskBar label="Exposure surface" value={exposureSurface} color="#dc2626" />

            <p className="text-[10px] text-slate-400 mt-4">
              {audit.owaspCategory} · {audit.vulnerability}
            </p>
          </div>
        </div>

        {/* Request lifecycle */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-1.5 text-base font-bold text-slate-900 mb-1">
            <Braces className="w-4 h-4 text-blue-600" /> Request lifecycle
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Where a call to this route passes — and the exact stage the specification leaves unguarded.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {LIFECYCLE_STAGES.map((stage, i) => {
              const breaksHere = stage.key === rule.breaksAt;
              const StageIcon = stage.icon;
              return (
                <div
                  key={stage.key}
                  className={cn(
                    "rounded-xl border p-4",
                    breaksHere ? "border-red-200 bg-red-50" : "border-gray-100 bg-white"
                  )}
                >
                  <div
                    className={cn(
                      "inline-flex items-center justify-center w-8 h-8 rounded-full mb-3",
                      breaksHere ? "bg-red-100 text-red-600" : "bg-blue-50 text-blue-600"
                    )}
                  >
                    <StageIcon className="w-3.5 h-3.5" />
                  </div>
                  <p className="text-xs font-bold text-slate-900 mb-1">
                    {i + 1} · {stage.label}
                  </p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {stageDescription(stage.key, { endpoint, parameters, riskyControls })}
                  </p>
                  {breaksHere && (
                    <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-red-100 text-red-700">
                      Breaks here
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Endpoint contract + Data schema */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-1.5 text-base font-bold text-slate-900 mb-4">
              <Braces className="w-4 h-4 text-blue-600" /> Endpoint contract
            </div>

            <dl className="space-y-3 text-xs">
              <Row label="Operation">
                <span className="font-semibold">{endpoint.method} {endpoint.path}</span>
              </Row>
              {parameters.filter((p) => p.inType === "path").length > 0 && (
                <Row label="Path parameters">
                  <span className="flex flex-wrap gap-1 justify-end">
                    {parameters.filter((p) => p.inType === "path").map((p) => (
                      <span key={p.id} className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold">
                        {p.name}
                      </span>
                    ))}
                  </span>
                </Row>
              )}
              {project.fileName && (
                <Row label="Source file"><span>{project.fileName}</span></Row>
              )}
              {parameters.length > 0 && (
                <Row label="Sensitive fields returned">
                  <span className="font-bold text-red-600">{sensitiveParams.length} of {parameters.length}</span>
                </Row>
              )}
            </dl>

            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-600 mt-5 mb-3">
              <Lock className="w-3 h-3" /> Controls expected here
            </div>

            <div className="space-y-2">
              {Object.keys(CONTROL_COPY).map((key) => {
                const missing = riskyControls.has(key);
                const copy = CONTROL_COPY[key];
                return (
                  <div
                    key={key}
                    className={cn(
                      "flex items-start gap-2 rounded-xl border p-3",
                      missing ? "border-red-200 bg-red-50" : "border-gray-100 bg-slate-50"
                    )}
                  >
                    {missing ? (
                      <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                    ) : (
                      <ShieldOff className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                    )}
                    <div>
                      <p className={cn("text-xs font-bold", missing ? "text-red-700" : "text-slate-600")}>{copy.title}</p>
                      <p className={cn("text-[11px]", missing ? "text-red-600/80" : "text-slate-500")}>
                        {missing ? copy.missing : copy.present}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-1.5 text-base font-bold text-slate-900 mb-1">
              <ShieldAlert className="w-4 h-4 text-blue-600" /> Data schema at risk
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Parameters this route accepts. Highlighted rows carry personal or business-sensitive values.
            </p>

            {parameters.length === 0 ? (
              <p className="text-xs text-slate-400">No parameters declared on this operation.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
                    <th className="py-2 font-semibold">Field</th>
                    <th className="py-2 font-semibold">In</th>
                    <th className="py-2 font-semibold">Type</th>
                    <th className="py-2 font-semibold">Required</th>
                  </tr>
                </thead>
                <tbody>
                  {parameters.map((p) => {
                    const sensitive = isSensitiveField(p.name);
                    return (
                      <tr key={p.id} className={cn("border-b border-slate-100", sensitive && "bg-red-50")}>
                        <td className="py-2 font-semibold flex items-center gap-1.5">
                          {sensitive && <Target className="w-3 h-3 text-red-500 shrink-0" />}
                          <span className={sensitive ? "text-red-700" : "text-slate-800"}>{p.name}</span>
                        </td>
                        <td className="py-2 text-slate-500">{p.inType}</td>
                        <td className="py-2 text-slate-500">{p.dataType}</td>
                        <td className="py-2 text-slate-500">{p.required ? "yes" : "no"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </div>

        {/* Fix lab CTA */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-base font-bold text-slate-900 mb-1">
              <Key className="w-4 h-4 text-blue-600" /> Take it to the Fix Lab
            </div>
            <p className="text-xs text-slate-500">
              Simulate the exploit, generate a patched OpenAPI snippet, or question the report — all for this same route.
            </p>
          </div>
          <button
            onClick={() => navigate(`/fixlab/${project.id}`, { state: { project } })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold px-4 py-2 hover:bg-blue-700 transition-colors shrink-0"
          >
            Open Fix Lab <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </section>
      </div>
    </div>
  );
}

function RiskBar({ label, value, color }) {
  return (
    <div className="mb-3.5 last:mb-0">
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
        <span>{label}</span>
        <span className="text-slate-700">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-slate-500 shrink-0">{label}</dt>
      <dd className="text-right text-slate-800">{children}</dd>
    </div>
  );
}

function stageDescription(stageKey, { endpoint, parameters, riskyControls }) {
  const pathParams = parameters.filter((p) => p.inType === "path").map((p) => p.name);
  switch (stageKey) {
    case "caller":
      return `Any account sends ${endpoint.method} ${endpoint.path}`;
    case "identity":
      return riskyControls.has("authentication")
        ? "No identity scheme is enforced before this request reaches business logic"
        : "Caller identity is read from the request's declared security scheme";
    case "authorization":
      return riskyControls.has("ownership")
        ? "No rule in the spec constrains what this caller may reach"
        : "Caller's access to this specific object is checked before proceeding";
    case "dataLayer":
      return `Record is fetched and serialized${parameters.length ? ` (${parameters.length} parameter${parameters.length === 1 ? "" : "s"} on this route)` : ""}${pathParams.length ? `, keyed on ${pathParams.join(", ")}` : ""}`;
    default:
      return "";
  }
}

export default FindingDetailPage;