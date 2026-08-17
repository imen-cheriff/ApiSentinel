package com.apisentinel.backend.controller;

import com.apisentinel.backend.ai.AiAuditService;
import com.apisentinel.backend.ai.dto.ProjectAuditResponse;
import com.apisentinel.backend.entity.Project;
import com.apisentinel.backend.repository.ProjectRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ProjectAuditController {

    private final AiAuditService aiAuditService;
    private final ProjectRepository projectRepository;

    public ProjectAuditController(AiAuditService aiAuditService, ProjectRepository projectRepository) {
        this.aiAuditService = aiAuditService;
        this.projectRepository = projectRepository;
    }

    @PostMapping("/api/projects/{id}/audit")
    public ResponseEntity<ProjectAuditResponse> auditProject(@PathVariable Long id) {
        Project project = projectRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Projet introuvable : " + id));

        ProjectAuditResponse response = aiAuditService.generateAndSaveAuditForProjectAsResponse(project);
        return ResponseEntity.ok(response);
    }
}