# syntax=docker/dockerfile:1
#
# منصة مذكرتي — one image: the API, the web client, and live updates, served
# by one Node process (Backend/src/app.ts serves client/dist in production).
#
# Built from the repository root; `.dockerignore` keeps out every .env, the
# demo accounts (Backend/dev-only), the tests, and what is built in here.
# Secrets are never baked in: they are given at run time (deploy/.env).
#
#   docker build -t mudhakkirati .
#
# See deploy/README.md for running it with the database and HTTPS.

ARG NODE_VERSION=24

# ── 1. The web client ─────────────────────────────────────────
FROM node:${NODE_VERSION}-slim AS client
WORKDIR /src/client
COPY client/package.json client/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY client/ ./
# No VITE_* variables: the client then calls its own address (/api, and the
# socket on the same origin), which is what the proxy in front of it serves.
RUN npm run build

# ── 2. The server ─────────────────────────────────────────────
FROM node:${NODE_VERSION}-slim AS server
# Prisma's migration engine needs OpenSSL.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /src/Backend
COPY Backend/package.json Backend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY Backend/ ./
RUN npx prisma generate \
 && npm run build \
 && npm prune --omit=dev --no-audit --no-fund

# ── 3. What runs ──────────────────────────────────────────────
FROM node:${NODE_VERSION}-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app/Backend
COPY --from=server /src/Backend/package.json /src/Backend/package-lock.json ./
COPY --from=server /src/Backend/node_modules ./node_modules
COPY --from=server /src/Backend/dist ./dist
COPY --from=server /src/Backend/prisma ./prisma
COPY --from=server /src/Backend/prisma.config.ts ./
# The address databases (Backend/geo/README.md), when they were there at build
# time: the audit log places each address without asking anyone else.
COPY --from=server /src/Backend/geo ./geo
COPY --from=client /src/client/dist /app/client/dist

# Public uploads (pictures shown on the site) and private files (ID photos,
# message attachments — never served as they are). Both are volumes: they
# must outlive the container. Created here so a new volume starts out owned
# by the user the server runs as.
RUN mkdir -p uploads storage/activation storage/messages \
 && chown -R node:node uploads storage

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

# The database schema is brought up to date before the server starts; on a
# new database this creates every table. `exec` hands the process over to
# Node, so it receives the stop signal and closes cleanly.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && exec node dist/server.js"]
