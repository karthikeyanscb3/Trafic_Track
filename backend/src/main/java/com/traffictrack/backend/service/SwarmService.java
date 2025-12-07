package com.traffictrack.backend.service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.traffictrack.backend.model.Intersection;
import com.traffictrack.backend.model.Road;
import com.traffictrack.backend.repository.IntersectionRepository;
import com.traffictrack.backend.repository.RoadRepository;

@Service
public class SwarmService {

    private static final int GRID_SIZE = 9;
    private static final Duration CACHE_DURATION = Duration.ofMinutes(10);
    private final IntersectionRepository intersectionRepository;
    private final RoadRepository roadRepository;
    private volatile Map<String, Object> cachedResponse;
    private volatile Instant cacheTimestamp = Instant.EPOCH;
    private final Object cacheLock = new Object();

    public SwarmService(IntersectionRepository intersectionRepository, RoadRepository roadRepository) {
        this.intersectionRepository = intersectionRepository;
        this.roadRepository = roadRepository;
    }

    /**
     * Get swarm data from database. If no data exists, initialize with default data.
     */
    @Transactional
    public Map<String, Object> getSwarmData() {
        Map<String, Object> snapshot = cachedResponse;
        if (snapshot != null && Duration.between(cacheTimestamp, Instant.now()).compareTo(CACHE_DURATION) < 0) {
            return snapshot;
        }

        synchronized (cacheLock) {
            if (cachedResponse != null && Duration.between(cacheTimestamp, Instant.now()).compareTo(CACHE_DURATION) < 0) {
                return cachedResponse;
            }

            Map<String, Object> fresh = fetchSwarmData();
            cachedResponse = fresh;
            cacheTimestamp = Instant.now();
            return fresh;
        }
    }

    private Map<String, Object> fetchSwarmData() {
        List<Intersection> intersections = intersectionRepository.findAll();
        List<Road> roads = roadRepository.findAll();

        if (intersections.isEmpty() && roads.isEmpty()) {
            return initializeDefaultData();
        }

        return buildSwarmResponse(intersections, roads);
    }

    /**
     * Initialize database with default grid data
     */
    @Transactional
    public Map<String, Object> initializeDefaultData() {
        double centerLat = 51.505;
        double centerLng = -0.09;
        double radius = 0.05;

        double topLeftLat = centerLat + radius;
        double topLeftLng = centerLng - radius;
        double step = (radius * 2) / (GRID_SIZE - 1);

        String[] streetNames = new String[]{"Main","Oak","Pine","Maple","Cedar","Elm","Wall","Park"};
        String[] avenueNames = new String[]{"1st","2nd","3rd","4th","5th","Broadway","Central","Lexington"};

        List<Intersection> intersections = new ArrayList<>();
        List<Road> roads = new ArrayList<>();

        // Create intersections
        for (int i = 0; i < GRID_SIZE; i++) {
            for (int j = 0; j < GRID_SIZE; j++) {
                double lat = topLeftLat - i * step;
                double lng = topLeftLng + j * step;
                String name = streetNames[(i + j) % streetNames.length] + " St & " + avenueNames[j % avenueNames.length] + " Ave";
                int cycle = 30 + (int) (Math.random() * 31);
                double congestion = Math.random() * 0.8;

                Intersection intersection = new Intersection(lat, lng, i, j, name, congestion, cycle, cycle);
                intersections.add(intersection);
            }
        }

        // Save intersections to database
        intersections = intersectionRepository.saveAll(intersections);

        // Create roads connecting intersections
        for (int i = 0; i < GRID_SIZE; i++) {
            for (int j = 0; j < GRID_SIZE; j++) {
                double lat = topLeftLat - i * step;
                double lng = topLeftLng + j * step;

                // Connect to right neighbor
                if (j < GRID_SIZE - 1) {
                    double latR = topLeftLat - i * step;
                    double lngR = topLeftLng + (j + 1) * step;
                    Road road = new Road(lat, lng, latR, lngR, Math.random() * 0.7);
                    roads.add(road);
                }

                // Connect to bottom neighbor
                if (i < GRID_SIZE - 1) {
                    double latB = topLeftLat - (i + 1) * step;
                    double lngB = topLeftLng + j * step;
                    Road road = new Road(lat, lng, latB, lngB, Math.random() * 0.7);
                    roads.add(road);
                }
            }
        }

        // Save roads to database
        roads = roadRepository.saveAll(roads);

        return buildSwarmResponse(intersections, roads);
    }

    /**
     * Build the response map from entities
     */
    private Map<String, Object> buildSwarmResponse(List<Intersection> intersections, List<Road> roads) {
        Map<String, Object> result = new HashMap<>();

        List<Map<String, Object>> intersectionList = new ArrayList<>();
        for (Intersection inter : intersections) {
            Map<String, Object> interMap = new HashMap<>();
            interMap.put("lat", inter.getLat());
            interMap.put("lng", inter.getLng());
            interMap.put("gridX", inter.getGridX());
            interMap.put("gridY", inter.getGridY());
            interMap.put("name", inter.getName());
            interMap.put("congestion", inter.getCongestion());
            interMap.put("cycleDuration", inter.getCycleDuration());
            interMap.put("timeRemaining", inter.getTimeRemaining());
            intersectionList.add(interMap);
        }

        List<Map<String, Object>> roadList = new ArrayList<>();
        for (Road road : roads) {
            Map<String, Object> roadMap = new HashMap<>();
            roadMap.put("start", new double[]{road.getStartLat(), road.getStartLng()});
            roadMap.put("end", new double[]{road.getEndLat(), road.getEndLng()});
            roadMap.put("congestion", road.getCongestion());
            roadList.add(roadMap);
        }

        result.put("intersections", intersectionList);
        result.put("roads", roadList);
        result.put("timestamp", System.currentTimeMillis());

        return result;
    }

    /**
     * Update congestion levels (can be called periodically or by external triggers)
     */
    @Transactional
    public void updateCongestion() {
        List<Intersection> intersections = intersectionRepository.findAll();
        for (Intersection inter : intersections) {
            // Simulate congestion changes
            inter.setCongestion(Math.random() * 0.8);
            inter.setTimeRemaining((int) (Math.random() * inter.getCycleDuration()));
        }
        intersectionRepository.saveAll(intersections);

        List<Road> roads = roadRepository.findAll();
        for (Road road : roads) {
            road.setCongestion(Math.random() * 0.7);
        }
        roadRepository.saveAll(roads);
    }

    /**
     * Clear all data from database
     */
    @Transactional
    public void clearAllData() {
        roadRepository.deleteAll();
        intersectionRepository.deleteAll();
    }
}
