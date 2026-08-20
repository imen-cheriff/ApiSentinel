package com.apisentinel.backend.exception;

import com.apisentinel.backend.ai.GeminiClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    public record ErrorResponse(String code, String message) {}

    @ExceptionHandler(GeminiClient.QuotaExceededException.class)
    public ResponseEntity<ErrorResponse> handleQuotaExceeded(GeminiClient.QuotaExceededException ex) {
        log.warn("Gemini quota exceeded: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .body(new ErrorResponse("QUOTA_EXCEEDED", ex.getMessage()));
    }

    @ExceptionHandler(GeminiClient.GeminiCallException.class)
    public ResponseEntity<ErrorResponse> handleGeminiCallFailure(GeminiClient.GeminiCallException ex) {
        log.error("Gemini call failed", ex);
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(new ErrorResponse("AI_CALL_FAILED", "The AI audit failed, please try again in a moment."));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleBadRequest(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ErrorResponse("BAD_REQUEST", ex.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneric(Exception ex) {
        log.error("Unexpected error", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("INTERNAL_ERROR", "An error occurred."));
    }

    @ExceptionHandler(GeminiClient.GeminiOverloadedException.class)
    public ResponseEntity<ErrorResponse> handleGeminiOverloaded(GeminiClient.GeminiOverloadedException ex) {
        log.warn("Gemini overloaded: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(new ErrorResponse("AI_OVERLOADED", ex.getMessage()));
    }
}