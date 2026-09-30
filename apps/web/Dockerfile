# syntax=docker/dockerfile:1.7
#
# Builds the Next.js web app into a standalone runtime image.
#
# IMPORTANT: the build context for this file must be the repo ROOT, not
# apps/web — this is a pnpm workspace and the app depends on the sibling
# package @clientos/shared via the `workspace:*` protocol. Build from the
# repo root, e.g.:
#   docker build -f apps/web/Dockerfile -t clientos-web .
#
# NEXT_PUBLIC_* values are baked into the client bundle at build time (that's
# how Next works), so the API URL the deployed app calls must be known at
# image-build time, not just at container-start time. Override it with
# --build-arg for anything other than the default.

FROM node:20-slim AS base
RUN corepack enable
WORKDIR /repo

# ---- deps: install once, cached as long as manifests/lockfile don't change ----
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM deps AS build
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @clientos/shared build
RUN pnpm --filter @clientos/web build

# ---- runtime: the traced standalone server only ----
FROM node:20-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public

RUN groupadd --system clientos && useradd --system --gid clientos clientos
USER clientos

EXPOSE 3000
ENV PORT=3000
CMD ["node", "apps/web/server.js"]
