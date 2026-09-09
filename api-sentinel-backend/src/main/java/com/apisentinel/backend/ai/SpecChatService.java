package com.apisentinel.backend.ai;

import com.apisentinel.backend.ai.dto.ChatRequest;
import com.apisentinel.backend.ai.dto.ChatResponse;
import com.apisentinel.backend.entity.AuditResult;
import com.apisentinel.backend.entity.Project;
import com.apisentinel.backend.exception.ResourceNotFoundException;
import com.apisentinel.backend.repository.AuditResultRepository;
import com.apisentinel.backend.repository.ProjectRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class SpecChatService {

    private final ProjectRepository projectRepository;
    private final AuditResultRepository auditResultRepository;
    private final GeminiClient geminiClient;

    public SpecChatService(ProjectRepository projectRepository,
                           AuditResultRepository auditResultRepository,
                           GeminiClient geminiClient) {
        this.projectRepository = projectRepository;
        this.auditResultRepository = auditResultRepository;
        this.geminiClient = geminiClient;
    }

    public ChatResponse ask(Long projectId, ChatRequest request) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found: " + projectId));

        List<AuditResult> results = auditResultRepository.findByEndpoint_Project_Id(projectId);

        String findingsBlock = results.stream()
                .map(r -> """
                - [%s] %s %s — %s (%s)
                  Issue: %s
                  Fix: %s
                """.formatted(
                        r.getRiskLevel(),
                        r.getEndpoint().getMethod(),
                        r.getEndpoint().getPath(),
                        r.getVulnerability(),
                        r.getOwaspCategory(),
                        r.getDescription(),
                        r.getRemediation()))
                .collect(Collectors.joining("\n"));

        String historyBlock = request.history() == null ? "" : request.history().stream()
                .map(m -> m.role() + ": " + m.content())
                .collect(Collectors.joining("\n"));

        String prompt = """
                You are a security assistant answering questions about a single API audit scan.
                Answer ONLY using the findings listed below. If the user asks about a route,
                risk, or detail that is not in this list, say plainly that the scan report
                doesn't cover it — never invent routes, scores, or findings that aren't listed.
                Keep answers short and direct.

                PROJECT: %s

                FINDINGS:
                %s

                CONVERSATION SO FAR:
                %s

                USER QUESTION:
                %s
                """.formatted(project.getProjectName(), findingsBlock, historyBlock, request.message());

        String reply = geminiClient.generateText(prompt);

        return new ChatResponse(reply);
    }
}