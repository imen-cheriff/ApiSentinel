import { BrowserRouter, Routes, Route } from "react-router-dom";
import UploadPage from "./pages/UploadPage";
import DashboardPage from "./pages/DashboardPage";
import HistoryPage from "./pages/HistoryPage";
import FindingDetailPage from "./pages/FindingDetailPage";
import DashboardIndexPage from "./pages/DashboardIndexPage";
import OwaspPage from "./pages/OwaspPage";
import OwaspIndexPage from "./pages/OwaspIndexPage";

function App() {
  return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/dashboard" element={<DashboardIndexPage />} />
          <Route path="/dashboard/:projectId" element={<DashboardPage />} />
          <Route path="/dashboard/:projectId/findings/:endpointId/:auditId" element={<FindingDetailPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/owasp" element={<OwaspIndexPage />} />
          <Route path="/owasp/:projectId" element={<OwaspPage />} />
        </Routes>
      </BrowserRouter>
  );
}

export default App;