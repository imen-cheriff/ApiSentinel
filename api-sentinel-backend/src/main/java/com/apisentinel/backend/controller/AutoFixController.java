package com.apisentinel.backend.controller;

import com.apisentinel.backend.ai.AutoFixService;
import com.apisentinel.backend.ai.dto.AutoFixRequest;
import com.apisentinel.backend.ai.dto.AutoFixResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/projects/{projectId}/autofix")
@RequiredArgsConstructor
public class AutoFixController {

    private final AutoFixService autoFixService;

    @PostMapping
    public AutoFixResponse generatePatch(
            @PathVariable Long projectId,
            @RequestBody AutoFixRequest request
    ) {
        return autoFixService.generatePatch(projectId, request);
    }
}