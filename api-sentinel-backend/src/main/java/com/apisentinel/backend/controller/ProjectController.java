package com.apisentinel.backend.controller;

import com.apisentinel.backend.entity.Endpoint;
import com.apisentinel.backend.entity.Project;
import com.apisentinel.backend.exception.ResourceNotFoundException;
import com.apisentinel.backend.repository.ProjectRepository;
import com.apisentinel.backend.service.OpenApiParserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    @Autowired
    private OpenApiParserService parserService;

    @Autowired
    private ProjectRepository projectRepository;

    @PostMapping("/import")
    public Project importOpenApi(@RequestParam("file") MultipartFile file) throws Exception {
        List<Endpoint> endpoints = parserService.parse(file.getBytes());

        Project project = new Project();
        project.setProjectName(file.getOriginalFilename());
        project.setScanDate(LocalDateTime.now());
        project.setProjectId(UUID.randomUUID().toString());

        endpoints.forEach(endpoint -> endpoint.setProject(project));
        project.setEndpoints(endpoints);

        return projectRepository.save(project);
    }

    @GetMapping("/{id}")
    public Project getProject(@PathVariable Long id) {
        return projectRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found: " + id));
    }

    @GetMapping
    public List<Project> getAllProjects() {
        return projectRepository.findAll();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteProject(@PathVariable Long id) {
        if (!projectRepository.existsById(id)) {
            throw new ResourceNotFoundException("Project not found: " + id);
        }
        projectRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}