package com.apisentinel.backend.ai.dto;

import lombok.Data;

@Data
public class AutoFixRequest {
    private String method;
    private String path;
    private String vulnerability;
    private String owaspTag;
    private String riskLevel;
    private String vulnerableSpecification;
}