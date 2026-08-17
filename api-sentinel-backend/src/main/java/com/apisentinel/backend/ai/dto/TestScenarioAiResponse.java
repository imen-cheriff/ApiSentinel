package com.apisentinel.backend.ai.dto;

import java.util.List;

/**
 * Représente un scénario de test tel que retourné par Gemini,
 * avant conversion en entité TestScenario.
 */
public record TestScenarioAiResponse(
        String title,
        List<String> steps,
        Integer expectedStatusOnSuccess,
        String payloadExample
) {
}