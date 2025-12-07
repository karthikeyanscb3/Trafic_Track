package com.traffictrack.backend.repository;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.traffictrack.backend.model.TrafficIncident;

@Repository
public interface TrafficIncidentRepository extends JpaRepository<TrafficIncident, Long> {
    
    /**
     * Find incidents within a geographic bounding box
     */
    @Query("SELECT i FROM TrafficIncident i WHERE i.latitude BETWEEN :minLat AND :maxLat AND i.longitude BETWEEN :minLng AND :maxLng")
    List<TrafficIncident> findByLocationBounds(@Param("minLat") Double minLat, @Param("maxLat") Double maxLat, 
                                               @Param("minLng") Double minLng, @Param("maxLng") Double maxLng);
    
    /**
     * Find active incidents (reported in last 24 hours)
     */
    List<TrafficIncident> findByReportedAtAfter(LocalDateTime cutoffTime);
    
    /**
     * Delete old incidents
     */
    void deleteByReportedAtBefore(LocalDateTime cutoffTime);
}
