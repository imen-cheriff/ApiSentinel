package com.apisentinel.backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Entity
@Data
public class Project {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String projectId;
    private String projectName;
    private LocalDateTime scanDate;
    private Integer globalSecurityScore;

    @OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Endpoint> endpoints;

    private static final Map<RiskLevel, Integer> ROUTE_SCORE_BY_WORST_RISK = Map.of(
            RiskLevel.CRITICAL, 10,
            RiskLevel.HIGH,     35,
            RiskLevel.MEDIUM,   65,
            RiskLevel.LOW,      85
    );

    private static final int NO_FINDING_ROUTE_SCORE = 100;
    private static final int UNKNOWN_RISK_ROUTE_SCORE = 50; // repli si riskLevel est null/invalide

    public void calculateSecurityScore(List<AuditResult> allResults) {
        List<Endpoint> routes = resolveRoutes(allResults);

        if (routes.isEmpty()) {
            this.globalSecurityScore = 100;
            return;
        }

        double sumOfRouteScores = 0;
        for (Endpoint endpoint : routes) {
            sumOfRouteScores += worstFindingScoreForRoute(endpoint);
        }

        int score = (int) Math.round(sumOfRouteScores / routes.size());
        this.globalSecurityScore = Math.max(0, Math.min(100, score));
    }

    private List<Endpoint> resolveRoutes(List<AuditResult> allResults) {
        if (this.endpoints != null && !this.endpoints.isEmpty()) {
            return this.endpoints;
        }

        if (allResults != null && !allResults.isEmpty()) {
            return allResults.stream()
                    .map(AuditResult::getEndpoint)
                    .filter(java.util.Objects::nonNull)
                    .distinct()
                    .toList();
        }
        return List.of();
    }

    private int worstFindingScoreForRoute(Endpoint endpoint) {
        List<AuditResult> results = endpoint.getAuditResults();
        if (results == null || results.isEmpty()) {
            return NO_FINDING_ROUTE_SCORE;
        }

        RiskLevel worst = null;
        int worstRank = -1;
        for (AuditResult result : results) {
            int rank = severityRank(result.getRiskLevel());
            if (rank > worstRank) {
                worstRank = rank;
                worst = result.getRiskLevel();
            }
        }

        return ROUTE_SCORE_BY_WORST_RISK.getOrDefault(worst, UNKNOWN_RISK_ROUTE_SCORE);
    }

    private int severityRank(RiskLevel level) {
        if (level == null) return 0;
        return switch (level) {
            case CRITICAL -> 4;
            case HIGH -> 3;
            case MEDIUM -> 2;
            case LOW -> 1;
        };
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getProjectId() {
        return projectId;
    }

    public void setProjectId(String projectId) {
        this.projectId = projectId;
    }

    public String getProjectName() {
        return projectName;
    }

    public void setProjectName(String projectName) {
        this.projectName = projectName;
    }

    public LocalDateTime getScanDate() {
        return scanDate;
    }

    public void setScanDate(LocalDateTime scanDate) {
        this.scanDate = scanDate;
    }

    public Integer getGlobalSecurityScore() {
        return globalSecurityScore;
    }

    public void setGlobalSecurityScore(Integer globalSecurityScore) {
        this.globalSecurityScore = globalSecurityScore;
    }

    public List<Endpoint> getEndpoints() {
        return endpoints;
    }

    public void setEndpoints(List<Endpoint> endpoints) {
        this.endpoints = endpoints;
    }
}