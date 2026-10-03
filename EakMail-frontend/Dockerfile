# EakMail dashboard image — static build served by nginx, proxying /api + /ws to backend.
FROM node:20-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared-types/package.json packages/shared-types/
COPY EakMail-frontend/package.json EakMail-frontend/
COPY EakMail-backend/package.json EakMail-backend/
RUN pnpm install --frozen-lockfile=false
COPY packages/shared-types packages/shared-types
COPY EakMail-frontend EakMail-frontend
RUN pnpm --filter @eakmail/frontend build

FROM nginx:alpine AS runtime
COPY EakMail-frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/EakMail-frontend/dist /usr/share/nginx/html
EXPOSE 80
