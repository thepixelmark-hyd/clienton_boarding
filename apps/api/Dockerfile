# syntax=docker/dockerfile:1.7
#
# Builds the NestJS API into a standalone runtime image.
#
# IMPORTANT: the build context for this file must be the repo ROOT, not
# apps/api — this is a pnpm workspace and the API depends on the sibling
# packages @clientos/database and @clientos/shared via the `workspace:*`
# protocol, which only resolve when the whole workspace is visible.
# Build from the repo root, e.g.:
#   docker build -f apps/api/Dockerfile -t clientos-api .

FROM node:20-slim AS base
RUN corepack enable
WORKDIR /repo

# ---- deps: install once, cached as long as manifests/lockfile don't change ----
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

# ---- build: compile the workspace packages the API actually needs ----
FROM deps AS build
COPY packages/shared packages/shared
COPY packages/database packages/database
COPY apps/api apps/api
RUN pnpm --filter @clientos/shared build
RUN pnpm --filter @clientos/database build
RUN pnpm --filter @clientos/api build
RUN pnpm prune --prod

# ---- runtime: only the built output + production node_modules ----
FROM node:20-slim AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/packages/shared ./packages/shared
COPY --from=build /repo/packages/database ./packages/database
COPY --from=build /repo/apps/api ./apps/api

# Runs as an unprivileged user rather than the image's default root.
RUN groupadd --system clientos && useradd --system --gid clientos clientos
USER clientos

EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
