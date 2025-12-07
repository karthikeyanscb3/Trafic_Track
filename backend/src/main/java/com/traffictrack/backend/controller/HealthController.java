package com.traffictrack.backend.controller;

import java.util.HashMap;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/health")
public class HealthController {

    private final JdbcTemplate jdbcTemplate;

    public HealthController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping("/db")
    public ResponseEntity<Map<String, Object>> dbCheck() {
        Map<String, Object> resp = new HashMap<>();
        try {
            Integer val = jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            resp.put("db", "ok");
            resp.put("value", val);
            return ResponseEntity.ok(resp);
        } catch (Exception ex) {
            resp.put("db", "error");
            resp.put("message", ex.getMessage());
            return ResponseEntity.status(503).body(resp);
        }
    }

    @GetMapping("")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> resp = new HashMap<>();
        try {
            Integer val = jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            Map<String, Object> db = new HashMap<>();
            db.put("status", "UP");
            db.put("value", val);
            resp.put("status", "UP");
            resp.put("service", "Trafic Track Backend");
            resp.put("db", db);
            return ResponseEntity.ok(resp);
        } catch (Exception ex) {
            Map<String, Object> db = new HashMap<>();
            db.put("status", "DOWN");
            db.put("message", ex.getMessage());
            resp.put("status", "DEGRADED");
            resp.put("service", "Trafic Track Backend");
            resp.put("db", db);
            return ResponseEntity.status(503).body(resp);
        }
    }
}
