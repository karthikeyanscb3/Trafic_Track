package com.traffictrack.backend.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
public class SwarmControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    public void testGetSwarmReturnsIntersections() throws Exception {
        mockMvc.perform(get("/api/swarm"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intersections").exists())
                .andExpect(jsonPath("$.roads").exists());
    }
}
