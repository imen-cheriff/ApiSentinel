import { useParams } from "react-router-dom";

function DashboardPage() {
  const { projectId } = useParams();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <p>Dashboard for project {projectId} — coming in Week 2</p>
    </div>
  );
}

export default DashboardPage;