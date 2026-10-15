FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
COPY services/inspection/src src
RUN mkdir /out
RUN javac -d /out $(find src/main -name '*.java')
# JDBC driver for Postgres (a single jar, fetched from Maven Central)
ADD https://repo1.maven.org/maven2/org/postgresql/postgresql/42.7.4/postgresql-42.7.4.jar /out/postgresql.jar
# ADD from a URL creates a root-only file (mode 600); the runtime user (nobody) must be able to read it
RUN chmod 0644 /out/postgresql.jar

FROM eclipse-temurin:21-jre
COPY --from=build /out /app
USER nobody
CMD ["java", "-cp", "/app:/app/postgresql.jar", "com.hearth.inspection.App"]
