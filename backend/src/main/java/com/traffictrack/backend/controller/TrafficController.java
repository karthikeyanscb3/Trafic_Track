package com.traffictrack.backend.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.traffictrack.backend.model.TrafficData;
import com.traffictrack.backend.model.TrafficIncident;
import com.traffictrack.backend.service.TrafficApiService;

@RestController
@RequestMapping("/api/traffic")
public class TrafficController {

    private final TrafficApiService trafficApiService;

    public TrafficController(TrafficApiService trafficApiService) {
        this.trafficApiService = trafficApiService;
    }

    /**
     * Fetch live traffic data for a specific location
     * 
     * @param lat Latitude
     * @param lng Longitude
     * @param radius Radius in kilometers (default 5km)
     * @return Traffic data including congestion, speed, incidents
     */
    @GetMapping(value = "/live", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> getLiveTrafficData(
            @RequestParam Double lat,
            @RequestParam Double lng,
            @RequestParam(defaultValue = "5.0") Double radius) {
        
        try {
            TrafficData trafficData = trafficApiService.fetchLiveTrafficData(lat, lng, radius);
            
            if (trafficData == null) {
                return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                        .body(Map.of("error", "Unable to fetch traffic data"));
            }
            
            Map<String, Object> response = buildTrafficResponse(trafficData);
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Failed to fetch traffic data");
            error.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    /**
     * Fetch live traffic data for multiple locations (grid)
     * Used for map visualization with multiple points
     * 
     * @param centerLat Center latitude
     * @param centerLng Center longitude
     * @param radius Overall radius in km
     * @param gridSize Number of points per side (e.g., 3 = 3x3 grid = 9 points)
     * @return List of traffic data for each grid point
     */
    @GetMapping(value = "/grid", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> getGridTrafficData(
            @RequestParam Double centerLat,
            @RequestParam Double centerLng,
            @RequestParam(defaultValue = "5.0") Double radius,
            @RequestParam(defaultValue = "3") Integer gridSize) {
        
        try {
            Map<String, Object> response = new HashMap<>();
            response.put("center", Map.of("lat", centerLat, "lng", centerLng));
            response.put("radius", radius);
            response.put("gridSize", gridSize);
            
            // Calculate grid points
            double latStep = (radius * 2 / 111.0) / (gridSize - 1); // ~111km per degree
            double lngStep = (radius * 2 / (111.0 * Math.cos(Math.toRadians(centerLat)))) / (gridSize - 1);
            
            double topLeftLat = centerLat + (radius / 111.0);
            double topLeftLng = centerLng - (radius / (111.0 * Math.cos(Math.toRadians(centerLat))));
            
            List<Map<String, Object>> gridPoints = new java.util.ArrayList<>();
            
            for (int i = 0; i < gridSize; i++) {
                for (int j = 0; j < gridSize; j++) {
                    double lat = topLeftLat - (i * latStep);
                    double lng = topLeftLng + (j * lngStep);
                    
                    TrafficData trafficData = trafficApiService.fetchLiveTrafficData(lat, lng, radius / gridSize);
                    if (trafficData != null) {
                        Map<String, Object> point = new HashMap<>();
                        point.put("gridX", i);
                        point.put("gridY", j);
                        point.put("lat", lat);
                        point.put("lng", lng);
                        point.put("congestion", trafficData.getCongestionLevel());
                        point.put("flowSpeed", trafficData.getFlowSpeed());
                        point.put("freeFlowSpeed", trafficData.getFreeFlowSpeed());
                        point.put("dataSource", trafficData.getDataSource());
                        gridPoints.add(point);
                    }
                }
            }
            
            response.put("points", gridPoints);
            response.put("timestamp", System.currentTimeMillis());
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Failed to fetch grid traffic data");
            error.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    /**
     * Clean up old traffic data from database
     */
    @PostMapping("/cleanup")
    public ResponseEntity<Map<String, String>> cleanupOldData() {
        try {
            trafficApiService.cleanupOldData();
            return ResponseEntity.ok(Map.of("message", "Old traffic data cleaned up successfully"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to cleanup data", "message", e.getMessage()));
        }
    }
    
    /**
     * Build traffic response map from TrafficData entity
     */
    private Map<String, Object> buildTrafficResponse(TrafficData trafficData) {
        Map<String, Object> response = new HashMap<>();
        
        response.put("latitude", trafficData.getLatitude());
        response.put("longitude", trafficData.getLongitude());
        response.put("radius", trafficData.getRadius());
        response.put("congestionLevel", trafficData.getCongestionLevel());
        response.put("flowSpeed", trafficData.getFlowSpeed());
        response.put("freeFlowSpeed", trafficData.getFreeFlowSpeed());
        response.put("currentTravelTime", trafficData.getCurrentTravelTime());
        response.put("freeFlowTravelTime", trafficData.getFreeFlowTravelTime());
        response.put("roadClosure", trafficData.getRoadClosure());
        response.put("dataSource", trafficData.getDataSource());
        response.put("fetchedAt", trafficData.getFetchedAt().toString());
        
        // Add incidents
        if (trafficData.getIncidents() != null && !trafficData.getIncidents().isEmpty()) {
            List<Map<String, Object>> incidents = new java.util.ArrayList<>();
            for (TrafficIncident incident : trafficData.getIncidents()) {
                Map<String, Object> incidentMap = new HashMap<>();
                incidentMap.put("latitude", incident.getLatitude());
                incidentMap.put("longitude", incident.getLongitude());
                incidentMap.put("type", incident.getIncidentType());
                incidentMap.put("severity", incident.getSeverity());
                incidentMap.put("description", incident.getDescription());
                incidentMap.put("delayMinutes", incident.getDelayMinutes());
                incidentMap.put("reportedAt", incident.getReportedAt().toString());
                incidents.add(incidentMap);
            }
            response.put("incidents", incidents);
        }
        
        return response;
    }
}
