# syntax=docker/dockerfile:1

FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate
WORKDIR /app

# ---- fetch: populate the pnpm store from lockfile + manifests only ----
FROM base AS fetch
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/core/package.json packages/core/package.json
COPY packages/google-fonts/package.json packages/google-fonts/package.json
COPY packages/player/package.json packages/player/package.json
COPY packages/transitions/package.json packages/transitions/package.json
COPY packages/vite/package.json packages/vite/package.json
COPY packages/docs/package.json packages/docs/package.json
RUN pnpm fetch

# ---- build: full source, install + build only docs' dependency chain ----
FROM fetch AS build
COPY . .
RUN pnpm install --filter "@smoove/docs..." --frozen-lockfile --offline
RUN pnpm --filter "@smoove/docs..." run build
RUN pnpm --filter @smoove/docs deploy --prod --legacy /app/deploy

# ---- runtime: pruned prod node_modules + the SSR build output ----
FROM base AS runtime
COPY --from=build /app/deploy /app
COPY --from=build /app/packages/docs/build /app/build
ENV PORT=3000 NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "start"]
