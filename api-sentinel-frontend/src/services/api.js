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
  return res.data;
};

export const simulateAttack = async (projectId, finding, options = {}) => {
  const res = await api.post(
    `/api/projects/${projectId}/simulate`,
    { auditResultId: finding.auditResultId },
    { signal: options.signal }
  );
  return res.data;
};

export const generateAutoFixPatch = async (projectId, finding, options = {}) => {
  const res = await api.post(
    `/api/projects/${projectId}/autofix`,
    { auditResultId: finding.auditResultId },
    { signal: options.signal }
  );
  return res.data;
};

export default api;