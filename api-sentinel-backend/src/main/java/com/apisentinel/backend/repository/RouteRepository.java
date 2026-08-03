package com.apisentinel.backend.repository;

import com.apisentinel.backend.entity.Route;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RouteRepository extends JpaRepository<Route, Long> {
}