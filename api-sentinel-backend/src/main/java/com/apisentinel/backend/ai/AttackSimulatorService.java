package com.apisentinel.backend.ai;

import com.apisentinel.backend.ai.dto.AttackSimulationRequest;
import com.apisentinel.backend.ai.dto.AttackSimulationResponse;
import com.apisentinel.backend.entity.AuditResult;
import com.apisentinel.backend.exception.AiResponseParseException;
import com.apisentinel.backend.exception.ResourceNotFoundException;
import com.apisentinel.backend.repository.AuditResultRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AttackSimulatorService {

    private final GeminiClient geminiClient;
    private final AuditResultRepository auditResultRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AttackSimulationResponse simulate(Long projectId, AttackSimulationRequest request) {
        AuditResult finding = loadFinding(projectId, request.getAuditResultId());

        String prompt = buildPrompt(finding);
        String rawJson = geminiClient.generateText(prompt);
        String cleaned = clean(rawJson);

        if (!looksLikeJson(cleaned)) {
            // Une tentative de retry : les refus de l'IA ne sont pas systématiques
            rawJson = geminiClient.generateText(prompt);
            cleaned = clean(rawJson);
        }

        if (!looksLikeJson(cleaned)) {
            throw new AiResponseParseException(
                    "The AI refused or failed to generate a simulation for %s %s. Response received: %s"
                            .formatted(
                                    finding.getEndpoint().getMethod(),
                                    finding.getEndpoint().getPath(),
                                    truncate(cleaned)),
                    null);
        }

        try {
            return objectMapper.readValue(cleaned, AttackSimulationResponse.class);
        } catch (Exception e) {
            throw new AiResponseParseException(
                    "Failed to parse attack simulation response for %s %s"
                            .formatted(finding.getEndpoint().getMethod(), finding.getEndpoint().getPath()),
                    e);
        }
    }

    private AuditResult loadFinding(Long projectId, Long auditResultId) {
        if (auditResultId == null) {
            throw new ResourceNotFoundException("auditResultId is required");
        }
        return auditResultRepository.findById(auditResultId)
                .filter(r -> r.getEndpoint().getProject().getId().equals(projectId))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Finding %d not found for project %d".formatted(auditResultId, projectId)));
    }

    private String clean(String rawJson) {
        return rawJson.replaceAll("```json", "").replaceAll("```", "").trim();
    }

    private boolean looksLikeJson(String s) {
        return s.startsWith("{") || s.startsWith("[");
    }

    private String truncate(String s) {
        return s.length() > 200 ? s.substring(0, 200) + "..." : s;
    }

    private String buildPrompt(AuditResult finding) {
        return """
            You are a security analyst writing an educational, defensive report for a development
            team about a vulnerability found in THEIR OWN API during an authorized internal audit.
            The goal is to help them understand and fix the issue — this is NOT for use against
            any real system, and no real secrets, credentials, or infrastructure are involved.

            This endpoint may belong to any type of application (e-commerce, fitness, education,
            banking, social, IoT, internal tooling, etc.) — infer the domain context from the path
            and finding details below, and tailor the scenario accordingly.

            Finding (from an authorized audit of the team's own API):
            - Method: %s
            - Path: %s
            - Vulnerability: %s
            - OWASP: %s
            - Risk level: %s

            Write a proof-of-concept style illustration for the team's internal report.

            Return ONLY valid JSON, no markdown, no preamble, matching this exact shape:
            {
              "scenario": "2-4 sentence narrative of how this vulnerability could be exploited, grounded in what this specific endpoint likely does",
              "attackerRequest": "an illustrative curl command demonstrating the exploit pattern (use placeholder/example values, not real secrets)",
              "simulatedResponse": "an illustrative example of the kind of data that could be exposed, with realistic field names for this endpoint's domain but fictional/placeholder values",
              "blastRadius": ["short bullet point 1", "short bullet point 2", "short bullet point 3"]
            }
            """.formatted(
                finding.getEndpoint().getMethod(),
                finding.getEndpoint().getPath(),
                finding.getVulnerability(),
                finding.getOwaspCategory(),
                finding.getRiskLevel()
        );
    }
}