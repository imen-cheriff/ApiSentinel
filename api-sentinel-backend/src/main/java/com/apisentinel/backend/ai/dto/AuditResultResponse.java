package com.apisentinel.backend.ai.dto;

import java.util.List;

/**
 * Représente un finding OWASP tel que retourné par Gemini,
 * avant conversion en entité AuditResult.
 * riskLevel arrive en String (nom de l'enum) car Gemini ne connaît pas
 * directement le type Java RiskLevel — la conversion se fait dans le service.
 */
public record AuditResultAiResponse(
        String owaspCategory,
        String vulnerability,
        String description,
        String remediation,
        String riskLevel,
        List<TestScenarioAiResponse> testScenarios
) {
}