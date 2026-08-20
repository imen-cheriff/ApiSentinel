package com.apisentinel.backend.ai;

import com.apisentinel.backend.ai.dto.AuditResultAiResponse;
import com.apisentinel.backend.ai.dto.AuditResultResponse;
import com.apisentinel.backend.ai.dto.AuditSummaryResponse;
import com.apisentinel.backend.ai.dto.ProjectAuditResponse;
import com.apisentinel.backend.ai.dto.ProjectBatchAuditResponse;
import com.apisentinel.backend.ai.dto.TestScenarioAiResponse;
import com.apisentinel.backend.ai.dto.TestScenarioResponse;
import com.apisentinel.backend.entity.AuditResult;
import com.apisentinel.backend.entity.Endpoint;
import com.apisentinel.backend.entity.Parameter;
import com.apisentinel.backend.entity.Project;
import com.apisentinel.backend.entity.RiskLevel;
import com.apisentinel.backend.entity.TestScenario;
import com.apisentinel.backend.repository.AuditResultRepository;
import com.apisentinel.backend.repository.ProjectRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class AiAuditService {

    private static final Logger log = LoggerFactory.getLogger(AiAuditService.class);

    private static final String OWASP_CATEGORIES = """
            API1:2023 Broken Object Level Authorization
            API2:2023 Broken Authentication
            API3:2023 Broken Object Property Level Authorization
            API4:2023 Unrestricted Resource Consumption
            API5:2023 Broken Function Level Authorization
            API6:2023 Unrestricted Access to Sensitive Business Flows
            API7:2023 Server Side Request Forgery
            API8:2023 Security Misconfiguration
            API9:2023 Improper Inventory Management
            API10:2023 Unsafe Consumption of APIs
            """;

    private static final String RISK_METHODOLOGY = """
            RISK CLASSIFICATION METHOD (mandatory, do not skip this step, for EACH finding):
            For EACH vulnerability, determine the riskLevel by explicitly reasoning along two axes,
            then combine them:

            1. Likelihood of exploitation — easily exploitable if: no visible authentication,
               identifier/ID directly in the path or parameters (e.g. {userId}, {orderId}),
               no authorization control mentioned, unvalidated user input.
               Hard to exploit if: explicit authentication, scope limited to the current
               user (e.g. /users/me/...), validation or business control mentioned in the description.

            2. Business impact — high if: sensitive data (financial, personal, health, credentials),
               destructive or irreversible action (DELETE, deletion, admin rights modification).
               Low if: public or non-sensitive data, read-only action with no side effects.

            Combine both axes (likelihood × impact) to choose CRITICAL, HIGH, MEDIUM, or LOW —
            never use a default or habitual level. The justification for this reasoning
            (why this likelihood, why this impact) must appear explicitly in the
            "description" field, not just the conclusion.

            For each vulnerability identified, also provide 1 to 2 concrete test scenarios
            a pentester could run to verify it, with precise, actionable steps.
            """;

    private final GeminiClient geminiClient;
    private final JsonMapper jsonMapper;
    private final AuditResultRepository auditResultRepository;
    private final ProjectRepository projectRepository;

    public AiAuditService(GeminiClient geminiClient, JsonMapper jsonMapper,
                          AuditResultRepository auditResultRepository, ProjectRepository projectRepository) {
        this.geminiClient = geminiClient;
        this.jsonMapper = jsonMapper;
        this.auditResultRepository = auditResultRepository;
        this.projectRepository = projectRepository;
    }

    @Transactional
    public Project generateAndSaveAuditForProject(Project project) {
        List<Endpoint> endpoints = project.getEndpoints();

        if (endpoints == null || endpoints.isEmpty()) {
            log.info("Project {} has no endpoints, default score applied", project.getId());
            project.calculateSecurityScore(List.of());
            return projectRepository.save(project);
        }

        Map<Long, Endpoint> endpointsById = new HashMap<>();
        for (Endpoint endpoint : endpoints) {
            endpointsById.put(endpoint.getId(), endpoint);
        }

        String prompt = buildProjectPrompt(endpoints);
        Map<String, Object> schema = buildProjectSchema();

        log.info("Starting AI audit for project {} ({} endpoints)", project.getId(), endpoints.size());

        String rawJson = geminiClient.generateStructuredJson(prompt, schema);
        ProjectBatchAuditResponse parsed = jsonMapper.readValue(rawJson, ProjectBatchAuditResponse.class);

        List<AuditResult> allResults = new ArrayList<>();

        for (ProjectBatchAuditResponse.EndpointAuditResult endpointAudit : parsed.endpointAudits()) {
            Endpoint endpoint = endpointsById.get(endpointAudit.endpointId());
            if (endpoint == null) {
                log.warn("Gemini returned an unknown endpointId ({}) for project {} — finding ignored",
                        endpointAudit.endpointId(), project.getId());
                continue;
            }

            clearExistingResults(endpoint);

            if (endpointAudit.findings() != null) {
                for (AuditResultAiResponse finding : endpointAudit.findings()) {
                    AuditResult auditResult = toEntity(finding, endpoint);
                    AuditResult saved = auditResultRepository.save(auditResult);
                    attachToEndpoint(endpoint, saved);
                    allResults.add(saved);
                }
            }
        }

        project.calculateSecurityScore(allResults);
        Project saved = projectRepository.save(project);

        log.info("Audit completed for project {}: {} findings across {} endpoints",
                project.getId(), allResults.size(), endpoints.size());

        return saved;
    }

    public ProjectAuditResponse generateAndSaveAuditForProjectAsResponse(Project project) {
        Project audited = generateAndSaveAuditForProject(project);
        return toProjectAuditResponse(audited);
    }

    private ProjectAuditResponse toProjectAuditResponse(Project project) {
        List<AuditResultResponse> flatResults = new ArrayList<>();
        int critical = 0, high = 0, medium = 0, low = 0;

        List<Endpoint> endpoints = project.getEndpoints() != null ? project.getEndpoints() : List.of();

        for (Endpoint endpoint : endpoints) {
            List<AuditResult> results = endpoint.getAuditResults();
            if (results == null) {
                continue;
            }

            for (AuditResult auditResult : results) {
                flatResults.add(toAuditResultResponse(endpoint, auditResult));

                RiskLevel level = auditResult.getRiskLevel();
                if (level == null) {
                    continue;
                }
                switch (level) {
                    case CRITICAL -> critical++;
                    case HIGH -> high++;
                    case MEDIUM -> medium++;
                    case LOW -> low++;
                }
            }
        }

        AuditSummaryResponse summary = new AuditSummaryResponse(endpoints.size(), critical, high, medium, low);

        return new ProjectAuditResponse(
                project.getProjectId(),
                project.getProjectName(),
                project.getScanDate(),
                project.getGlobalSecurityScore(),
                summary,
                flatResults
        );
    }

    private AuditResultResponse toAuditResultResponse(Endpoint endpoint, AuditResult auditResult) {
        List<TestScenarioResponse> scenarios = new ArrayList<>();
        if (auditResult.getTestScenarios() != null) {
            for (TestScenario scenario : auditResult.getTestScenarios()) {
                scenarios.add(new TestScenarioResponse(
                        scenario.getTitle(),
                        scenario.getSteps(),
                        scenario.getExpectedStatusOnSuccess(),
                        scenario.getPayloadExample()
                ));
            }
        }

        return new AuditResultResponse(
                endpoint.getEndpointId(),
                endpoint.getPath(),
                endpoint.getMethod(),
                auditResult.getRiskLevel() != null ? auditResult.getRiskLevel().name() : null,
                auditResult.getOwaspCategory(),
                auditResult.getVulnerability(),
                auditResult.getDescription(),
                auditResult.getRemediation(),
                scenarios
        );
    }

    private void clearExistingResults(Endpoint endpoint) {
        if (endpoint.getAuditResults() != null && !endpoint.getAuditResults().isEmpty()) {
            auditResultRepository.deleteAll(endpoint.getAuditResults());
            endpoint.getAuditResults().clear();
        } else if (endpoint.getAuditResults() == null) {
            endpoint.setAuditResults(new ArrayList<>());
        }
    }

    private void attachToEndpoint(Endpoint endpoint, AuditResult auditResult) {
        if (endpoint.getAuditResults() == null) {
            endpoint.setAuditResults(new ArrayList<>());
        }
        endpoint.getAuditResults().add(auditResult);
    }

    private AuditResult toEntity(AuditResultAiResponse dto, Endpoint endpoint) {
        AuditResult auditResult = new AuditResult();
        auditResult.setEndpoint(endpoint);
        auditResult.setOwaspCategory(dto.owaspCategory());
        auditResult.setVulnerability(dto.vulnerability());
        auditResult.setDescription(dto.description());
        auditResult.setRemediation(dto.remediation());
        auditResult.setRiskLevel(parseRiskLevel(dto.riskLevel()));

        List<TestScenario> scenarios = new ArrayList<>();
        if (dto.testScenarios() != null) {
            for (TestScenarioAiResponse scenarioDto : dto.testScenarios()) {
                TestScenario scenario = new TestScenario();
                scenario.setTitle(scenarioDto.title());
                scenario.setSteps(scenarioDto.steps());
                scenario.setExpectedStatusOnSuccess(scenarioDto.expectedStatusOnSuccess());
                scenario.setPayloadExample(scenarioDto.payloadExample());
                scenario.setAuditResult(auditResult); // back-reference required for cascade
                scenarios.add(scenario);
            }
        }
        auditResult.setTestScenarios(scenarios);

        return auditResult;
    }

    private RiskLevel parseRiskLevel(String raw) {
        if (raw == null) return RiskLevel.MEDIUM;
        try {
            return RiskLevel.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return RiskLevel.MEDIUM;
        }
    }

    private String buildProjectPrompt(List<Endpoint> endpoints) {
        StringBuilder endpointsBlock = new StringBuilder();
        for (Endpoint endpoint : endpoints) {
            endpointsBlock.append("### Endpoint ID: ").append(endpoint.getId()).append("\n")
                    .append("- Method: ").append(endpoint.getMethod()).append("\n")
                    .append("- Path: ").append(endpoint.getPath()).append("\n")
                    .append("- Summary: ").append(nullToEmpty(endpoint.getSummary())).append("\n")
                    .append("- Description: ").append(nullToEmpty(endpoint.getDescription())).append("\n")
                    .append("- Parameters:\n").append(buildParamsBlock(endpoint)).append("\n\n");
        }

        return """
                You are a senior API security auditor, specialized in the OWASP API Security Top 10 (2023).

                Here is the list of endpoints for a project. Analyze EACH endpoint INDEPENDENTLY and identify,
                for each one, between 1 and 3 realistic and distinct vulnerabilities, ranked by decreasing risk.
                Base your analysis solely on the information provided for this specific endpoint — do not assume
                anything that isn't stated, and never mix findings between two different endpoints.

                Endpoints to analyze:
                %s

                Available OWASP API Security Top 10 categories (use the EXACT code, e.g. "API1:2023"):
                %s

                %s

                Respond only with the requested JSON: an object containing "endpointAudits", one element per
                endpoint analyzed, each with its EXACT "endpointId" as indicated above (do not invent it
                or modify it). No additional text outside the JSON.
                """.formatted(endpointsBlock, OWASP_CATEGORIES, RISK_METHODOLOGY);
    }

    private String buildParamsBlock(Endpoint endpoint) {
        List<Parameter> parameters = endpoint.getParameters();
        if (parameters == null || parameters.isEmpty()) {
            return "No parameters declared.";
        }
        StringBuilder params = new StringBuilder();
        for (Parameter p : parameters) {
            params.append("- ").append(p.getName())
                    .append(" (in: ").append(p.getInType())
                    .append(", type: ").append(p.getDataType())
                    .append(", required: ").append(p.getRequired())
                    .append(")\n");
        }
        return params.toString();
    }

    private String nullToEmpty(String value) {
        return value == null ? "(not provided)" : value;
    }

    private Map<String, Object> testScenarioSchema() {
        return Map.of(
                "type", "object",
                "properties", Map.of(
                        "title", Map.of("type", "string"),
                        "steps", Map.of("type", "array", "items", Map.of("type", "string")),
                        "expectedStatusOnSuccess", Map.of("type", "integer"),
                        "payloadExample", Map.of("type", "string")
                ),
                "required", List.of("title", "steps", "payloadExample")
        );
    }

    private Map<String, Object> findingSchema() {
        return Map.of(
                "type", "object",
                "properties", Map.of(
                        "owaspCategory", Map.of("type", "string"),
                        "vulnerability", Map.of("type", "string"),
                        "description", Map.of("type", "string"),
                        "remediation", Map.of("type", "string"),
                        "riskLevel", Map.of("type", "string", "enum", List.of("CRITICAL", "HIGH", "MEDIUM", "LOW")),
                        "testScenarios", Map.of("type", "array", "items", testScenarioSchema())
                ),
                "required", List.of("owaspCategory", "vulnerability", "description", "remediation", "riskLevel")
        );
    }

    private Map<String, Object> buildProjectSchema() {
        Map<String, Object> endpointAuditSchema = Map.of(
                "type", "object",
                "properties", Map.of(
                        "endpointId", Map.of("type", "integer"),
                        "findings", Map.of("type", "array", "items", findingSchema())
                ),
                "required", List.of("endpointId", "findings")
        );

        return Map.of(
                "type", "object",
                "properties", Map.of(
                        "endpointAudits", Map.of("type", "array", "items", endpointAuditSchema)
                ),
                "required", List.of("endpointAudits")
        );
    }
}