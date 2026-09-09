import axios from "axios";
import { normalizeApiError } from "./apiErrors";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(normalizeApiError(error))
);

export const askSpec = async (projectId, message, history) => {
  const res = await api.post(`/api/projects/${projectId}/chat`, { message, history });
  return res.data; // { reply }
};

export const simulateAttack = async (projectId, finding) => {
  const res = await api.post(`/api/projects/${projectId}/simulate`, {
    method: finding.method,
    path: finding.path,
    vulnerability: finding.vulnerability,
    owaspTag: finding.owaspTag,
    riskLevel: finding.riskLevel,
  });
  return res.data;
};

export const generateAutoFixPatch = async (projectId, finding) => {
  const res = await api.post(`/api/projects/${projectId}/autofix`, {
    method: finding.method,
    path: finding.path,
    vulnerability: finding.vulnerability,
    owaspTag: finding.owaspTag,
    riskLevel: finding.riskLevel,
    vulnerableSpecification: finding.vulnerableSpecification,
  });
  return res.data;
};

export default api;