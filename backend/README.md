# Traffic Track Backend

Spring Boot backend service for the Traffic Track application.

## Quick Start

### Option 1: Using the Start Script (Easiest)

**Windows:**
```cmd
cd k:\Projects\Trafic_Track\backend
start-backend.bat
```

This automatically sets all required environment variables and starts the server.

### Option 2: Manual Setup

See [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md) for detailed instructions on setting environment variables manually.

## Configuration

The application requires the following environment variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `SPRING_DATASOURCE_URL` | PostgreSQL database connection URL | Yes |
| `SPRING_DATASOURCE_USERNAME` | Database username | Yes |
| `SPRING_DATASOURCE_PASSWORD` | Database password | Yes |
| `APP_ENC_KEY` | Encryption key for API credentials | Yes |

## API Endpoints

### Health Check
- `GET /health` - Overall service health
- `GET /health/db` - Database connectivity check

### Swarm Data (Stored in Database)
- `GET /api/swarm` - Get swarm/traffic grid data from database (auto-initializes if empty)
- `POST /api/swarm/initialize` - Initialize/reinitialize grid with default data
- `POST /api/swarm/update-congestion` - Update congestion levels for all intersections/roads
- `DELETE /api/swarm` - Clear all swarm data from database

### API Credentials (Encrypted)
- `POST /api/credentials` - Save API provider credentials
- `GET /api/credentials/latest` - Get latest saved credential (masked)

### Vehicles
- `GET /api/vehicles` - List all vehicles
- `POST /api/vehicles` - Create a new vehicle

## Building

```bash
mvn clean package
```

## Running Tests

```bash
mvn test
```

## Technology Stack

- Spring Boot 3.1.5
- Spring Data JPA
- PostgreSQL (Neon Cloud)
- Java 17+
- AES-GCM encryption for sensitive data

## Security

- API credentials are encrypted at rest using AES-GCM
- Database credentials should be set via environment variables
- Never commit `.env` file to version control
