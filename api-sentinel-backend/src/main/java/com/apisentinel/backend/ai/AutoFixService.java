package com.apisentinel.backend.ai;

import com.apisentinel.backend.ai.dto.AutoFixRequest;
import com.apisentinel.backend.ai.dto.AutoFixResponse;
import com.apisentinel.backend.exception.AiResponseParseException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AutoFixService {

    private final GeminiClient geminiClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AutoFixResponse generatePatch(AutoFixRequest request) {
        String prompt = buildPrompt(request);
        String rawJson = geminiClient.generateText(prompt);

        try {
            String cleaned = rawJson.replaceAll("```json", "").replaceAll("```", "").trim();
            return objectMapper.readValue(cleaned, AutoFixResponse.class);
        } catch (Exception e) {
            throw new AiResponseParseException(
                    "Failed to parse auto-fix response for %s %s"
                            .formatted(request.getMethod(), request.getPath()),
                    e);
        }
    }

    private String buildPrompt(AutoFixRequest request) {
        return """
            You are a security expert remediating a vulnerability found in an OpenAPI specification.

            Finding:
            - Method: %s
            - Path: %s
            - Vulnerability: %s
            - OWASP: %s
            - Risk level: %s

            Vulnerable OpenAPI specification snippet for this operation:
            %s

            Rewrite the snippet to remediate the vulnerability (e.g. add security requirements,
            ownership checks reflected via response codes, pagination limits, stricter schemas,
            or input validation as appropriate) while keeping the same path, method, and any
            unrelated fields intact. Keep the JSON pretty-printed with 2-space indentation.

            Return ONLY valid JSON, no markdown, no preamble, matching this exact shape:
            {
              "patchedSpecification": "the corrected OpenAPI snippet as a JSON string",
              "verificationSteps": ["short imperative step 1", "short imperative step 2", "short imperative step 3", "short imperative step 4"]
            }
            """.formatted(
                request.getMethod(),
                request.getPath(),
                request.getVulnerability(),
                request.getOwaspTag(),
                request.getRiskLevel(),
                request.getVulnerableSpecification()
        );
    }
}