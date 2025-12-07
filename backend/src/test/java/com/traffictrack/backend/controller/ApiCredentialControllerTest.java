package com.traffictrack.backend.controller;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.TestPropertySource;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {"spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1","spring.datasource.driverClassName=org.h2.Driver","spring.jpa.hibernate.ddl-auto=create-drop"})
public class ApiCredentialControllerTest {

    static {
        // set system property so the converter has a key before Spring starts
        System.setProperty("APP_ENC_KEY", "test-passphrase-12345");
    }

    @Autowired
    private TestRestTemplate rest;

    @Test
    public void testSaveAndGetLatest() {
        String url = "/api/credentials";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String payload = "{\"provider\":\"Google Maps Traffic API\",\"apiKey\":\"sk_test_12345\"}";
    ResponseEntity<Map<String,Object>> post = rest.postForEntity(url, new HttpEntity<>(payload, headers), (Class) Map.class);
    assertThat(post.getStatusCode()).isEqualTo(HttpStatus.OK);
    Map<String,Object> body = post.getBody();
    assertThat(body).isNotNull();
    assertThat(body.get("provider")).isEqualTo("Google Maps Traffic API");
    assertThat(body.get("apiKeyMasked")).isNotNull();

    ResponseEntity<Map<String,Object>> get = rest.getForEntity("/api/credentials/latest", (Class) Map.class);
    assertThat(get.getStatusCode()).isEqualTo(HttpStatus.OK);
    Map<String,Object> latest = get.getBody();
    assertThat(latest).isNotNull();
    assertThat(latest.get("provider")).isEqualTo("Google Maps Traffic API");
    assertThat(latest.get("apiKeyMasked")).isNotNull();
    }
}
