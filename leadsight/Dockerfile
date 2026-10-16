# syntax=docker/dockerfile:1

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# One-shot migration runner: applies drizzle/ migrations, then seeds the dev user when DEV_USER_ID is set.
FROM deps AS migrate
COPY drizzle ./drizzle
COPY scripts ./scripts
COPY src/lib/db/schema.ts ./src/lib/db/schema.ts
CMD ["sh", "-c", "npx tsx scripts/migrate.ts && if [ -n \"$DEV_USER_ID\" ]; then npx tsx scripts/seed-dev.ts; fi"]

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Placeholders so route modules can be imported while Next collects page data.
# Nothing connects at build time; the real values come from the runtime environment.
RUN DATABASE_URL=postgres://build:build@localhost:5432/build \
    BETTER_AUTH_SECRET=build-time-placeholder-not-used-at-runtime \
    npm run build

FROM node:22-slim AS runner
WORKDIR /app

# Debian Chromium + fonts for Puppeteer PDF export and demo screenshots.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    chromium fonts-liberation fonts-dejavu-core fonts-noto-color-emoji ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    CHROME_EXECUTABLE_PATH=/usr/bin/chromium \
    UPLOAD_DIR=/data/uploads

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

RUN mkdir -p /data/uploads /app/logs && chown -R node:node /data/uploads /app/logs

USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://localhost:3000/login').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
