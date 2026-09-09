import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import api from "../services/api";
import { cn } from "../lib/utils";
import { GridPattern } from "../components/GridPattern";
import { TranslatedText } from "../components/TranslatedText";
import {
  ArrowLeft,
  ArrowRight,
  User,
  Key,
  ShieldAlert,
  Database,
  Link2,
  Braces,
  FlaskConical,
  Wrench,
  CheckCircle2,
  OctagonAlert,
  Lock,
  Shield,
} from "lucide-react";

const SEVERITY_COLORS = { CRITICAL: "#dc2626", HIGH: "#ea580c", MEDIUM: "#ca8a04", LOW: "#16a34a" };
const RISK_LEVELS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

const LIFECYCLE_STAGES = [
  { key: "caller", label: "Caller", icon: User },
  { key: "identity", label: "Identity", icon: Key },
  { key: "authorization", label: "Authorization", icon: ShieldAlert },
  { key: "dataLayer", label: "Data layer", icon: Database },
];

const OWASP_RULES = {
  API1: { breaksAt: "authorization", risky: ["inputConstraints", "rateLimit"] },
  API2: { breaksAt: "identity", risky: ["authentication", "rateLimit"] },
  API3: { breaksAt: "dataLayer", risky: ["inputConstraints", "versionInventory"] },
  API4: { breaksAt: "caller", risky: ["rateLimit", "inputConstraints"] },
  API5: { breaksAt: "authorization", risky: ["authentication"] },
  API6: { breaksAt: "authorization", risky: ["rateLimit"] },
  API7: { breaksAt: "caller", risky: ["inputConstraints"] },
  API8: { breaksAt: "identity", risky: ["authentication", "rateLimit"] },
  API9: { breaksAt: "authorization", risky: ["versionInventory", "inputConstraints", "rateLimit"] },
  API10: { breaksAt: "caller", risky: ["inputConstraints", "authentication"] },
};

const CONTROL_COPY = {
  authentication: {
    title: "Authentication",
    missing: "No security scheme declared on this operation",
    present: "Declared on the operation",
  },
  versionInventory: {
    title: "Version inventory",
    missing: "No versioned path or deprecation policy in the spec",
    present: "This operation is versioned and inventoried in the spec",
  },
  inputConstraints: {
    title: "Page size cap",
    missing: "Result set size is unbounded",
    present: "Parameters carry explicit type/format constraints",
  },
  rateLimit: {
    title: "Rate limiting",
    missing: "No documented throttle for this route",
    present: "A throttle is documented for this route",
  },
};

const SENSITIVE_KEYWORDS = [
  "user", "email", "phone", "ssn", "address", "token", "password", "secret",
  "auth", "card", "iban", "account", "salary", "income", "health", "medical",
  "heart", "gps", "location", "lat", "lng", "dob", "birth", "gender", "race",
];

const FLAGGED_PARAM_NAMES = new Set(["limit", "offset", "page", "size", "userid", "id"]);

function isSensitiveField(name = "") {
  const n = name.toLowerCase();
  return SENSITIVE_KEYWORDS.some((k) => n.includes(k));
}

function isFlaggedParam(p) {
  const n = (p.name || "").toLowerCase();
  if (isSensitiveField(n)) return true;
  if (FLAGGED_PARAM_NAMES.has(n) || n.endsWith("id")) return true;
  return false;
}

function flagReason(p) {
  const n = (p.name || "").toLowerCase();
  if (n === "limit" || n === "offset" || n === "page" || n === "size") {
    return "Result set size is unbounded";
  }
  if (n.endsWith("id") || n === "userid") {
    return "Identifier has no format or pattern";
  }
  if (isSensitiveField(n)) {
    return "Carries a personal or sensitive value";
  }
  return "No constraint issue on this field";
}

function owaspRuleFor(owaspCategory) {
  const key = Object.keys(OWASP_RULES).find((k) => owaspCategory?.toUpperCase().startsWith(k));
  return OWASP_RULES[key] || { breaksAt: "authorization", risky: ["inputConstraints"] };
}

function owaspCodeOf(category) {
  if (!category) return null;
  const match = category.match(/^([A-Za-z0-9]+:\d{4})/);
  return match ? match[1] : category;
}

