package com.apisentinel.backend.controller;

import com.apisentinel.backend.entity.Project;
import com.apisentinel.backend.entity.Route;
import com.apisentinel.backend.repository.ProjectRepository;
import com.apisentinel.backend.service.OpenApiParserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    @Autowired
    private OpenApiParserService parserService;

    @Autowired
    private ProjectRepository projectRepository;

    @PostMapping("/import")
    public Project importOpenApi(@RequestParam("file") MultipartFile file) throws Exception {
        List<Route> routes = parserService.parse(file.getBytes());

        Project project = new Project();
        project.setName(file.getOriginalFilename());
        project.setScanDate(LocalDateTime.now());
        project.setTotalEndpoints(routes.size());

        routes.forEach(route -> route.setProject(project));
        project.setRoutes(routes);

        return projectRepository.save(project);
    }
}
