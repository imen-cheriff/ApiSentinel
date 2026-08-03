package com.apisentinel.backend.entity;

import jakarta.persistence.*;

import java.util.List;

@Entity
public class AuditResult {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String endpointId;
    private String riskLevel;
    private String owaspCategory;

    @Column(length = 2000)
    private String vulnerability;

    @Column(length = 2000)
    private String description;

    @Column(length = 2000)
    private String remediation;

    private String testScenarioTitle;
    private Integer expectedStatusOnSuccess;

    @Column(length = 2000)
    private String payloadExample;

    @OneToOne
    @JoinColumn(name = "route_id")
    private Route route;

    @OneToMany(mappedBy = "auditResult", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<TestStep> testSteps;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getEndpointId() {
        return endpointId;
    }

    public void setEndpointId(String endpointId) {
        this.endpointId = endpointId;
    }

    public String getRiskLevel() {
        return riskLevel;
    }

    public void setRiskLevel(String riskLevel) {
        this.riskLevel = riskLevel;
    }

    public String getOwaspCategory() {
        return owaspCategory;
    }

    public void setOwaspCategory(String owaspCategory) {
        this.owaspCategory = owaspCategory;
    }

    public String getVulnerability() {
        return vulnerability;
    }

    public void setVulnerability(String vulnerability) {
        this.vulnerability = vulnerability;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getRemediation() {
        return remediation;
    }

    public void setRemediation(String remediation) {
        this.remediation = remediation;
    }

    public String getTestScenarioTitle() {
        return testScenarioTitle;
    }

    public void setTestScenarioTitle(String testScenarioTitle) {
        this.testScenarioTitle = testScenarioTitle;
    }

    public Integer getExpectedStatusOnSuccess() {
        return expectedStatusOnSuccess;
    }

    public void setExpectedStatusOnSuccess(Integer expectedStatusOnSuccess) {
        this.expectedStatusOnSuccess = expectedStatusOnSuccess;
    }

    public String getPayloadExample() {
        return payloadExample;
    }

    public void setPayloadExample(String payloadExample) {
        this.payloadExample = payloadExample;
    }

    public Route getRoute() {
        return route;
    }

    public void setRoute(Route route) {
        this.route = route;
    }

    public List<TestStep> getTestSteps() {
        return testSteps;
    }

    public void setTestSteps(List<TestStep> testSteps) {
        this.testSteps = testSteps;
    }
}
