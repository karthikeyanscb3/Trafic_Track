# Environment Setup

## Required Environment Variables

Before running the backend, you must set the following environment variables:

### Windows (Command Prompt)
```cmd
cd k:\Projects\Trafic_Track\backend
set SPRING_DATASOURCE_URL=jdbc:postgresql://ep-raspy-butterfly-ahecpxtd-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
set SPRING_DATASOURCE_USERNAME=neondb_owner
set SPRING_DATASOURCE_PASSWORD=npg_rhD1SKFXfPl0
set APP_ENC_KEY=MySecureEncryptionKey123456789012
mvn spring-boot:run
```

### Windows (PowerShell)
```powershell
cd k:\Projects\Trafic_Track\backend
$env:SPRING_DATASOURCE_URL="jdbc:postgresql://ep-raspy-butterfly-ahecpxtd-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
$env:SPRING_DATASOURCE_USERNAME="neondb_owner"
$env:SPRING_DATASOURCE_PASSWORD="npg_rhD1SKFXfPl0"
$env:APP_ENC_KEY="MySecureEncryptionKey123456789012"
mvn spring-boot:run
```

### Linux/Mac
```bash
cd k:/Projects/Trafic_Track/backend
export SPRING_DATASOURCE_URL="jdbc:postgresql://ep-raspy-butterfly-ahecpxtd-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
export SPRING_DATASOURCE_USERNAME="neondb_owner"
export SPRING_DATASOURCE_PASSWORD="npg_rhD1SKFXfPl0"
export APP_ENC_KEY="MySecureEncryptionKey123456789012"
mvn spring-boot:run
```

## Generating a Secure Encryption Key

For production, generate a secure encryption key:

```bash
# Linux/Mac/Git Bash
openssl rand -base64 32

# Or use online generator: https://generate-random.org/encryption-key-generator
```

## Using .env File (Development Only)

The `.env` file is already configured with development credentials. However, Spring Boot doesn't automatically load `.env` files. You can either:

1. **Manually set environment variables** (recommended for Windows CMD)
2. **Use an IDE** like IntelliJ IDEA or Eclipse to configure environment variables in the run configuration
3. **Use a tool** like `dotenv` for Node.js-style `.env` loading

## Verifying Setup

After setting environment variables and starting the backend:

```bash
# Check health endpoint
curl http://localhost:8080/health

# Expected response:
# {"service":"Trafic Track Backend","db":{"value":1,"status":"UP"},"status":"UP"}
```

## Important Notes

- The default values in `application.properties` are for **development only**
- **Never commit** production credentials to version control
- The `APP_ENC_KEY` is **required** for saving API credentials
- Without `APP_ENC_KEY`, the `/api/credentials` endpoint will return 500 error
