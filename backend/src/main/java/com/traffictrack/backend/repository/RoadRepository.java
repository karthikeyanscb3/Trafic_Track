package com.traffictrack.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.traffictrack.backend.model.Road;

@Repository
public interface RoadRepository extends JpaRepository<Road, Long> {
    // Additional query methods can be added here if needed
}
