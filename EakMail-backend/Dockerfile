# EakMail backend image — API + workers + bot in one process (ARCHITECTURE.md §12).
# Built from the repo root so the pnpm workspace + shared-types resolve.
FROM node:20-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
# argon2 needs a build toolchain for its native addon.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# --- deps: install with the full workspace manifest set ---
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared-types/package.json packages/shared-types/
COPY EakMail-backend/package.json EakMail-backend/
COPY EakMail-frontend/package.json EakMail-frontend/
RUN pnpm install --frozen-lockfile=false

# --- build: generate prisma client + compile TS ---
FROM deps AS build
COPY packages/shared-types packages/shared-types
COPY EakMail-backend EakMail-backend
RUN pnpm --filter @eakmail/backend prisma:generate \
  && pnpm --filter @eakmail/backend build

# --- runtime ---
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/packages /app/packages
COPY --from=build /app/EakMail-backend/dist /app/EakMail-backend/dist
COPY --from=build /app/EakMail-backend/prisma /app/EakMail-backend/prisma
COPY --from=build /app/EakMail-backend/package.json /app/EakMail-backend/package.json
WORKDIR /app/EakMail-backend
# Apply migrations then start. Uses prisma from the workspace node_modules.
CMD ["sh", "-c", "node ../node_modules/prisma/build/index.js migrate deploy && node dist/index.js"]
