package com.apisentinel.backend.repository;

import com.apisentinel.backend.entity.AuditResult;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditResultRepository extends JpaRepository<AuditResult, Long> {
}