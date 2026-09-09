package com.apisentinel.backend.controller;

import com.apisentinel.backend.ai.SpecChatService;
import com.apisentinel.backend.ai.dto.ChatRequest;
import com.apisentinel.backend.ai.dto.ChatResponse;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/projects/{projectId}/chat")
public class ProjectChatController {

    private final SpecChatService specChatService;

    public ProjectChatController(SpecChatService specChatService) {
        this.specChatService = specChatService;
    }

    @PostMapping
    public ChatResponse chat(@PathVariable Long projectId, @RequestBody ChatRequest request) {
        return specChatService.ask(projectId, request);
    }
}