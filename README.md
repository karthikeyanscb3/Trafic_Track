Trafic_Track - Fullstack scaffold

This workspace contains two folders:

- backend: Spring Boot (Java) API structured in MVC (model, repository, service, controller)
- frontend: React app (simple view + service) to consume backend API

Run instructions (Windows cmd.exe):

Backend (requires Java 17 and Maven):

    cd K:\Projects\Trafic_Track\backend
    mvn spring-boot:run

The backend will run at http://localhost:8080 and exposes /api/vehicles

Frontend (requires Node >=16 & npm):

    cd K:\Projects\Trafic_Track\frontend
    npm install
    npm start

The frontend expects the backend at http://localhost:8080 (CORS enabled for localhost:3000)

Docker (build + run both services):

    cd K:\Projects\Trafic_Track
    docker-compose up --build

This will build the backend and frontend images. Backend will be available at http://localhost:8080 and frontend at http://localhost:3000.
