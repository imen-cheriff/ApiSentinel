package com.apisentinel.backend.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import java.util.List;

@Entity
@Data
public class TestScenario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;

    @ElementCollection
    private List<String> steps;

    private Integer expectedStatusOnSuccess;

    @Column(length = 2000)
    private String payloadExample;

    @ManyToOne
    @JoinColumn(name = "audit_result_id")
    @JsonIgnore
    private AuditResult auditResult;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public List<String> getSteps() {
        return steps;
    }

    public void setSteps(List<String> steps) {
        this.steps = steps;
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

    public AuditResult getAuditResult() {
        return auditResult;
    }

    public void setAuditResult(AuditResult auditResult) {
        this.auditResult = auditResult;
    }
}