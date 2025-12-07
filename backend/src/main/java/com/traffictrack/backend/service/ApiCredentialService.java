package com.traffictrack.backend.service;

import java.util.Optional;

import org.springframework.stereotype.Service;

import com.traffictrack.backend.model.ApiCredential;
import com.traffictrack.backend.repository.ApiCredentialRepository;

@Service
public class ApiCredentialService {

    private final ApiCredentialRepository repository;

    public ApiCredentialService(ApiCredentialRepository repository) {
        this.repository = repository;
    }

    public ApiCredential save(String provider, String apiKey) {
        ApiCredential cred = new ApiCredential(provider, apiKey);
        return repository.save(cred);
    }

    public Optional<ApiCredential> getLatest() {
        return repository.findTopByOrderByIdDesc();
    }

    @org.springframework.transaction.annotation.Transactional
    public void deleteAll() {
        repository.deleteAllNative();
    }
}
