package com.traffictrack.backend.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "traffic_incidents")
public class TrafficIncident {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne
    @JoinColumn(name = "traffic_data_id")
    private TrafficData trafficData;
    
    @Column(nullable = false)
    private Double latitude;
    
    @Column(nullable = false)
    private Double longitude;
    
    @Column(name = "incident_type")
    private String incidentType; // "accident", "roadwork", "congestion", "closure", "other"
    
    @Column(name = "severity")
    private String severity; // "low", "medium", "high", "critical"
    
    @Column(name = "description", length = 1000)
    private String description;
    
    @Column(name = "reported_at")
    private LocalDateTime reportedAt;
    
    @Column(name = "delay_minutes")
    private Integer delayMinutes;
    
    // Constructors
    public TrafficIncident() {
        this.reportedAt = LocalDateTime.now();
    }
    
    public TrafficIncident(Double latitude, Double longitude, String incidentType, String severity) {
        this.latitude = latitude;
        this.longitude = longitude;
        this.incidentType = incidentType;
        this.severity = severity;
        this.reportedAt = LocalDateTime.now();
    }
    
    // Getters and Setters
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public TrafficData getTrafficData() {
        return trafficData;
    }
    
    public void setTrafficData(TrafficData trafficData) {
        this.trafficData = trafficData;
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
    
    public String getIncidentType() {
        return incidentType;
    }
    
    public void setIncidentType(String incidentType) {
        this.incidentType = incidentType;
    }
    
    public String getSeverity() {
        return severity;
    }
    
    public void setSeverity(String severity) {
        this.severity = severity;
    }
    
    public String getDescription() {
        return description;
    }
    
    public void setDescription(String description) {
        this.description = description;
    }
    
    public LocalDateTime getReportedAt() {
        return reportedAt;
    }
    
    public void setReportedAt(LocalDateTime reportedAt) {
        this.reportedAt = reportedAt;
    }
    
    public Integer getDelayMinutes() {
        return delayMinutes;
    }
    
    public void setDelayMinutes(Integer delayMinutes) {
        this.delayMinutes = delayMinutes;
    }
}
