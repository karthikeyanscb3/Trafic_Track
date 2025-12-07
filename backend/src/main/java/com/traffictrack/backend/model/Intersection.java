package com.traffictrack.backend.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "intersections")
public class Intersection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Double lat;

    @Column(nullable = false)
    private Double lng;

    @Column(nullable = false)
    private Integer gridX;

    @Column(nullable = false)
    private Integer gridY;

    @Column(nullable = false, length = 500)
    private String name;

    @Column(nullable = false)
    private Double congestion;

    @Column(nullable = false)
    private Integer cycleDuration;

    @Column(nullable = false)
    private Integer timeRemaining;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // Constructors
    public Intersection() {
    }

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public Intersection(Double lat, Double lng, Integer gridX, Integer gridY, String name, 
                       Double congestion, Integer cycleDuration, Integer timeRemaining) {
        this.lat = lat;
        this.lng = lng;
        this.gridX = gridX;
        this.gridY = gridY;
        this.name = name;
        this.congestion = congestion;
        this.cycleDuration = cycleDuration;
        this.timeRemaining = timeRemaining;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Double getLat() {
        return lat;
    }

    public void setLat(Double lat) {
        this.lat = lat;
    }

    public Double getLng() {
        return lng;
    }

    public void setLng(Double lng) {
        this.lng = lng;
    }

    public Integer getGridX() {
        return gridX;
    }

    public void setGridX(Integer gridX) {
        this.gridX = gridX;
    }

    public Integer getGridY() {
        return gridY;
    }

    public void setGridY(Integer gridY) {
        this.gridY = gridY;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Double getCongestion() {
        return congestion;
    }

    public void setCongestion(Double congestion) {
        this.congestion = congestion;
    }

    public Integer getCycleDuration() {
        return cycleDuration;
    }

    public void setCycleDuration(Integer cycleDuration) {
        this.cycleDuration = cycleDuration;
    }

    public Integer getTimeRemaining() {
        return timeRemaining;
    }

    public void setTimeRemaining(Integer timeRemaining) {
        this.timeRemaining = timeRemaining;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
