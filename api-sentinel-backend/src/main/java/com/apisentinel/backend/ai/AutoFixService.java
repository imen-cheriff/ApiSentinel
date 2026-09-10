package com.apisentinel.backend.ai;

import com.apisentinel.backend.ai.dto.AutoFixRequest;
import com.apisentinel.backend.ai.dto.AutoFixResponse;
import com.apisentinel.backend.entity.AuditResult;
import com.apisentinel.backend.entity.Endpoint;
import com.apisentinel.backend.entity.Parameter;
import com.apisentinel.backend.exception.AiResponseParseException;
import com.apisentinel.backend.exception.ResourceNotFoundException;
import com.apisentinel.backend.repository.AuditResultRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AutoFixService {

    private final GeminiClient geminiClient;
    private final AuditResultRepository auditResultRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AutoFixResponse generatePatch(Long projectId, AutoFixRequest request) {
        AuditResult finding = loadFinding(projectId, request.getAuditResultId());

        String prompt = buildPrompt(finding);
        String rawJson = geminiClient.generateText(prompt);
        String cleaned = clean(rawJson);

        if (!looksLikeJson(cleaned)) {
            rawJson = geminiClient.generateText(prompt);
            cleaned = clean(rawJson);
        }

        if (!looksLikeJson(cleaned)) {
            throw new AiResponseParseException(
                    "The AI refused or failed to generate a patch for %s %s. Response received: %s"
                            .formatted(
                                    finding.getEndpoint().getMethod(),
                                    finding.getEndpoint().getPath(),
                                    truncate(cleaned)),
                    null);
        }

        try {
            return objectMapper.readValue(cleaned, AutoFixResponse.class);
        } catch (Exception e) {
            throw new AiResponseParseException(
                    "Failed to parse auto-fix response for %s %s"
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

    private String buildSpecSnippet(Endpoint endpoint) {
        String params = endpoint.getParameters() == null || endpoint.getParameters().isEmpty()
                ? "    (no parameters recorded)"
                : endpoint.getParameters().stream()
                .map(this::describeParameter)
                .collect(Collectors.joining("\n"));

        return """
            {
              "path": "%s",
              "method": "%s",
              "summary": "%s",
              "description": "%s",
              "parameters": [
            %s
              ]
            }
            """.formatted(
                nullSafe(endpoint.getPath()),
                nullSafe(endpoint.getMethod()),
                nullSafe(endpoint.getSummary()),
                nullSafe(endpoint.getDescription()),
                params
        );
    }

    private String describeParameter(Parameter p) {
        return "    { \"name\": \"%s\", \"in\": \"%s\", \"required\": %s, \"type\": \"%s\" }".formatted(
                nullSafe(p.getName()),
                nullSafe(p.getInType()),
                p.getRequired() != null && p.getRequired(),
                nullSafe(p.getDataType())
        );
    }

    private String nullSafe(String s) {
        return s == null ? "" : s;
    }

    private String buildPrompt(AuditResult finding) {
        Endpoint endpoint = finding.getEndpoint();
        String specSnippet = buildSpecSnippet(endpoint);

        return """
            You are a security expert remediating a vulnerability found in an API, as part of
            an authorized internal audit of the team's own service.

            Finding:
            - Method: %s
            - Path: %s
            - Vulnerability: %s
            - OWASP: %s
            - Risk level: %s

            Reconstructed OpenAPI-style snippet for this operation (built from the audited
            endpoint's recorded metadata, since no raw specification is stored for this finding):
            %s

            Write a corrected OpenAPI operation snippet that remediates the vulnerability
            (e.g. add security requirements, ownership checks reflected via response codes,
            pagination limits, stricter schemas, or input validation as appropriate) while
            keeping the same path, method, and parameter names intact. Keep the JSON
            pretty-printed with 2-space indentation.

            Return ONLY valid JSON, no markdown, no preamble, matching this exact shape:
            {
              "patchedSpecification": "the corrected OpenAPI snippet as a JSON string",
              "verificationSteps": ["short imperative step 1", "short imperative step 2", "short imperative step 3", "short imperative step 4"]
            }
            """.formatted(
                endpoint.getMethod(),
                endpoint.getPath(),
                finding.getVulnerability(),
                finding.getOwaspCategory(),
                finding.getRiskLevel(),
                specSnippet
        );
    }
}