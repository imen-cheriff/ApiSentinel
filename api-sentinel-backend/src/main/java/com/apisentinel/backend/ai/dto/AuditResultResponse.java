package com.apisentinel.backend.ai.dto;

import java.util.List;

public record AuditResultResponse(
        String endpointId,
        String path,
        String method,
        String riskLevel,
        String owaspCategory,
        String vulnerability,
        String description,
        String remediation,
        List<TestScenarioResponse> testScenarios
) {
}