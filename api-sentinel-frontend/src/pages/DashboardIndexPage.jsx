import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { Activity } from "lucide-react";

function DashboardIndexPage() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get("/api/projects")
      .then((res) => {
        const projects = res.data || [];
        if (projects.length === 0) {
          navigate("/", { replace: true }); // nothing scanned yet -> back to upload
          return;
        }
        const latest = [...projects].sort(
          (a, b) => new Date(b.scanDate) - new Date(a.scanDate)
        )[0];
        navigate(`/dashboard/${latest.id}`, { replace: true });
      })
      .catch(() => setError("Could not load your latest scan."));
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#eef2f8] flex flex-col items-center justify-center font-mono text-slate-500 gap-3">
      <Activity className="w-6 h-6 animate-spin text-blue-600" />
      <span className="text-xs tracking-wider uppercase">{error || "Loading your latest scan…"}</span>
    </div>
  );
}

export default DashboardIndexPage;