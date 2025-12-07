FROM maven:3.8.6-openjdk-17 AS build
WORKDIR /app
COPY pom.xml ./
COPY src ./src
RUN mvn -B package -DskipTests

FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
COPY --from=build /app/target/trafic-track-backend-0.0.1-SNAPSHOT.jar app.jar
ENV PORT=8081
EXPOSE ${PORT}
ENTRYPOINT ["java","-jar","/app/app.jar"]
