package com.apisentinel.backend.repository;

import com.apisentinel.backend.entity.AuditResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AuditResultRepository extends JpaRepository<AuditResult, Long> {
    List<AuditResult> findByEndpoint_Project_Id(Long projectId);
}