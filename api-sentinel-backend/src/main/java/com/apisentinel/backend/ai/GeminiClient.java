package com.apisentinel.backend.ai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;
import java.util.Map;

@Service
public class GeminiClient {

    private static final Logger log = LoggerFactory.getLogger(GeminiClient.class);

    private static final int MAX_ATTEMPTS = 3;
    private static final int MAX_ATTEMPTS_OVERLOADED = 5;
    private static final int MAX_ATTEMPTS_FALLBACK = 2;
    private static final long INITIAL_BACKOFF_MS = 2_000;
    private static final long MAX_BACKOFF_MS = 20_000;

    private static final String DAILY_QUOTA_MARKER = "PerDay";

    private final RestTemplate restTemplate;
    private final JsonMapper jsonMapper;

    @Value("${gemini.api.key}")
    private String apiKey;

    @Value("${gemini.api.url}")
    private String apiUrl;

    @Value("${gemini.api.url.fallback}")
    private String fallbackApiUrl;

    public GeminiClient(RestTemplate restTemplate, JsonMapper jsonMapper) {
        this.restTemplate = restTemplate;
        this.jsonMapper = jsonMapper;
    }

    public String generateText(String prompt) {
        Map<String, Object> body = Map.of(
                "contents", List.of(
                        Map.of("parts", List.of(Map.of("text", prompt)))
                )
        );
        return generateWithFallback(body);
    }

    public String generateStructuredJson(String prompt, Map<String, Object> jsonSchema) {
        Map<String, Object> body = Map.of(
                "contents", List.of(
                        Map.of("parts", List.of(Map.of("text", prompt)))
                ),
                "generationConfig", Map.of(
                        "responseMimeType", "application/json",
                        "responseSchema", jsonSchema
                )
        );
        return generateWithFallback(body);
    }

    private String generateWithFallback(Map<String, Object> body) {
        try {
            return callGeminiWithRetry(body, apiUrl, MAX_ATTEMPTS_OVERLOADED, "primary");
        } catch (GeminiOverloadedException primaryFailure) {
            log.warn("Primary model overloaded after exhausting retries, switching to fallback model");
            try {
                return callGeminiWithRetry(body, fallbackApiUrl, MAX_ATTEMPTS_FALLBACK, "fallback");
            } catch (GeminiCallException fallbackFailure) {
                log.error("Fallback model also failed, giving up definitively");
                GeminiOverloadedException finalError = new GeminiOverloadedException(
                        "Both the primary and fallback Gemini models are temporarily unavailable. "
                                + "Please try again in a few minutes.", fallbackFailure);
                finalError.addSuppressed(primaryFailure);
                throw finalError;
            }
        }
    }

    private String callGeminiWithRetry(Map<String, Object> body, String targetUrl, int maxAttempts, String label) {
        RuntimeException lastError = null;
        int attempt = 1;

        while (true) {
            try {
                return callGemini(body, targetUrl);
            } catch (HttpStatusCodeException e) {
                if (isDailyQuotaExhausted(e)) {
                    log.warn("Daily Gemini quota exhausted (model {}), stopping retries", label);
                    throw new QuotaExceededException(
                            "Free daily Gemini quota exhausted for this model. "
                                    + "The quota resets the next day (midnight Pacific time) — "
                                    + "try again later, or enable billing on the Google AI Studio project "
                                    + "to lift the free tier limit.", e);
                }

                boolean overloaded = isOverloaded(e);

                if (!isRetryable(e) || attempt >= maxAttempts) {
                    log.error("Final failure calling Gemini (model {}) after {} attempt(s): {}",
                            label, attempt, e.getMessage());
                    if (overloaded) {
                        throw new GeminiOverloadedException(
                                "The Gemini model is temporarily overloaded (high demand). "
                                        + "Please try again in a minute.", e);
                    }
                    throw new GeminiCallException("Gemini call failed: " + e.getMessage(), e);
                }

                lastError = new GeminiCallException("Gemini call failed: " + e.getMessage(), e);
                long backoffMs = computeBackoff(attempt);
                log.warn("Gemini call failed (model {}, attempt {}/{}, status {}), retrying in {} ms",
                        label, attempt, maxAttempts, e.getStatusCode().value(), backoffMs);
                sleep(backoffMs);
                attempt++;
            } catch (RestClientException e) {
                if (attempt >= maxAttempts) {
                    log.error("Final failure calling Gemini (model {}, network) after {} attempt(s)",
                            label, attempt);
                    throw new GeminiCallException("Gemini call failed: " + e.getMessage(), e);
                }
                lastError = new GeminiCallException("Gemini call failed: " + e.getMessage(), e);
                sleep(computeBackoff(attempt));
                attempt++;
            }
        }
    }

    private boolean isRetryable(HttpStatusCodeException httpEx) {
        HttpStatusCode status = httpEx.getStatusCode();
        return status.is5xxServerError() || status.value() == 429;
    }

    private boolean isOverloaded(HttpStatusCodeException httpEx) {
        return httpEx.getStatusCode().value() == 503;
    }

    private boolean isDailyQuotaExhausted(HttpStatusCodeException httpEx) {
        if (httpEx.getStatusCode().value() != 429) {
            return false;
        }
        String responseBody = httpEx.getResponseBodyAsString();
        return responseBody != null && responseBody.contains(DAILY_QUOTA_MARKER);
    }

    private long computeBackoff(int attempt) {
        long exp = INITIAL_BACKOFF_MS * (1L << (attempt - 1));
        long capped = Math.min(exp, MAX_BACKOFF_MS);
        long jitter = (long) (Math.random() * capped * 0.3);
        return capped + jitter;
    }

    private void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new GeminiCallException("Interrupted while waiting before retry", e);
        }
    }

    private String callGemini(Map<String, Object> body, String targetUrl) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
        String url = targetUrl + "?key=" + apiKey;

        ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);
        return extractText(response.getBody());
    }

    private String extractText(String rawResponse) {
        try {
            JsonNode root = jsonMapper.readTree(rawResponse);
            return root
                    .path("candidates").get(0)
                    .path("content")
                    .path("parts").get(0)
                    .path("text")
                    .asString();
        } catch (Exception e) {
            throw new GeminiCallException("Unreadable Gemini response: " + rawResponse, e);
        }
    }

    public static class GeminiCallException extends RuntimeException {
        public GeminiCallException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    public static class QuotaExceededException extends GeminiCallException {
        public QuotaExceededException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    public static class GeminiOverloadedException extends GeminiCallException {
        public GeminiOverloadedException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}