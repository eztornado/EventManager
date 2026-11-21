# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=24
ARG RUST_VERSION=1.99

# ---------------------------------------------------------------- frontend
FROM node:${NODE_VERSION}-alpine AS frontend

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ----------------------------------------------------------------- backend
FROM rust:${RUST_VERSION}-bookworm AS builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends pkg-config libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY Cargo.toml Cargo.lock ./
COPY app ./app
COPY config ./config
COPY database ./database
COPY public ./public
COPY resources ./resources
COPY routes ./routes
COPY src ./src

RUN cargo build --release --locked

# ----------------------------------------------------------------- runtime
FROM debian:bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        gosu \
        tini \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 eventmanager \
    && useradd --uid 10001 --gid eventmanager \
        --no-create-home --home-dir /app --shell /usr/sbin/nologin eventmanager

WORKDIR /app

COPY --from=builder /build/target/release/eventmanager /usr/local/bin/eventmanager
COPY --from=frontend /app/frontend/dist ./frontend/dist
COPY database ./database
COPY public ./public
COPY resources ./resources
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh \
    && mkdir -p /app/database /app/storage/logs \
    && chown -R eventmanager:eventmanager /app

ENV LARUST_APP_ROOT=/app \
    APP_ENV=production \
    APP_DEBUG=false \
    APP_HOST=0.0.0.0 \
    APP_PORT=8080 \
    DB_CONNECTION=sqlite \
    DB_DATABASE=storage/database.sqlite \
    LOG_CHANNEL=stdout \
    SESSION_SECURE_COOKIE=true

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT:-${APP_PORT:-8080}}/api/health" || exit 1

# The entrypoint starts as root only to make mounted volumes writable, then
# drops to the unprivileged `eventmanager` user before running migrations/app.
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/entrypoint.sh"]
