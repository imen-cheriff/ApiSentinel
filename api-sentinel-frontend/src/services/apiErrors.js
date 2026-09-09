export class ApiError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export function normalizeApiError(error) {
  const body = error?.response?.data; 
  const status = error?.response?.status;

  if (body?.code) {
    return new ApiError(body.message || "Something went wrong. Please try again.", body.code, status);
  }
  if (error?.code === "ECONNABORTED") {
    return new ApiError("The request timed out. Please try again.", "TIMEOUT", status);
  }
  if (error?.request && !error?.response) {
    return new ApiError("Couldn't reach the server. Check your connection and try again.", "NETWORK_ERROR", status);
  }
  return new ApiError(error?.message || "Something went wrong. Please try again.", "UNKNOWN_ERROR", status);
}

const MESSAGES_BY_CODE = {
  QUOTA_EXCEEDED: "The AI quota has been reached for now. Please try again later.",
  AI_OVERLOADED: "The AI service is overloaded right now. Please try again in a moment.",
  AI_CALL_FAILED: "The AI request failed. Please try again in a moment.",
  AI_RESPONSE_INVALID: "The AI returned an unexpected response. Please try again.",
  NOT_FOUND: "That project or finding couldn't be found.",
  BAD_REQUEST: "That request wasn't valid.",
  NETWORK_ERROR: "Couldn't reach the server. Check your connection and try again.",
  TIMEOUT: "The request timed out. Please try again.",
};

export function getErrorMessage(err, fallback = "Something went wrong. Please try again.") {
  if (err?.code && MESSAGES_BY_CODE[err.code]) return MESSAGES_BY_CODE[err.code];
  if (err?.message) return err.message;
  return fallback;
}