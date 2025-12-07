package com.traffictrack.backend.controller;

import java.util.HashMap;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.traffictrack.backend.model.ApiCredential;
import com.traffictrack.backend.service.ApiCredentialService;

@RestController
@RequestMapping("/api/credentials")
public class ApiCredentialController {

    private final ApiCredentialService service;

    public ApiCredentialController(ApiCredentialService service) {
        this.service = service;
    }

    public static class SaveRequest {
        public String provider;
        public String apiKey;
    }

    public static class CredentialResponse {
        public Long id;
        public String provider;
        public String apiKeyMasked;
        public String createdAt;
        public String updatedAt;
    }

    @PostMapping
    public ResponseEntity<?> save(@RequestBody SaveRequest req) {
        if (req == null || !StringUtils.hasText(req.provider) || !StringUtils.hasText(req.apiKey)) {
            Map<String, String> err = new HashMap<>();
            err.put("error", "provider and apiKey are required");
            return ResponseEntity.badRequest().body(err);
        }
        try {
            ApiCredential saved = service.save(req.provider.trim(), req.apiKey.trim());
            CredentialResponse r = new CredentialResponse();
            r.id = saved.getId();
            r.provider = saved.getProvider();
            r.apiKeyMasked = maskKey(saved.getApiKey());
            r.createdAt = saved.getCreatedAt() != null ? saved.getCreatedAt().toString() : null;
            r.updatedAt = saved.getUpdatedAt() != null ? saved.getUpdatedAt().toString() : null;
            return ResponseEntity.ok(r);
        } catch (IllegalStateException ise) {
            Map<String, String> err = new HashMap<>();
            err.put("error", "Encryption not configured: " + ise.getMessage());
            return ResponseEntity.status(500).body(err);
        } catch (Exception ex) {
            Map<String, String> err = new HashMap<>();
            err.put("error", "Failed to save credential: " + ex.getMessage());
            return ResponseEntity.status(500).body(err);
        }
    }

    @GetMapping("/latest")
    public ResponseEntity<?> latest() {
        return service.getLatest()
                .map(saved -> {
                    CredentialResponse r = new CredentialResponse();
                    r.id = saved.getId();
                    r.provider = saved.getProvider();
                    r.apiKeyMasked = maskKey(saved.getApiKey());
                    r.createdAt = saved.getCreatedAt() != null ? saved.getCreatedAt().toString() : null;
                    r.updatedAt = saved.getUpdatedAt() != null ? saved.getUpdatedAt().toString() : null;
                    return ResponseEntity.ok(r);
                })
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    private String maskKey(String k) {
        if (k == null) return null;
        int len = k.length();
        if (len <= 8) return "****" + k.substring(Math.max(0, len - 4));
        String visible = k.substring(len - 4);
        return "****" + visible;
    }
}
