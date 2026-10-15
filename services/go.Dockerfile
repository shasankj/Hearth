# Multi-stage build: compile in a big image, ship only the static binary in a tiny one.
# Usage: docker build -f services/go.Dockerfile --build-arg PKG=./services/listing -t hearth/listing .
FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
# separate layer: cached until go.mod changes
RUN go mod download
COPY . .
ARG PKG
RUN CGO_ENABLED=0 go build -o /out/app ${PKG}

FROM alpine:3.20
RUN adduser -D -u 10001 app
# never run as root in a container
USER 10001
COPY --from=build /out/app /app
ENTRYPOINT ["/app"]
