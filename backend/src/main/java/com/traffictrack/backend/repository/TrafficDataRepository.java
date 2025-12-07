package com.traffictrack.backend.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.traffictrack.backend.model.TrafficData;

@Repository
public interface TrafficDataRepository extends JpaRepository<TrafficData, Long> {
    
    /**
     * Find most recent traffic data for a specific location and radius
     */
    @Query("SELECT t FROM TrafficData t WHERE t.latitude = :lat AND t.longitude = :lng AND t.radius = :radius ORDER BY t.fetchedAt DESC")
    Optional<TrafficData> findLatestByLocation(@Param("lat") Double latitude, @Param("lng") Double longitude, @Param("radius") Double radius);
    
    /**
     * Find all traffic data within a time range
     */
    List<TrafficData> findByFetchedAtBetween(LocalDateTime start, LocalDateTime end);
    
    /**
     * Delete old traffic data
     */
    void deleteByFetchedAtBefore(LocalDateTime cutoffTime);
    
    /**
     * Find all recent traffic data (last hour)
     */
    @Query("SELECT t FROM TrafficData t WHERE t.fetchedAt > :cutoffTime ORDER BY t.fetchedAt DESC")
    List<TrafficData> findRecentData(@Param("cutoffTime") LocalDateTime cutoffTime);
}
