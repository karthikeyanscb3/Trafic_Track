package com.traffictrack.backend.service;

import com.traffictrack.backend.model.Vehicle;
import com.traffictrack.backend.repository.VehicleRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class VehicleService {
    private final VehicleRepository repository;

    public VehicleService(VehicleRepository repository) {
        this.repository = repository;
    }

    public List<Vehicle> findAll() {
        return repository.findAll();
    }

    public Vehicle save(Vehicle v) {
        return repository.save(v);
    }
}
