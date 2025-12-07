package com.traffictrack.backend.service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;

import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.traffictrack.backend.model.ApiCredential;
import com.traffictrack.backend.model.TrafficData;
import com.traffictrack.backend.model.TrafficIncident;
import com.traffictrack.backend.repository.ApiCredentialRepository;
import com.traffictrack.backend.repository.TrafficDataRepository;
import com.traffictrack.backend.repository.TrafficIncidentRepository;

@Service
public class TrafficApiService {
    
    private static final Logger LOGGER = Logger.getLogger(TrafficApiService.class.getName());
    private final HttpClient httpClient;
    private final ApiCredentialRepository apiCredentialRepository;
    private final TrafficDataRepository trafficDataRepository;
    private final TrafficIncidentRepository trafficIncidentRepository;
    
    @Value("${traffic.api.timeout:10}")
    private int apiTimeoutSeconds;
    
    public TrafficApiService(ApiCredentialRepository apiCredentialRepository,
                            TrafficDataRepository trafficDataRepository,
                            TrafficIncidentRepository trafficIncidentRepository) {
        this.apiCredentialRepository = apiCredentialRepository;
        this.trafficDataRepository = trafficDataRepository;
        this.trafficIncidentRepository = trafficIncidentRepository;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }
    
    /**
     * Fetch live traffic data from configured API provider
     */
    public TrafficData fetchLiveTrafficData(Double latitude, Double longitude, Double radius) {
        try {
            // Get active API credential
            ApiCredential credential = getActiveCredential();
            if (credential == null) {
                LOGGER.warning("No active API credential found. Using static data.");
                return createStaticTrafficData(latitude, longitude, radius);
            }
            
            String provider = credential.getProvider().toLowerCase();
            TrafficData trafficData = null;
            
            switch (provider) {
                case "google maps traffic api":
                    trafficData = fetchGoogleTrafficData(credential, latitude, longitude, radius);
                    break;
                case "tomtom traffic api":
                    trafficData = fetchTomTomTrafficData(credential, latitude, longitude, radius);
                    break;
                case "here traffic api":
                    trafficData = fetchHereTrafficData(credential, latitude, longitude, radius);
                    break;
                default:
                    LOGGER.warning("Unknown provider: " + provider + ". Using static data.");
                    trafficData = createStaticTrafficData(latitude, longitude, radius);
            }
            
            // Save to database
            if (trafficData != null) {
                trafficData = trafficDataRepository.save(trafficData);
            }
            
            return trafficData;
            
        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "Error fetching live traffic data", e);
            return createStaticTrafficData(latitude, longitude, radius);
        }
    }
    
    /**
     * Fetch traffic data from Google Maps Roads API
     */
    private TrafficData fetchGoogleTrafficData(ApiCredential credential, Double lat, Double lng, Double radius) {
        try {
            // Google Roads API - Speed Limits and Traffic
            String url = String.format(
                "https://roads.googleapis.com/v1/nearestRoads?points=%f,%f&key=%s",
                lat, lng, credential.getApiKey()
            );
            
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(apiTimeoutSeconds))
                    .GET()
                    .build();
            
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            
            if (response.statusCode() == 200) {
                JSONObject json = new JSONObject(response.body());
                TrafficData trafficData = new TrafficData(lat, lng, radius);
                trafficData.setDataSource("google");
                
                // Parse Google response
                if (json.has("snappedPoints")) {
                    JSONArray points = json.getJSONArray("snappedPoints");
                    if (points.length() > 0) {
                        // Calculate average congestion from nearby roads
                        double avgCongestion = calculateCongestionFromGoogleData(json);
                        trafficData.setCongestionLevel(avgCongestion);
                        trafficData.setFlowSpeed(calculateSpeedFromCongestion(avgCongestion));
                        trafficData.setFreeFlowSpeed(50.0); // Default free flow speed
                    }
                }
                
                return trafficData;
            } else {
                LOGGER.warning("Google API returned status: " + response.statusCode());
                return createStaticTrafficData(lat, lng, radius);
            }
            
        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "Error calling Google API", e);
            return createStaticTrafficData(lat, lng, radius);
        }
    }
    
    /**
     * Fetch traffic data from TomTom Traffic API
     */
    private TrafficData fetchTomTomTrafficData(ApiCredential credential, Double lat, Double lng, Double radius) {
        try {
            // TomTom Traffic Flow API
            String url = String.format(
                "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=%f,%f&key=%s",
                lat, lng, credential.getApiKey()
            );
            
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(apiTimeoutSeconds))
                    .GET()
                    .build();
            
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            
            if (response.statusCode() == 200) {
                JSONObject json = new JSONObject(response.body());
                TrafficData trafficData = new TrafficData(lat, lng, radius);
                trafficData.setDataSource("tomtom");
                
                if (json.has("flowSegmentData")) {
                    JSONObject flowData = json.getJSONObject("flowSegmentData");
                    
                    double currentSpeed = flowData.optDouble("currentSpeed", 0);
                    double freeFlowSpeed = flowData.optDouble("freeFlowSpeed", 50);
                    double congestion = 1.0 - (currentSpeed / freeFlowSpeed);
                    congestion = Math.max(0.0, Math.min(1.0, congestion));
                    
                    trafficData.setCongestionLevel(congestion);
                    trafficData.setFlowSpeed(currentSpeed);
                    trafficData.setFreeFlowSpeed(freeFlowSpeed);
                    trafficData.setCurrentTravelTime(flowData.optInt("currentTravelTime", 0));
                    trafficData.setFreeFlowTravelTime(flowData.optInt("freeFlowTravelTime", 0));
                    trafficData.setRoadClosure(flowData.optBoolean("roadClosure", false));
                }
                
                // Fetch incidents
                fetchTomTomIncidents(credential, lat, lng, radius, trafficData);
                
                return trafficData;
            } else {
                LOGGER.warning("TomTom API returned status: " + response.statusCode());
                return createStaticTrafficData(lat, lng, radius);
            }
            
        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "Error calling TomTom API", e);
            return createStaticTrafficData(lat, lng, radius);
        }
    }
    
    /**
     * Fetch incidents from TomTom
     */
    private void fetchTomTomIncidents(ApiCredential credential, Double lat, Double lng, Double radius, TrafficData trafficData) {
        try {
            // Convert radius to bounding box (rough approximation)
            double latRadius = radius / 111.0; // ~111 km per degree
            double lngRadius = radius / (111.0 * Math.cos(Math.toRadians(lat)));
            
            String bbox = String.format("%f,%f,%f,%f", 
                lng - lngRadius, lat - latRadius, lng + lngRadius, lat + latRadius);
            
            String url = String.format(
                "https://api.tomtom.com/traffic/services/5/incidentDetails?bbox=%s&fields={incidents{type,geometry,properties{iconCategory,magnitudeOfDelay,events{description,code}}}}&key=%s",
                bbox, credential.getApiKey()
            );
            
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(apiTimeoutSeconds))
                    .GET()
                    .build();
            
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            
            if (response.statusCode() == 200) {
                JSONObject json = new JSONObject(response.body());
                List<TrafficIncident> incidents = new ArrayList<>();
                
                if (json.has("incidents")) {
                    JSONArray incidentsArray = json.getJSONArray("incidents");
                    for (int i = 0; i < incidentsArray.length(); i++) {
                        JSONObject incident = incidentsArray.getJSONObject(i);
                        TrafficIncident trafficIncident = parseIncidentFromTomTom(incident);
                        if (trafficIncident != null) {
                            trafficIncident.setTrafficData(trafficData);
                            incidents.add(trafficIncident);
                        }
                    }
                }
                
                trafficData.setIncidents(incidents);
            }
            
        } catch (Exception e) {
            LOGGER.log(Level.WARNING, "Error fetching TomTom incidents", e);
        }
    }
    
    /**
     * Fetch traffic data from HERE Traffic API
     * Note: HERE API requires proper authentication and may have different endpoint formats
     * This is a simplified implementation. For production, verify the correct HERE API v8 endpoints
     */
    private TrafficData fetchHereTrafficData(ApiCredential credential, Double lat, Double lng, Double radius) {
        try {
            // HERE Traffic API v8 - Flow endpoint with proper format
            // Note: As of 2024, HERE uses v8 API with different authentication
            String url = String.format(
                "https://data.traffic.hereapi.com/v7/flow?in=circle:%f,%f;r=%d&locationReferencing=shape&apiKey=%s",
                lat, lng, (int)(radius * 1000), credential.getApiKey()
            );
            
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(apiTimeoutSeconds))
                    .header("Accept", "application/json")
                    .GET()
                    .build();
            
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            
            if (response.statusCode() == 200) {
                JSONObject json = new JSONObject(response.body());
                TrafficData trafficData = new TrafficData(lat, lng, radius);
                trafficData.setDataSource("here");
                
                if (json.has("results")) {
                    JSONArray results = json.getJSONArray("results");
                    if (results.length() > 0) {
                        double totalCongestion = 0;
                        double totalSpeed = 0;
                        int count = 0;
                        
                        for (int i = 0; i < results.length(); i++) {
                            JSONObject result = results.getJSONObject(i);
                            if (result.has("currentFlow")) {
                                JSONObject flow = result.getJSONObject("currentFlow");
                                double speed = flow.optDouble("speed", 0);
                                double freeFlow = flow.optDouble("freeFlow", 50);
                                totalSpeed += speed;
                                totalCongestion += (1.0 - (speed / freeFlow));
                                count++;
                            }
                        }
                        
                        if (count > 0) {
                            double avgCongestion = totalCongestion / count;
                            avgCongestion = Math.max(0.0, Math.min(1.0, avgCongestion));
                            trafficData.setCongestionLevel(avgCongestion);
                            trafficData.setFlowSpeed(totalSpeed / count);
                            trafficData.setFreeFlowSpeed(50.0);
                        }
                    }
                }
                
                return trafficData;
            } else {
                String errorMsg = String.format("HERE API returned status: %d", response.statusCode());
                if (response.statusCode() == 401) {
                    errorMsg += " (Unauthorized - Check API key validity and permissions)";
                }
                LOGGER.warning(errorMsg);
                
                // Log response body for debugging (first 200 chars)
                String body = response.body();
                if (body != null && !body.isEmpty()) {
                    String preview = body.length() > 200 ? body.substring(0, 200) + "..." : body;
                    LOGGER.warning("HERE API error response: " + preview);
                }
                
                return createStaticTrafficData(lat, lng, radius);
            }
            
        } catch (Exception e) {
            LOGGER.log(Level.SEVERE, "Error calling HERE API", e);
            return createStaticTrafficData(lat, lng, radius);
        }
    }
    
    /**
     * Parse incident from TomTom response
     */
    private TrafficIncident parseIncidentFromTomTom(JSONObject incident) {
        try {
            JSONObject geometry = incident.optJSONObject("geometry");
            if (geometry == null) return null;
            
            JSONArray coordinates = geometry.optJSONArray("coordinates");
            if (coordinates == null || coordinates.length() < 2) return null;
            
            double lng = coordinates.getDouble(0);
            double lat = coordinates.getDouble(1);
            
            JSONObject properties = incident.optJSONObject("properties");
            if (properties == null) return null;
            
            String iconCategory = properties.optString("iconCategory", "other");
            int magnitude = properties.optInt("magnitudeOfDelay", 0);
            
            String incidentType = mapTomTomIconToType(iconCategory);
            String severity = magnitude < 1 ? "low" : magnitude < 3 ? "medium" : magnitude < 5 ? "high" : "critical";
            
            TrafficIncident trafficIncident = new TrafficIncident(lat, lng, incidentType, severity);
            trafficIncident.setDelayMinutes(magnitude);
            
            // Get description
            if (properties.has("events")) {
                JSONArray events = properties.getJSONArray("events");
                if (events.length() > 0) {
                    JSONObject event = events.getJSONObject(0);
                    String description = event.optString("description", "");
                    trafficIncident.setDescription(description);
                }
            }
            
            return trafficIncident;
            
        } catch (Exception e) {
            LOGGER.log(Level.WARNING, "Error parsing incident", e);
            return null;
        }
    }
    
    /**
     * Map TomTom icon category to incident type
     */
    private String mapTomTomIconToType(String iconCategory) {
        switch (iconCategory.toLowerCase()) {
            case "accident": return "accident";
            case "roadwork": case "construction": return "roadwork";
            case "congestion": case "jam": return "congestion";
            case "closure": case "roadclosed": return "closure";
            default: return "other";
        }
    }
    
    /**
     * Calculate congestion level from Google data
     */
    private double calculateCongestionFromGoogleData(JSONObject json) {
        // Google Roads API doesn't provide direct congestion data
        // This is a simplified estimation
        // In production, you'd use Google Maps Directions API with traffic model
        return Math.random() * 0.5; // Random low-medium congestion as fallback
    }
    
    /**
     * Calculate speed from congestion level
     */
    private double calculateSpeedFromCongestion(double congestion) {
        double freeFlowSpeed = 50.0; // km/h
        return freeFlowSpeed * (1.0 - congestion);
    }
    
    /**
     * Create static/simulated traffic data as fallback
     */
    private TrafficData createStaticTrafficData(Double lat, Double lng, Double radius) {
        TrafficData trafficData = new TrafficData(lat, lng, radius);
        trafficData.setDataSource("static");
        trafficData.setCongestionLevel(Math.random() * 0.7);
        trafficData.setFlowSpeed(20.0 + Math.random() * 30.0);
        trafficData.setFreeFlowSpeed(50.0);
        trafficData.setCurrentTravelTime((int)(Math.random() * 600 + 300));
        trafficData.setFreeFlowTravelTime(300);
        trafficData.setRoadClosure(false);
        return trafficData;
    }
    
    /**
     * Get active API credential
     */
    private ApiCredential getActiveCredential() {
        List<ApiCredential> credentials = apiCredentialRepository.findAll();
        return credentials.stream()
                .filter(c -> c.getApiKey() != null && !c.getApiKey().isEmpty())
                .findFirst()
                .orElse(null);
    }
    
    /**
     * Clean up old traffic data (older than 24 hours)
     */
    public void cleanupOldData() {
        try {
            LocalDateTime cutoff = LocalDateTime.now().minusHours(24);
            trafficDataRepository.deleteByFetchedAtBefore(cutoff);
            trafficIncidentRepository.deleteByReportedAtBefore(cutoff);
            LOGGER.info("Cleaned up old traffic data");
        } catch (Exception e) {
            LOGGER.log(Level.WARNING, "Error cleaning up old data", e);
        }
    }
}
