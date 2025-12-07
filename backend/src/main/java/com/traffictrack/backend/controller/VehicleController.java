package com.traffictrack.backend.controller;

import com.traffictrack.backend.model.Vehicle;
import com.traffictrack.backend.service.VehicleService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/vehicles")
@CrossOrigin(origins = "http://localhost:3000")
public class VehicleController {

    private final VehicleService service;

    public VehicleController(VehicleService service) {
        this.service = service;
    }

    @GetMapping
    public List<Vehicle> list() {
        return service.findAll();
    }

    @PostMapping
    public ResponseEntity<Vehicle> create(@RequestBody Vehicle v) {
        Vehicle saved = service.save(v);
        return ResponseEntity.ok(saved);
    }
}
