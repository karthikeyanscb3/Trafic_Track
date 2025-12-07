package com.traffictrack.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(@NonNull CorsRegistry registry) {
        // Make CORS permissive so APIs are publicly accessible from any origin.
        // For production, restrict this to the known origins or secure endpoints properly.
        registry.addMapping("/**")
                .allowedOriginPatterns("*")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD")
                .allowedHeaders("*")
                // We disable credentials when allowing all origins. If you need cookies/auth,
                // set allowedOriginPatterns to specific origins and enable allowCredentials(true).
                .allowCredentials(false)
                .maxAge(3600);
    }
}
