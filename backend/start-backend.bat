@echo off
REM Traffic Track Backend - Start Script
REM This script sets the required environment variables and starts the backend

echo Setting up environment variables...

REM Database Configuration
set SPRING_DATASOURCE_URL=jdbc:postgresql://ep-raspy-butterfly-ahecpxtd-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require^&channel_binding=require
set SPRING_DATASOURCE_USERNAME=neondb_owner
set SPRING_DATASOURCE_PASSWORD=npg_rhD1SKFXfPl0

REM Encryption Key for API Credentials
REM IMPORTANT: Change this to a secure random key for production!
set APP_ENC_KEY=MySecureEncryptionKey123456789012

echo.
echo Environment variables set:
echo - Database: Neon PostgreSQL
echo - Encryption: Enabled
echo.
echo Starting backend server...
echo.

mvn spring-boot:run
