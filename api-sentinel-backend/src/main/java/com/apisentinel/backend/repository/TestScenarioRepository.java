package com.apisentinel.backend.repository;

import com.apisentinel.backend.entity.TestScenario;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TestScenarioRepository extends JpaRepository<TestScenario, Long> {
}