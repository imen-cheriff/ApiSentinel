package com.apisentinel.backend.ai.dto;

import java.util.List;

public record ProjectBatchAuditResponse(
        List<EndpointAuditResult> endpointAudits
) {
    public record EndpointAuditResult(
            Long endpointId,
            List<AuditResultAiResponse> findings
    ) {}
}