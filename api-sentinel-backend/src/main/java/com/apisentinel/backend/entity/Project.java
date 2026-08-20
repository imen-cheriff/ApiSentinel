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


    private static final Map<RiskLevel, Double> RISK_WEIGHT = Map.of(
            RiskLevel.CRITICAL, 0.40,
            RiskLevel.HIGH,     0.25,
            RiskLevel.MEDIUM,   0.12,
            RiskLevel.LOW,      0.05
    );

    private static final double DEFAULT_WEIGHT = 0.08; // inconnue

    private static final int REFERENCE_ENDPOINT_COUNT = 6;
    private static final double MAX_COVERAGE_ADJUSTMENT = 5.0;

    public void calculateSecurityScore(List<AuditResult> allResults) {
        if (allResults == null || allResults.isEmpty()) {
            this.globalSecurityScore = 100;
            return;
        }

        double survivalProbability = allResults.stream()
                .mapToDouble(r -> 1.0 - RISK_WEIGHT.getOrDefault(r.getRiskLevel(), DEFAULT_WEIGHT))
                .reduce(1.0, (a, b) -> a * b);

        double cumulativeRisk = 1.0 - survivalProbability;

        double baseScore = 100.0 * (1.0 - cumulativeRisk);

        int totalEndpoints = (this.endpoints != null && !this.endpoints.isEmpty())
                ? this.endpoints.size()
                : allResults.size();

        double coverageRatio = totalEndpoints / (double) REFERENCE_ENDPOINT_COUNT;
        double coverageAdjustment = MAX_COVERAGE_ADJUSTMENT * Math.tanh(coverageRatio - 1.0);

        int score = (int) Math.round(baseScore + coverageAdjustment);
        this.globalSecurityScore = Math.max(0, Math.min(100, score));
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