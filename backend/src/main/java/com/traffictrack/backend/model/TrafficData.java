package com.traffictrack.backend.model;

import java.time.LocalDateTime;
import java.util.List;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

@Entity
@Table(name = "traffic_data")
public class TrafficData {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private Double latitude;
    
    @Column(nullable = false)
    private Double longitude;
    
    @Column(nullable = false)
    private Double radius; // Search radius in km
    
    @Column(name = "congestion_level")
    private Double congestionLevel; // 0.0 to 1.0
    
    @Column(name = "flow_speed")
    private Double flowSpeed; // km/h
    
    @Column(name = "free_flow_speed")
    private Double freeFlowSpeed; // km/h
    
    @Column(name = "current_travel_time")
    private Integer currentTravelTime; // seconds
    
    @Column(name = "free_flow_travel_time")
    private Integer freeFlowTravelTime; // seconds
    
    @Column(name = "road_closure")
    private Boolean roadClosure = false;
    
    @Column(name = "data_source")
    private String dataSource; // "google", "tomtom", "here", "static"
    
    @Column(name = "fetched_at")
    private LocalDateTime fetchedAt;
    
    @OneToMany(mappedBy = "trafficData", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<TrafficIncident> incidents;
    
    // Constructors
    public TrafficData() {
        this.fetchedAt = LocalDateTime.now();
    }
    
    public TrafficData(Double latitude, Double longitude, Double radius) {
        this.latitude = latitude;
        this.longitude = longitude;
        this.radius = radius;
        this.fetchedAt = LocalDateTime.now();
    }
    
    // Getters and Setters
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public Double getLatitude() {
        return latitude;
    }
    
    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }
    
    public Double getLongitude() {
        return longitude;
    }
    
    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }
    
    public Double getRadius() {
        return radius;
    }
    
    public void setRadius(Double radius) {
        this.radius = radius;
    }
    
    public Double getCongestionLevel() {
        return congestionLevel;
    }
    
    public void setCongestionLevel(Double congestionLevel) {
        this.congestionLevel = congestionLevel;
    }
    
    public Double getFlowSpeed() {
        return flowSpeed;
    }
    
    public void setFlowSpeed(Double flowSpeed) {
        this.flowSpeed = flowSpeed;
    }
    
    public Double getFreeFlowSpeed() {
        return freeFlowSpeed;
    }
    
    public void setFreeFlowSpeed(Double freeFlowSpeed) {
        this.freeFlowSpeed = freeFlowSpeed;
    }
    
    public Integer getCurrentTravelTime() {
        return currentTravelTime;
    }
    
    public void setCurrentTravelTime(Integer currentTravelTime) {
        this.currentTravelTime = currentTravelTime;
    }
    
    public Integer getFreeFlowTravelTime() {
        return freeFlowTravelTime;
    }
    
    public void setFreeFlowTravelTime(Integer freeFlowTravelTime) {
        this.freeFlowTravelTime = freeFlowTravelTime;
    }
    
    public Boolean getRoadClosure() {
        return roadClosure;
    }
    
    public void setRoadClosure(Boolean roadClosure) {
        this.roadClosure = roadClosure;
    }
    
    public String getDataSource() {
        return dataSource;
    }
    
    public void setDataSource(String dataSource) {
        this.dataSource = dataSource;
    }
    
    public LocalDateTime getFetchedAt() {
        return fetchedAt;
    }
    
    public void setFetchedAt(LocalDateTime fetchedAt) {
        this.fetchedAt = fetchedAt;
    }
    
    public List<TrafficIncident> getIncidents() {
        return incidents;
    }
    
    public void setIncidents(List<TrafficIncident> incidents) {
        this.incidents = incidents;
    }
}
