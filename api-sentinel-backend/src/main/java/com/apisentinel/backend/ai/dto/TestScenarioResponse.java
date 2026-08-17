package com.apisentinel.backend.ai.dto;

import java.util.List;

public record TestScenarioResponse(
        String title,
        List<String> steps,
        Integer expectedStatusOnSuccess,
        String payloadExample
) {
}