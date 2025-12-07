package com.traffictrack.backend.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.traffictrack.backend.model.ApiCredential;

@Repository
public interface ApiCredentialRepository extends JpaRepository<ApiCredential, Long> {
    Optional<ApiCredential> findTopByOrderByIdDesc();
}
