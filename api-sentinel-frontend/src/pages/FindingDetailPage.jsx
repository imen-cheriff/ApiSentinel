import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import api from "../services/api";
import { cn } from "../lib/utils";
import { GridPattern } from "../components/GridPattern";
import { ArrowLeft, ArrowRight, EyeOff, FileCode2, Wrench, Terminal, Copy, Shield } from "lucide-react";

const SEVERITY_COLORS = { CRITICAL: "#dc2626", HIGH: "#ea580c", MEDIUM: "#ca8a04", LOW: "#16a34a" };
const RISK_LEVEL_SCORE = { CRITICAL: 95, HIGH: 75, MEDIUM: 50, LOW: 20 };

function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text || "");
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
    >
      <Copy className="w-3.5 h-3.5" /> {copied ? "Copied!" : label}
    </button>
  );
}

function FindingDetailPage() {
  const { projectId, endpointId, auditId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [project, setProject] = useState(location.state?.project ?? null);
  const [falsePositive, setFalsePositive] = useState(false); // UI-only for now, see note below

  useEffect(() => {
    if (project) return; // came with state, e.g. from the dashboard cards
    api.get(`/api/projects/${projectId}`).then((res) => setProject(res.data));
  }, [projectId, project]);

  // Flatten every (endpoint, finding) pair into one ordered list for prev/next.
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
  const sevColor = SEVERITY_COLORS[audit.riskLevel] || "#64748b";
  const riskScore = RISK_LEVEL_SCORE[audit.riskLevel] || 0;
  const scenario = audit.testScenarios?.[0];

  const goToFinding = (index) => {
    const wrapped = ((index % findings.length) + findings.length) % findings.length;
    const f = findings[wrapped];
    navigate(`/dashboard/${projectId}/findings/${f.endpoint.id}/${f.audit.id}`, { state: { project } });
  };

  // No raw OpenAPI snippet is stored per endpoint yet, so this is reconstructed
  // from the parsed fields (path/method/parameters) rather than the literal source text.
  const specSnippet = `"${endpoint.path}": {
  "${endpoint.method.toLowerCase()}": {
    "summary": "${endpoint.summary || ""}",
    "parameters": [${(endpoint.parameters || [])
      .map((p) => `\n      { "name": "${p.name}", "in": "${p.inType}" }`)
      .join(",")}${endpoint.parameters?.length ? "\n    " : ""}]
  }
}`;

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
        {/* Header — identical markup/classes to Dashboard & History, only the right-side actions differ */}
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
                <span className="text-blue-700">Dashboard</span>
                <button onClick={() => navigate("/history")} className="text-slate-500 hover:text-blue-700 transition-colors">
                  History
                </button>
                <button onClick={() => navigate(`/owasp/${projectId}`, { state: { project } })} className="text-slate-500 hover:text-blue-700 transition-colors">
                  OWASP
                </button>
              </nav>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setFalsePositive((v) => !v)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm ${
                falsePositive
                  ? "bg-slate-800 text-white border-slate-800"
                  : "bg-white/90 border-blue-200 text-slate-700 hover:bg-blue-50"
              }`}
            >
              <EyeOff className="w-3.5 h-3.5" />
              {falsePositive ? "Marked as false positive" : "Mark false positive"}
            </button>
            <button
              onClick={() => goToFinding(currentIndex + 1)}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-sm text-xs"
            >
              Next finding <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        <div className="max-w-3xl mx-auto w-full">
        <button
          onClick={() => navigate(`/dashboard/${projectId}`, { state: { project } })}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to report
        </button>

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200 bg-slate-100 text-slate-600">
            {endpoint.method}
          </span>
          <span
            className="font-mono text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1"
            style={{ color: sevColor, backgroundColor: `${sevColor}0d`, borderColor: `${sevColor}25` }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sevColor }} /> {audit.riskLevel}
          </span>
          {audit.owaspCategory && (
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-500">
              {audit.owaspCategory}
            </span>
          )}
          <span className="ml-auto text-xs text-slate-500">
            Risk score <span className="text-base font-bold text-slate-900">{riskScore}</span>
          </span>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">{audit.vulnerability}</h1>
        <p className="text-blue-600 text-sm mb-4">{endpoint.path}</p>
        <p className="text-sm text-slate-600 leading-relaxed mb-8">{audit.description}</p>

        <section className="rounded-2xl border border-slate-100 bg-white shadow-sm p-6 mb-5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
            <FileCode2 className="w-3.5 h-3.5 text-blue-600" /> Vulnerable specification
          </div>
          <pre className="p-4 bg-slate-50 border border-slate-100 text-slate-700 rounded-lg text-[11px] overflow-x-auto whitespace-pre-wrap">
            {specSnippet}
          </pre>
        </section>

        {audit.remediation && (
          <section className="rounded-2xl border border-slate-100 bg-white shadow-sm p-6 mb-5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
              <Wrench className="w-3.5 h-3.5 text-blue-600" /> Suggested fix
            </div>
            <pre className="p-4 bg-slate-50 border border-slate-100 text-slate-700 rounded-lg text-[11px] overflow-x-auto whitespace-pre-wrap">
              {audit.remediation}
            </pre>
            <CopyButton text={audit.remediation} label="Copy fix" />
          </section>
        )}

        {scenario && (
          <section className="rounded-2xl border border-slate-100 bg-white shadow-sm p-6">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
              <Terminal className="w-3.5 h-3.5 text-blue-600" /> Proof of concept
            </div>
            {scenario.steps && (
              <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 mb-3">
                {scenario.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            )}
            <pre className="p-4 bg-slate-50 border border-slate-100 text-slate-700 rounded-lg text-[11px] overflow-x-auto whitespace-pre-wrap">
              {scenario.payloadExample}
            </pre>
            <CopyButton text={scenario.payloadExample} label="Copy request" />
          </section>
        )}
        </div>
      </div>
    </div>
  );
}

export default FindingDetailPage;