package com.traffictrack.backend.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.traffictrack.backend.model.ApiCredential;

@Repository
public interface ApiCredentialRepository extends JpaRepository<ApiCredential, Long> {
    Optional<ApiCredential> findTopByOrderByIdDesc();
    
    @Modifying
    @Query(value = "DELETE FROM api_credentials", nativeQuery = true)
    void deleteAllNative();
}
