import { useNavigate, Link } from "react-router-dom";
import { History } from "lucide-react";
import OpenApiUploader from "../components/OpenApiUploader";
import DigitalRain from "../components/DigitalRain";
import Typewriter from "../components/Typewriter";

function UploadPage() {
  const navigate = useNavigate();

  const handleUploadSuccess = ({ project, auditResult }) => {
    // Both the import and the AI audit already finished on this page —
    // hand the data straight to the dashboard so it doesn't need to
    // re-fetch or re-run the audit (and show a second loading screen).
    navigate(`/dashboard/${project.id}`, { state: { project, auditResult } });
  };

  return (
    <div className="relative min-h-screen bg-[#eef2f8] text-slate-900 flex flex-col items-center justify-center px-6 overflow-hidden font-mono">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <DigitalRain
          headColor="#1e3a8a"
          trailColor="#1e40af"
          glyphSize={13}
          speed={2.2}
          density={48}
          trail={14}
          style={{ width: "100%", height: "100%", opacity: 0.55 }}
        />
        <DigitalRain
          headColor="#1d4ed8"
          trailColor="#2563eb"
          glyphSize={11}
          speed={4}
          density={32}
          trail={10}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            opacity: 0.35,
          }}
        />
      </div>

      {/* fade the rain out toward the center so text stays crisp on the light background */}
      <div
        className="fixed inset-0 z-[1] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 900px 650px at 50% 42%, #eef2f8 0%, rgba(238,242,248,0.75) 45%, rgba(238,242,248,0.25) 75%, transparent 100%)",
        }}
      />

      <div className="relative z-10 max-w-xl w-full text-center mb-10">
        <div className="inline-flex items-center gap-2 text-[11px] tracking-[0.18em] uppercase text-blue-700 mb-6 px-3.5 py-1.5 border border-blue-200 rounded-full bg-blue-50">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shadow-[0_0_8px_2px_rgba(59,111,234,0.5)] animate-pulse" />
          OWASP API Security Top 10 &middot; Automated Audit
        </div>

        <h1
          className="font-display text-5xl sm:text-6xl font-extrabold tracking-tight uppercase text-blue-600"
          style={{
            textShadow:
              "0 0 20px rgba(29,78,216,0.45), 0 0 60px rgba(29,78,216,0.35), 0 0 100px rgba(29,78,216,0.2)",
          }}
        >
          <Typewriter
            texts={["Sentinel", "Sentinel"]}
            prefix="API "
            color="#1d4ed8"
            typedColor="#1d4ed8"
            cursorColor="#1d4ed8"
            typeSpeed={90}
            holdTime={60000}
            deleteSpeed={40}
          />
        </h1>

        <p className="text-slate-500 mt-6 text-[15px] leading-relaxed">
          Import your{" "}
          <span className="text-slate-800 font-medium">
            OpenAPI specification
          </span>{" "}
          to run an automated security audit based on the OWASP API Security Top
          10.
        </p>
      </div>

      <div className="relative z-10 max-w-xl w-full">
        <OpenApiUploader onUploadSuccess={handleUploadSuccess} />
      </div>

      <div className="relative z-10 mt-4">
        <Link
          to="/history"
          className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-blue-600 transition-colors"
        >
          <History className="w-3.5 h-3.5" />
          View scan history
        </Link>
      </div>

      {/* <div className="relative z-10 flex gap-6 flex-wrap justify-center mt-8 text-[11px] tracking-wide text-slate-400">
        <span>Processed locally per session</span>
        <span>OWASP-aligned scan engine</span>
      </div> */}
    </div>
  );
}

export default UploadPage;