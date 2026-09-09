package com.apisentinel.backend.ai.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AttackSimulationResponse {
    private String scenario;
    private String attackerRequest;
    private String simulatedResponse;
    private List<String> blastRadius;
}