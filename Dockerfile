# syntax=docker/dockerfile:1.6
# ----------------------------------------------------------------------------
# Astro SCO – multi-stage Dockerfile
#
# Build stage compiles the static site with pnpm + Node 20.
# Runtime stage serves dist/ via nginx:alpine.
#
# Required build args (set in Dokploy as build-time env or build args):
#   DIRECTUS_URL      e.g. https://cms.dart.ingomc.de
#   DIRECTUS_TOKEN    bearer token with read access
#   SITE_URL          e.g. https://www.sc-oberfuellbach.de/
#   STAGING           "1" for preview builds (skips analytics, noindex)
#   EXTRA_IMAGE_DOMAINS  optional, comma-separated
# ----------------------------------------------------------------------------

# -------- Stage 1: build ---------------------------------------------------
FROM node:20-bookworm-slim AS build

# Build-time env (consumed by astro.config.mjs, content-source.ts, etc.)
ARG DIRECTUS_URL
ARG DIRECTUS_TOKEN
ARG SITE_URL=https://www.sc-oberfuellbach.de/
ARG SITE_HOST=sc-oberfuellbach.de
ARG STAGING=0
ARG EXTRA_IMAGE_DOMAINS=
ARG DEPLOY_TARGET=

ENV DIRECTUS_URL=${DIRECTUS_URL} \
    DIRECTUS_TOKEN=${DIRECTUS_TOKEN} \
    DIRECTUS_BASE_URL=${DIRECTUS_URL} \
    DIRECTUS_PUBLIC_URL=${DIRECTUS_URL} \
    SITE_URL=${SITE_URL} \
    SITE_HOST=${SITE_HOST} \
    STAGING=${STAGING} \
    EXTRA_IMAGE_DOMAINS=${EXTRA_IMAGE_DOMAINS} \
    DEPLOY_TARGET=${DEPLOY_TARGET} \
    NODE_ENV=production \
    CI=true

# System deps for sharp + native modules
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 build-essential ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Enable pnpm via corepack (matches package.json packageManager pin)
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Install deps with caching friendly layer order
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --ignore-scripts

# Build the site
COPY . .
RUN pnpm run build

# -------- Stage 2: runtime (nginx) ----------------------------------------
FROM nginx:1.27-alpine AS runtime

# Drop the default config
RUN rm /etc/nginx/conf.d/default.conf
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/security-headers.conf /etc/nginx/security-headers.conf

# Static site
COPY --from=build /app/dist /usr/share/nginx/html

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
