package com.traffictrack.backend.crypto;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.logging.Logger;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class ApiKeyAttributeConverter implements AttributeConverter<String, String> {

    private static final String ENV_KEY = "APP_ENC_KEY"; // fallback raw passphrase or base64
    private static final int GCM_IV_LENGTH = 12; // 12 bytes for GCM
    private static final int GCM_TAG_LENGTH = 128; // bits

    private SecretKeySpec keySpec;
    private final SecureRandom secureRandom = new SecureRandom();
    private static final Logger LOGGER = Logger.getLogger(ApiKeyAttributeConverter.class.getName());

    public ApiKeyAttributeConverter() {
        try {
            byte[] keyBytes = resolveKeyBytes();
            this.keySpec = new SecretKeySpec(keyBytes, "AES");
        } catch (Exception ex) {
            // Do not fail the Spring bootstrap here; log and defer failure until the converter is actually used.
            LOGGER.warning("Encryption key not available during startup. Set environment variable or system property '" + ENV_KEY + "' to enable encryption at rest.");
            this.keySpec = null;
        }
    }

    private void ensureKey() {
        if (this.keySpec == null) {
            throw new IllegalStateException("Encryption key not configured. Please set environment variable or system property '" + ENV_KEY + "' to a 16/24/32-byte Base64 key or a passphrase.");
        }
    }

    private byte[] resolveKeyBytes() {
        // Prefer environment variable, fall back to system property (useful for tests)
        String env = System.getenv(ENV_KEY);
        if (env == null || env.isEmpty()) {
            env = System.getProperty(ENV_KEY);
        }
        if (env == null || env.isEmpty()) {
            throw new IllegalStateException("Encryption key not set. Please set environment variable or system property " + ENV_KEY);
        }
        // Try base64 decode first
        try {
            byte[] decoded = Base64.getDecoder().decode(env);
            if (decoded.length == 16 || decoded.length == 24 || decoded.length == 32) {
                return normalizeKey(decoded);
            }
        } catch (IllegalArgumentException ignored) { }

        // Not base64 - derive 32 byte key by SHA-256 of the passphrase
        try {
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            return sha.digest(env.getBytes(StandardCharsets.UTF_8));
        } catch (Exception ex) {
            throw new RuntimeException("Failed to derive encryption key", ex);
        }
    }

    private byte[] normalizeKey(byte[] k) {
        if (k.length == 32) return k;
        // if shorter, expand by hashing
        try {
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            return sha.digest(k);
        } catch (Exception ex) {
            throw new RuntimeException(ex);
        }
    }

    @Override
    public String convertToDatabaseColumn(String attribute) {
        if (attribute == null) return null;
        ensureKey();
        try {
            byte[] iv = new byte[GCM_IV_LENGTH];
            secureRandom.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            GCMParameterSpec spec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, spec);
            byte[] ciphertext = cipher.doFinal(attribute.getBytes(StandardCharsets.UTF_8));

            // store iv + ciphertext together
            ByteBuffer bb = ByteBuffer.allocate(iv.length + ciphertext.length);
            bb.put(iv);
            bb.put(ciphertext);
            return Base64.getEncoder().encodeToString(bb.array());
        } catch (Exception ex) {
            throw new RuntimeException("Failed to encrypt api key", ex);
        }
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        if (dbData == null) return null;
        ensureKey();
        try {
            byte[] all = Base64.getDecoder().decode(dbData);
            ByteBuffer bb = ByteBuffer.wrap(all);
            byte[] iv = new byte[GCM_IV_LENGTH];
            bb.get(iv);
            byte[] cipherBytes = new byte[bb.remaining()];
            bb.get(cipherBytes);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            GCMParameterSpec spec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
            cipher.init(Cipher.DECRYPT_MODE, keySpec, spec);
            byte[] plain = cipher.doFinal(cipherBytes);
            return new String(plain, StandardCharsets.UTF_8);
        } catch (Exception ex) {
            throw new RuntimeException("Failed to decrypt api key", ex);
        }
    }
}
