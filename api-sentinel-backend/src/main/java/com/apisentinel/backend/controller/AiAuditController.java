package com.apisentinel.backend.controller;

import com.apisentinel.backend.ai.AiAuditService;
import com.apisentinel.backend.ai.dto.ProjectAuditResponse;
import com.apisentinel.backend.entity.AuditResult;
import com.apisentinel.backend.entity.Endpoint;
import com.apisentinel.backend.entity.Project;
import com.apisentinel.backend.repository.EndpointRepository;
import com.apisentinel.backend.repository.ProjectRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Endpoint temporaire pour valider la génération IA sur un seul endpoint
 * avant de brancher la boucle complète sur un projet entier.
 */
@RestController
public class AiAuditController {

    private final AiAuditService aiAuditService;
    private final EndpointRepository endpointRepository;
    private final ProjectRepository projectRepository;

    public AiAuditController(AiAuditService aiAuditService, EndpointRepository endpointRepository, ProjectRepository projectRepository) {
        this.aiAuditService = aiAuditService;
        this.endpointRepository = endpointRepository;
        this.projectRepository = projectRepository;
    }

    @PostMapping("/api/endpoints/{id}/audit")
    public ResponseEntity<List<AuditResult>> auditEndpoint(@PathVariable Long id) {
        Endpoint endpoint = endpointRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Endpoint introuvable : " + id));

        List<AuditResult> results = aiAuditService.generateAndSaveAuditForEndpoint(endpoint);
        return ResponseEntity.ok(results);
    }

    @PostMapping("/projects/{id}/audit")
    public ResponseEntity<ProjectAuditResponse> auditProject(@PathVariable Long id) {
        Project project = projectRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Projet introuvable : " + id));

        ProjectAuditResponse response = aiAuditService.generateAndSaveAuditForProjectAsResponse(project);
        return ResponseEntity.ok(response);
    }

}