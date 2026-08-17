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

    private static final Map<RiskLevel, Integer> PENALTY_BY_LEVEL = Map.of(
            RiskLevel.CRITICAL, 25,
            RiskLevel.HIGH, 15,
            RiskLevel.MEDIUM, 8,
            RiskLevel.LOW, 3
    );

    public void calculateSecurityScore(List<AuditResult> allResults) {
        int score = 100;
        for (AuditResult result : allResults) {
            score -= PENALTY_BY_LEVEL.getOrDefault(result.getRiskLevel(), 5);
        }
        this.globalSecurityScore = Math.max(0, score);
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