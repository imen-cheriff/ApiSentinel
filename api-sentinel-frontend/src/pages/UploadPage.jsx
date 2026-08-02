import { useNavigate } from "react-router-dom";
import OpenApiUploader from "../components/OpenApiUploader";

function UploadPage() {
  const navigate = useNavigate();

  const handleUploadSuccess = (data) => {
    // data doit contenir l'id du projet créé côté backend
    navigate(`/dashboard/${data.projectId}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center px-6">
      <div className="max-w-xl w-full text-center mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">API Sentinel</h1>
        <p className="text-slate-400 mt-2">
          Import your OpenAPI specification to run an automated security audit
          based on the OWASP API Security Top 10.
        </p>
      </div>

      <div className="max-w-xl w-full">
        <OpenApiUploader onUploadSuccess={handleUploadSuccess} />
      </div>
    </div>
  );
}

export default UploadPage;