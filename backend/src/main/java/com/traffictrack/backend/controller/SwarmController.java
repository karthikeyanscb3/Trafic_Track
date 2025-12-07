package com.traffictrack.backend.controller;

import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.traffictrack.backend.service.SwarmService;

@RestController
@RequestMapping("/api/swarm")
public class SwarmController {

    private final SwarmService swarmService;

    public SwarmController(SwarmService swarmService) {
        this.swarmService = swarmService;
    }

    /**
     * Get swarm data from database.
     * If database is empty, it will automatically initialize with default grid data.
     */
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> getSwarm() {
        return swarmService.getSwarmData();
    }

    /**
     * Initialize/reinitialize the swarm data with default grid
     */
    @PostMapping("/initialize")
    public ResponseEntity<Map<String, Object>> initializeSwarm() {
        swarmService.clearAllData();
        Map<String, Object> data = swarmService.initializeDefaultData();
        return ResponseEntity.ok(data);
    }

    /**
     * Update congestion levels for all intersections and roads
     */
    @PostMapping("/update-congestion")
    public ResponseEntity<String> updateCongestion() {
        swarmService.updateCongestion();
        return ResponseEntity.ok("Congestion updated successfully");
    }

    /**
     * Clear all swarm data from database
     */
    @DeleteMapping
    public ResponseEntity<String> clearSwarm() {
        swarmService.clearAllData();
        return ResponseEntity.ok("Swarm data cleared successfully");
    }
}
