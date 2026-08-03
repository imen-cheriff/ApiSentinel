package com.apisentinel.backend.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.List;

@Entity
public class Project {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private long id;

    private String name;
    private LocalDateTime ScanDate;
    private int globalSecurityScore;
    private int totalEndpoints;
    private int criticalRisks;
    private int highRisks;
    private int mediumRisks;
    private int lowRisks;

    @OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Route> routes;

    public long getId() {
        return id;
    }

    public void setId(long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public LocalDateTime getScanDate() {
        return ScanDate;
    }

    public void setScanDate(LocalDateTime scanDate) {
        ScanDate = scanDate;
    }

    public int getGlobalSecurityScore() {
        return globalSecurityScore;
    }

    public void setGlobalSecurityScore(int globalSecurityScore) {
        this.globalSecurityScore = globalSecurityScore;
    }

    public int getTotalEndpoints() {
        return totalEndpoints;
    }

    public void setTotalEndpoints(int totalEndpoints) {
        this.totalEndpoints = totalEndpoints;
    }

    public int getCriticalRisks() {
        return criticalRisks;
    }

    public void setCriticalRisks(int criticalRisks) {
        this.criticalRisks = criticalRisks;
    }

    public int getHighRisks() {
        return highRisks;
    }

    public void setHighRisks(int highRisks) {
        this.highRisks = highRisks;
    }

    public int getMediumRisks() {
        return mediumRisks;
    }

    public void setMediumRisks(int mediumRisks) {
        this.mediumRisks = mediumRisks;
    }

    public int getLowRisks() {
        return lowRisks;
    }

    public void setLowRisks(int lowRisks) {
        this.lowRisks = lowRisks;
    }

    public List<Route> getRoutes() {
        return routes;
    }

    public void setRoutes(List<Route> routes) {
        this.routes = routes;
    }
}
