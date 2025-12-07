package com.traffictrack.backend.crypto;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

public class ApiKeyAttributeConverterTest {

    @BeforeAll
    public static void setup() {
        // ensure the converter can find a key via system property for the test
        System.setProperty("APP_ENC_KEY", "test-passphrase-12345");
    }

    @Test
    public void testEncryptDecrypt() {
        ApiKeyAttributeConverter conv = new ApiKeyAttributeConverter();
        String original = "sk_test_ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        String db = conv.convertToDatabaseColumn(original);
        assertNotNull(db);
        assertNotEquals(original, db);
        String out = conv.convertToEntityAttribute(db);
        assertEquals(original, out);
    }
}
