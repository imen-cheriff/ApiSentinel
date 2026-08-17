import { useNavigate } from "react-router-dom";
import { Shield, Download, RotateCw } from "lucide-react";

function AppHeader({ active = "dashboard", right }) {
  const navigate = useNavigate();
  const tabClass = (tab) =>
    `transition-colors ${active === tab ? "text-blue-700" : "text-slate-500 hover:text-blue-700"}`;

  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-blue-200/60 px-6 py-4 bg-white/60 backdrop-blur-sm">
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
            <button onClick={() => navigate("/dashboard")} className={tabClass("dashboard")}>Dashboard</button>
            <button onClick={() => navigate("/history")} className={tabClass("history")}>History</button>
            <span className={tabClass("owasp")}>OWASP</span>
          </nav>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {right ?? (
          <>
            <button className="px-3 py-1.5 rounded-lg bg-white/90 border border-blue-200 text-slate-700 hover:bg-blue-50 transition-colors flex items-center gap-1.5 shadow-sm text-xs">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
            <button
              onClick={() => navigate("/")}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-sm text-xs"
            >
              <RotateCw className="w-3.5 h-3.5" /> New analysis
            </button>
          </>
        )}
      </div>
    </header>
  );
}

export default AppHeader;