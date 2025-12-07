package com.traffictrack.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.traffictrack.backend.model.Intersection;

@Repository
public interface IntersectionRepository extends JpaRepository<Intersection, Long> {
    // Additional query methods can be added here if needed
    // For example: List<Intersection> findByGridXAndGridY(Integer gridX, Integer gridY);
}
