package com.apisentinel.backend.ai;

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

    private static final int MAX_ATTEMPTS = 3;
    private static final long INITIAL_BACKOFF_MS = 2_000;

    private static final String DAILY_QUOTA_MARKER = "PerDay";

    private final RestTemplate restTemplate;
    private final JsonMapper jsonMapper;

    @Value("${gemini.api.key}")
    private String apiKey;

    @Value("${gemini.api.url}")
    private String apiUrl;

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
        return callGeminiWithRetry(body);
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
        return callGeminiWithRetry(body);
    }

    private String callGeminiWithRetry(Map<String, Object> body) {
        RuntimeException lastError = null;

        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                return callGemini(body);
            } catch (HttpStatusCodeException e) {
                if (isDailyQuotaExhausted(e)) {
                    throw new QuotaExceededException(
                            "Quota gratuit Gemini quotidien épuisé pour ce modèle. "
                                    + "Le quota se réinitialise le lendemain (minuit, heure du Pacifique) — "
                                    + "réessayez plus tard, ou activez la facturation sur le projet Google AI Studio "
                                    + "pour lever la limite du free tier.", e);
                }
                if (!isRetryable(e) || attempt == MAX_ATTEMPTS) {
                    throw new GeminiCallException("Échec de l'appel à Gemini : " + e.getMessage(), e);
                }
                lastError = new GeminiCallException("Échec de l'appel à Gemini : " + e.getMessage(), e);
                long backoffMs = INITIAL_BACKOFF_MS * (1L << (attempt - 1)); // 2s, 4s
                sleep(backoffMs);
            } catch (RestClientException e) {
                if (attempt == MAX_ATTEMPTS) {
                    throw new GeminiCallException("Échec de l'appel à Gemini : " + e.getMessage(), e);
                }
                lastError = new GeminiCallException("Échec de l'appel à Gemini : " + e.getMessage(), e);
                sleep(INITIAL_BACKOFF_MS * (1L << (attempt - 1)));
            }
        }
        throw lastError; // inatteignable en pratique, mais requis par le compilateur
    }

    private boolean isRetryable(HttpStatusCodeException httpEx) {
        HttpStatusCode status = httpEx.getStatusCode();
        return status.is5xxServerError() || status.value() == 429;
    }

    private boolean isDailyQuotaExhausted(HttpStatusCodeException httpEx) {
        if (httpEx.getStatusCode().value() != 429) {
            return false;
        }
        String responseBody = httpEx.getResponseBodyAsString();
        return responseBody != null && responseBody.contains(DAILY_QUOTA_MARKER);
    }

    private void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new GeminiCallException("Interrompu pendant l'attente avant retry", e);
        }
    }

    private String callGemini(Map<String, Object> body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
        String url = apiUrl + "?key=" + apiKey;

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
                    .asString(); // asText() a été renommé asString() en Jackson 3
        } catch (Exception e) {
            throw new GeminiCallException("Réponse Gemini illisible : " + rawResponse, e);
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
}