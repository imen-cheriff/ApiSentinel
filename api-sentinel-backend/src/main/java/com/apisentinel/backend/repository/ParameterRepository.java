package com.apisentinel.backend.repository;

import com.apisentinel.backend.entity.Parameter;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ParameterRepository extends JpaRepository<Parameter, Long> {
}