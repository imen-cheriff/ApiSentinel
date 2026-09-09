package com.apisentinel.backend.ai;

import com.apisentinel.backend.ai.dto.AttackSimulationRequest;
import com.apisentinel.backend.ai.dto.AttackSimulationResponse;
import com.apisentinel.backend.exception.AiResponseParseException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AttackSimulatorService {

    private final GeminiClient geminiClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AttackSimulationResponse simulate(AttackSimulationRequest request) {
        String prompt = buildPrompt(request);
        String rawJson = geminiClient.generateText(prompt);

        try {
            String cleaned = rawJson.replaceAll("```json", "").replaceAll("```", "").trim();
            return objectMapper.readValue(cleaned, AttackSimulationResponse.class);
        } catch (Exception e) {
            throw new AiResponseParseException(
                    "Failed to parse attack simulation response for %s %s"
                            .formatted(request.getMethod(), request.getPath()),
                    e);
        }
    }

    private String buildPrompt(AttackSimulationRequest request) {
        return """
            You are a security expert simulating a real attack against a fitness API.

            Finding:
            - Method: %s
            - Path: %s
            - Vulnerability: %s
            - OWASP: %s
            - Risk level: %s

            Return ONLY valid JSON, no markdown, no preamble, matching this exact shape:
            {
              "scenario": "2-4 sentence narrative of how an attacker would exploit this finding",
              "attackerRequest": "a realistic curl command exploiting the endpoint",
              "simulatedResponse": "a realistic JSON response body that would be leaked/returned",
              "blastRadius": ["short bullet point 1", "short bullet point 2", "short bullet point 3"]
            }
            """.formatted(
                request.getMethod(),
                request.getPath(),
                request.getVulnerability(),
                request.getOwaspTag(),
                request.getRiskLevel()
        );
    }
}