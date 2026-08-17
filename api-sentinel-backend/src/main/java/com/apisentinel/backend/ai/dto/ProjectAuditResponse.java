package com.apisentinel.backend.ai.dto;

import java.time.LocalDateTime;
import java.util.List;

public record ProjectAuditResponse(
        String projectId,
        String projectName,
        LocalDateTime scanDate,
        Integer globalSecurityScore,
        AuditSummaryResponse summary,
        List<AuditResultResponse> auditResults
) {
}