const CARD = "bg-white rounded-xl border border-[#e5e7eb]";

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
      <div className="min-h-screen bg-[#eef2f8] flex items-center justify-center font-mono-tech text-slate-500 text-xs uppercase tracking-wider">
        Loading finding…
      </div>
    );
  }

  const { endpoint, audit } = current;
  const parameters = endpoint.parameters || [];
  const testScenarios = audit.testScenarios || [];
  const sevColor = SEVERITY_COLORS[audit.riskLevel] || "#64748b";
  const rule = owaspRuleFor(audit.owaspCategory);
  const riskyControls = new Set(rule.risky);
  const flaggedParams = parameters.filter(isFlaggedParam);
  const requiredParams = parameters.filter((p) => p.required);
  const optionalParams = parameters.filter((p) => !p.required);
  const declaredTypes = [...new Set(parameters.map((p) => p.dataType).filter(Boolean))];

  const goToFinding = (index) => {
    const wrapped = ((index % findings.length) + findings.length) % findings.length;
    const f = findings[wrapped];
    navigate(`/dashboard/${projectId}/findings/${f.endpoint.id}/${f.audit.id}`, { state: { project } });
  };

  return (
    <div className="relative min-h-screen w-full bg-[#eef2f8] text-slate-900 font-mono-tech px-6 py-6 overflow-x-hidden text-[13px] leading-[1.45]">
      <div className="fixed inset-0 pointer-events-none z-0">
        <GridPattern
          width={20}
          height={20}
          x={-1}
          y={-1}
          className={cn("stroke-blue-500/20", "[mask-image:linear-gradient(to_bottom_right,white,transparent_40%,transparent_60%,white)]")}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto space-y-4">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-blue-200/60 pb-3">
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
                <button onClick={() => navigate(`/dashboard/${projectId}`, { state: { project } })} className="text-slate-500 hover:text-blue-500 transition-colors">
                  Dashboard
                </button>
                <button onClick={() => navigate(`/fixlab/${project.id}`, { state: { project } })} className="text-slate-500 hover:text-blue-500 transition-colors">
                  Fix Lab
                </button>
                <button onClick={() => navigate(`/owasp/${projectId}`, { state: { project } })} className="text-slate-500 hover:text-blue-500 transition-colors">
                  OWASP
                </button>
                <button onClick={() => navigate("/history")} className="text-slate-500 hover:text-blue-500 transition-colors">
                  History
                </button>
              </nav>
            </div>
          </div>
        </header>

        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(`/dashboard/${projectId}`, { state: { project } })}
            className="flex items-center gap-1.5 text-[13px] text-blue-600 hover:text-blue-700 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to report
          </button>
          <button
            onClick={() => goToFinding(currentIndex + 1)}
            className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 text-white text-[12px] font-semibold px-3.5 py-1.5 hover:bg-blue-700 transition-colors"
          >
            Next finding <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <section className={`${CARD} p-5`}>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.85fr)_minmax(240px,0.9fr)] gap-5">
            <div>
              <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#e8f1ff] text-[#2563eb]">
                  {endpoint.method}
                </span>
                <span
                  className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1"
                  style={{ color: sevColor, backgroundColor: `${sevColor}18` }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sevColor }} />
                  {audit.riskLevel}
                </span>
                {owaspCodeOf(audit.owaspCategory) && (
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                    {owaspCodeOf(audit.owaspCategory)}
                  </span>
                )}
              </div>

              <h1 className="text-[24px] leading-tight font-bold tracking-tight text-black">
                <TranslatedText text={audit.vulnerability} />
              </h1>
              <p className="text-[13px] text-[#3b82f6] mt-1">{endpoint.path}</p>
              {endpoint.summary && (
                <p className="text-[12px] text-slate-400 mt-1">
                  <TranslatedText text={endpoint.summary} />
                </p>
              )}
              <p className="mt-2.5 text-[12px] text-[#6b7280] leading-[1.5] max-w-[52rem]">
                <TranslatedText text={audit.description} />
              </p>
            </div>

            <div className="rounded-xl bg-[#f4f6f9] border border-slate-200/70 p-4">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3b82f6]">
                <Shield className="w-3.5 h-3.5" strokeWidth={2} />
                Risk level
              </div>
              <p className="text-[32px] leading-none font-extrabold tracking-tight text-[#0f172a] mt-1.5">
                {audit.riskLevel}
              </p>
              <p className="mt-1.5 text-[11px] text-slate-400 leading-[1.4]">
                {owaspCodeOf(audit.owaspCategory)}
                {audit.vulnerability ? " · " : ""}
                {audit.vulnerability && <TranslatedText text={audit.vulnerability} />}
              </p>

              <div className="mt-4 space-y-2">
                {RISK_LEVELS.map((level) => {
                  const active = level === audit.riskLevel;
                  const color = SEVERITY_COLORS[level];
                  return (
                    <div key={level} className="flex items-center gap-3">
                      <span className="w-[4.5rem] text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        {level}
                      </span>
                      <div className="flex-1 h-1.5 rounded-full bg-[#dbe3ee] overflow-hidden">
                        {active && (
                          <div className="h-full w-full rounded-full" style={{ backgroundColor: color }} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 border-t border-slate-200" />

              <dl className="mt-3 space-y-1.5 text-[12px] text-slate-500">
                <div className="flex justify-between gap-4">
                  <dt>Declared parameters</dt>
                  <dd className="font-semibold text-[#0f172a]">{parameters.length}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Flagged parameters</dt>
                  <dd className="font-semibold text-red-500">{flaggedParams.length}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Test scenarios</dt>
                  <dd className="font-semibold text-[#0f172a]">{testScenarios.length}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <section className={`${CARD} p-5`}>
          <div className="flex items-center gap-1.5 text-[14px] font-bold text-slate-900">
            <Link2 className="w-4 h-4 text-blue-600" /> Request lifecycle
          </div>
          <p className="text-[12px] text-slate-500 mt-1 mb-3">
            Where a call to this route passes — and the exact stage the specification leaves unguarded.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {LIFECYCLE_STAGES.map((stage, i) => {
              const breaksHere = stage.key === rule.breaksAt;
              const StageIcon = stage.icon;
              return (
                <div
                  key={stage.key}
                  className={cn(
                    "rounded-lg border p-3",
                    breaksHere ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"
                  )}
                >
                  <div
                    className={cn(
                      "inline-flex items-center justify-center w-7 h-7 rounded-full mb-2",
                      breaksHere ? "bg-red-100 text-red-600" : "bg-blue-50 text-blue-600"
                    )}
                  >
                    <StageIcon className="w-3.5 h-3.5" />
                  </div>
                  <p className={cn("text-[12px] font-bold", breaksHere ? "text-red-700" : "text-slate-900")}>
                    {i + 1} · {stage.label}
                  </p>
                  <p className={cn("text-[11px] leading-[1.4] mt-1", breaksHere ? "text-red-600/80" : "text-slate-500")}>
                    {stageDescription(stage.key, { endpoint, parameters, riskyControls })}
                  </p>
                  {breaksHere && (
                    <span className="inline-block mt-2 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200">
                      Breaks here
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <section className={`${CARD} p-5`}>
            <div className="flex items-center gap-1.5 text-[14px] font-bold text-slate-900 mb-2.5">
              <Braces className="w-4 h-4 text-blue-500" /> Endpoint contract
            </div>

            <dl className="text-[12px]">
              <Row label="Operation">
                <span className="font-semibold text-slate-900">{endpoint.method} {endpoint.path}</span>
              </Row>
              {endpoint.summary && (
                <Row label="Summary">
                  <TranslatedText text={endpoint.summary} />
                </Row>
              )}
              <Row label="Required inputs">
                <span className="font-semibold">{requiredParams.length ? requiredParams.map((p) => p.name).join(", ") : "none"}</span>
              </Row>
              <Row label="Optional inputs">
                <span>{optionalParams.length ? optionalParams.map((p) => p.name).join(", ") : "none"}</span>
              </Row>
              {declaredTypes.length > 0 && (
                <Row label="Declared types"><span>{declaredTypes.join(", ")}</span></Row>
              )}
              {parameters.length > 0 && (
                <Row label="Flagged parameters">
                  <span className="font-bold text-red-500">{flaggedParams.length} of {parameters.length}</span>
                </Row>
              )}
              {project.fileName && (
                <Row label="Source file" last><span>{project.fileName}</span></Row>
              )}
            </dl>

            {(endpoint.description || audit.description) && (
              <div className="mt-3 rounded-lg bg-[#f3f5f8] px-3 py-2.5">
                <TranslatedText
                  text={endpoint.description || audit.description}
                  block
                  className="text-[11px] text-slate-500 leading-[1.45]"
                />
              </div>
            )}

            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-blue-500 mt-4 mb-2">
              <Lock className="w-3.5 h-3.5" /> Controls expected here
            </div>

            <div className="space-y-2">
              {Object.keys(CONTROL_COPY).map((key) => {
                const missing = riskyControls.has(key);
                const copy = CONTROL_COPY[key];
                return (
                  <div
                    key={key}
                    className={cn(
                      "flex items-start gap-2.5 rounded-lg border px-3 py-2",
                      missing ? "border-red-200 bg-[#fef2f2]" : "border-teal-200 bg-[#f0fdfa]"
                    )}
                  >
                    {missing ? (
                      <span className="mt-px inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shrink-0">
                        !
                      </span>
                    ) : (
                      <span className="mt-px inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-teal-500 text-white shrink-0">
                        <CheckCircle2 className="w-3 h-3" strokeWidth={2.5} />
                      </span>
                    )}
                    <div>
                      <p className="text-[12px] font-bold text-slate-900 leading-tight">{copy.title}</p>
                      <p className="text-[11px] text-slate-500 leading-[1.4] mt-0.5">
                        {missing ? copy.missing : copy.present}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className={`${CARD} p-5`}>
            <div className="flex items-center gap-1.5 text-[14px] font-bold text-slate-900">
              <OctagonAlert className="w-4 h-4 text-red-500" /> Parameter surface at risk
            </div>
            <p className="text-[12px] text-slate-400 mt-1 mb-3 leading-[1.45]">
              Parameters this route accepts. Highlighted rows carry unconstrained or sensitive values.
            </p>

            {parameters.length === 0 ? (
              <p className="text-[12px] text-slate-400">No parameters declared on this operation.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-slate-400 bg-[#f4f6f9]">
                      <th className="py-2 px-3 font-semibold">Name</th>
                      <th className="py-2 px-3 font-semibold">In</th>
                      <th className="py-2 px-3 font-semibold">Type</th>
                      <th className="py-2 px-3 font-semibold">Required</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parameters.map((p, i) => {
                      const flagged = isFlaggedParam(p);
                      const last = i === parameters.length - 1;
                      return (
                        <tr
                          key={p.id}
                          className={cn(
                            !last && "border-b border-slate-200",
                            flagged && "bg-[#fef2f2]"
                          )}
                        >
                          <td className="py-2 px-3 align-top">
                            <div className="flex items-start gap-1.5">
                              {flagged && <OctagonAlert className="w-3.5 h-3.5 text-red-500 mt-px shrink-0" />}
                              <div>
                                <p className={cn("font-bold leading-tight", flagged ? "text-red-600" : "text-slate-900")}>
                                  {p.name}
                                </p>
                                <p className="text-[10px] text-slate-400 leading-[1.4] mt-0.5">
                                  {flagReason(p)}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-3 align-top text-slate-500">{p.inType}</td>
                          <td className="py-2 px-3 align-top text-slate-500">{p.dataType}</td>
                          <td className="py-2 px-3 align-top text-slate-500">{p.required ? "yes" : "no"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 border-t border-slate-200 pt-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-blue-500 mb-2.5">
                <FlaskConical className="w-3.5 h-3.5" /> Test scenarios ({testScenarios.length})
              </div>

              {testScenarios.length === 0 ? (
                <p className="text-[12px] text-slate-400">No test scenarios recorded for this finding.</p>
              ) : (
                <ol className="space-y-2">
                  {testScenarios.map((scenario, i) => (
                    <li key={scenario.id || i} className="flex gap-2.5 items-start">
                      <span className="text-[12px] font-bold text-blue-500 w-5 shrink-0">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-slate-900 leading-[1.4]">
                          <TranslatedText text={scenario.title}>
                            {(shown) => <HighlightPath text={shown} />}
                          </TranslatedText>
                        </p>
                        {scenario.expectedStatusOnSuccess != null && (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Expected status {scenario.expectedStatusOnSuccess}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        </div>

        <section className={`${CARD} p-5`}>
          <div className="flex items-center gap-1.5 text-[14px] font-bold text-slate-900">
            <Wrench className="w-4 h-4 text-teal-500" strokeWidth={2} /> Remediation
          </div>
          <div className="mt-2 max-w-5xl">
            <TranslatedText
              text={audit.remediation || "No remediation guidance was returned for this finding."}
              block
              className="text-[13px] text-slate-800 leading-[1.5]"
            />
          </div>

          <div className="mt-4 border-t border-slate-200" />

          <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-[11px] text-slate-400 leading-[1.45] max-w-xl">
              Need the exploit walkthrough or a patched specification snippet for this route? Both live in the Fix Lab.
            </p>
            <button
              onClick={() => navigate(`/fixlab/${project.id}`, { state: { project } })}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#2563eb] text-white text-[12px] font-semibold px-4 py-2 hover:bg-blue-700 transition-colors shrink-0"
            >
              Open Fix Lab <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Row({ label, children, last = false }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-2", !last && "border-b border-slate-200")}>
      <dt className="text-slate-400 shrink-0">{label}</dt>
      <dd className="text-right text-slate-800">{children}</dd>
    </div>
  );
}

function HighlightPath({ text = "" }) {
  const parts = String(text).split(/(\b(?:GET|POST|PUT|PATCH|DELETE)\s+\/[^\s,]+)/g);
  return parts.map((part, i) =>
    /^(GET|POST|PUT|PATCH|DELETE)\s+\//.test(part) ? (
      <span key={i} className="text-slate-600">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
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
      return "No rule in the spec constrains what this caller may reach";
    case "dataLayer":
      return `Record is fetched and serialized${parameters.length ? ` (${parameters.length} parameter${parameters.length === 1 ? "" : "s"} on this route)` : ""}${pathParams.length ? `, keyed on ${pathParams.join(", ")}` : ""}`;
    default:
      return "";
  }
}

export default FindingDetailPage;
