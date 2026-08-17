package com.apisentinel.backend.ai.dto;

import java.util.List;

public record AuditBatchResponse(
        List<AuditResultAiResponse> findings
) {
}