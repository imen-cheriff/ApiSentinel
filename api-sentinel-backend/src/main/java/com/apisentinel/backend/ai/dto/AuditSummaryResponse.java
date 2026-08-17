package com.apisentinel.backend.ai.dto;

public record AuditSummaryResponse(
        int totalEndpoints,
        int criticalRisks,
        int highRisks,
        int mediumRisks,
        int lowRisks
) {
}