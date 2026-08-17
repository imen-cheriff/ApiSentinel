package com.apisentinel.backend.ai;

import com.apisentinel.backend.ai.dto.AuditBatchResponse;
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
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class AiAuditService {

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
            MÉTHODE DE CLASSIFICATION DU RISQUE (obligatoire, ne saute pas cette étape, pour CHAQUE finding) :
            Pour CHAQUE vulnérabilité, détermine le riskLevel en raisonnant explicitement sur deux axes,
            puis combine-les :

            1. Probabilité d'exploitation — facilement exploitable si : pas d'authentification visible,
               identifiant/ID directement dans le chemin ou les paramètres (ex. {userId}, {orderId}),
               pas de contrôle d'autorisation mentionné, entrée utilisateur non validée.
               Difficilement exploitable si : authentification explicite, portée limitée à l'utilisateur
               courant (ex. /users/me/...), validation ou contrôle métier mentionné dans la description.

            2. Impact métier — élevé si : données sensibles (financières, personnelles, santé, identifiants),
               action destructive ou irréversible (DELETE, suppression, modification de droits admin).
               Faible si : donnée publique ou non sensible, action en lecture seule sans effet de bord.

            Combine les deux axes (probabilité × impact) pour choisir CRITICAL, HIGH, MEDIUM ou LOW —
            n'utilise jamais un niveau par défaut ou par habitude. La justification de ce raisonnement
            (pourquoi cette probabilité, pourquoi cet impact) doit apparaître explicitement dans le champ
            "description", pas seulement la conclusion.

            Pour chaque vulnérabilité identifiée, fournis aussi 1 à 2 scénarios de test concrets
            qu'un pentester pourrait exécuter pour la vérifier, avec des étapes précises et actionnables.
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

    public Project generateAndSaveAuditForProject(Project project) {
        List<Endpoint> endpoints = project.getEndpoints();

        if (endpoints == null || endpoints.isEmpty()) {
            project.calculateSecurityScore(List.of());
            return projectRepository.save(project);
        }

        Map<Long, Endpoint> endpointsById = new HashMap<>();
        for (Endpoint endpoint : endpoints) {
            endpointsById.put(endpoint.getId(), endpoint);
        }

        String prompt = buildProjectPrompt(endpoints);
        Map<String, Object> schema = buildProjectSchema();

        String rawJson = geminiClient.generateStructuredJson(prompt, schema);
        ProjectBatchAuditResponse parsed = jsonMapper.readValue(rawJson, ProjectBatchAuditResponse.class);

        List<AuditResult> allResults = new ArrayList<>();

        for (ProjectBatchAuditResponse.EndpointAuditResult endpointAudit : parsed.endpointAudits()) {
            Endpoint endpoint = endpointsById.get(endpointAudit.endpointId());
            if (endpoint == null) {
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
        return projectRepository.save(project);
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

    public List<AuditResult> generateAndSaveAuditForEndpoint(Endpoint endpoint) {
        clearExistingResults(endpoint);

        String prompt = buildPrompt(endpoint);
        Map<String, Object> schema = buildSchema();

        String rawJson = geminiClient.generateStructuredJson(prompt, schema);
        AuditBatchResponse parsed = jsonMapper.readValue(rawJson, AuditBatchResponse.class);

        List<AuditResult> auditResults = new ArrayList<>();
        for (AuditResultAiResponse finding : parsed.findings()) {
            AuditResult auditResult = toEntity(finding, endpoint);
            AuditResult saved = auditResultRepository.save(auditResult);
            attachToEndpoint(endpoint, saved);
            auditResults.add(saved);
        }
        return auditResults;
    }

    private void clearExistingResults(Endpoint endpoint) {
        if (endpoint.getAuditResults() != null && !endpoint.getAuditResults().isEmpty()) {
            auditResultRepository.deleteAll(endpoint.getAuditResults());
            endpoint.getAuditResults().clear();
        } else if (endpoint.getAuditResults() == null) {
            // La collection JPA peut être null tant qu'aucun résultat n'a jamais été
            // attaché (dépend du provider/lazy-loading) : on l'initialise ici pour
            // pouvoir y ajouter les nouveaux résultats juste après sans NPE.
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
                scenario.setAuditResult(auditResult); // back-reference obligatoire pour le cascade
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

    private String buildPrompt(Endpoint endpoint) {
        return """
                Tu es un auditeur de sécurité API senior, spécialisé dans l'OWASP API Security Top 10 (2023).

                Analyse l'endpoint suivant et identifie entre 1 et 3 vulnérabilités réalistes et distinctes,
                classées par risque décroissant. Base-toi uniquement sur les informations fournies
                (méthode, chemin, résumé, description, paramètres) — ne suppose rien qui ne soit pas indiqué.

                Endpoint :
                - Méthode : %s
                - Chemin : %s
                - Résumé : %s
                - Description : %s
                - Paramètres :
                %s

                Catégories OWASP API Security Top 10 disponibles (utilise EXACTEMENT le code, ex. "API1:2023") :
                %s

                %s

                Réponds uniquement avec le JSON demandé, sans texte additionnel.
                """.formatted(
                endpoint.getMethod(),
                endpoint.getPath(),
                nullToEmpty(endpoint.getSummary()),
                nullToEmpty(endpoint.getDescription()),
                buildParamsBlock(endpoint),
                OWASP_CATEGORIES,
                RISK_METHODOLOGY
        );
    }

    private String buildProjectPrompt(List<Endpoint> endpoints) {
        StringBuilder endpointsBlock = new StringBuilder();
        for (Endpoint endpoint : endpoints) {
            endpointsBlock.append("### Endpoint ID: ").append(endpoint.getId()).append("\n")
                    .append("- Méthode : ").append(endpoint.getMethod()).append("\n")
                    .append("- Chemin : ").append(endpoint.getPath()).append("\n")
                    .append("- Résumé : ").append(nullToEmpty(endpoint.getSummary())).append("\n")
                    .append("- Description : ").append(nullToEmpty(endpoint.getDescription())).append("\n")
                    .append("- Paramètres :\n").append(buildParamsBlock(endpoint)).append("\n\n");
        }

        return """
                Tu es un auditeur de sécurité API senior, spécialisé dans l'OWASP API Security Top 10 (2023).

                Voici la liste des endpoints d'un projet. Analyse CHAQUE endpoint INDÉPENDAMMENT et identifie,
                pour chacun, entre 1 et 3 vulnérabilités réalistes et distinctes, classées par risque décroissant.
                Base-toi uniquement sur les informations fournies pour cet endpoint précis — ne suppose rien
                qui ne soit pas indiqué, et ne mélange jamais les findings entre deux endpoints différents.

                Endpoints à analyser :
                %s

                Catégories OWASP API Security Top 10 disponibles (utilise EXACTEMENT le code, ex. "API1:2023") :
                %s

                %s

                Réponds uniquement avec le JSON demandé : un objet contenant "endpointAudits", un élément par
                endpoint analysé, chacun avec son "endpointId" EXACT tel qu'indiqué ci-dessus (ne l'invente pas
                et ne le modifie pas). Aucun texte additionnel en dehors du JSON.
                """.formatted(endpointsBlock, OWASP_CATEGORIES, RISK_METHODOLOGY);
    }

    private String buildParamsBlock(Endpoint endpoint) {
        List<Parameter> parameters = endpoint.getParameters();
        if (parameters == null || parameters.isEmpty()) {
            return "Aucun paramètre déclaré.";
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
        return value == null ? "(non renseigné)" : value;
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
                "required", List.of("title", "steps")
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

    private Map<String, Object> buildSchema() {
        return Map.of(
                "type", "object",
                "properties", Map.of(
                        "findings", Map.of("type", "array", "items", findingSchema())
                ),
                "required", List.of("findings")
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