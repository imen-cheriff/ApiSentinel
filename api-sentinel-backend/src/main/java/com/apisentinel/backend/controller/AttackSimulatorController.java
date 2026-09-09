package com.apisentinel.backend.controller;

import com.apisentinel.backend.ai.AttackSimulatorService;
import com.apisentinel.backend.ai.dto.AttackSimulationRequest;
import com.apisentinel.backend.ai.dto.AttackSimulationResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/projects/{projectId}/simulate")
@RequiredArgsConstructor
public class AttackSimulatorController {

    private final AttackSimulatorService attackSimulatorService;

    @PostMapping
    public AttackSimulationResponse simulate(
            @PathVariable Long projectId,
            @RequestBody AttackSimulationRequest request
    ) {
        return attackSimulatorService.simulate(request);
    }
}