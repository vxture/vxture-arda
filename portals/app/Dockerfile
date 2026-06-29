ARG NODE_BASE_IMAGE=node:22-alpine

# Build context is the portals/ workspace root (npm workspaces). This image
# builds the @arda/app workspace; shared code comes from the internal
# @arda/shared package, hoisted by the single workspace install.
FROM ${NODE_BASE_IMAGE} AS deps
WORKDIR /app
ARG VXTURE_NPM_REGISTRY=https://npm.pkg.github.com
ARG NODE_AUTH_TOKEN
# Root manifest + single lockfile + every workspace member manifest (npm ci
# needs them all to resolve the workspace).
COPY package.json package-lock.json ./
COPY app/package.json ./app/package.json
COPY packages/shared/package.json ./packages/shared/package.json
# Write the actual token value directly into .npmrc (shell expands $NODE_AUTH_TOKEN
# from the build-arg). npm's own ${...} substitution from .npmrc does not reliably
# resolve build-arg values inside the Docker BuildKit container driver, causing
# persistent 401 errors. The file is deleted after npm ci; the deps stage is
# intermediate and never pushed, so the token does not leak to production.
RUN printf '@vxture:registry=%s\n//npm.pkg.github.com/:_authToken=%s\n' \
      "$VXTURE_NPM_REGISTRY" "$NODE_AUTH_TOKEN" > .npmrc \
    && npm ci \
    && rm -f .npmrc

FROM ${NODE_BASE_IMAGE} AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* vars are baked into the browser bundle at build time. Pass them
# as build args so CI can inject the correct value per stack (prod vs beta).
ARG NEXT_PUBLIC_APP_ENV=prod
ARG NEXT_PUBLIC_PROD_URL=https://arda.vxture.com
ARG NEXT_PUBLIC_BETA_URL=https://beta-arda.vxture.com
ENV NEXT_PUBLIC_APP_ENV=${NEXT_PUBLIC_APP_ENV}
ENV NEXT_PUBLIC_PROD_URL=${NEXT_PUBLIC_PROD_URL}
ENV NEXT_PUBLIC_BETA_URL=${NEXT_PUBLIC_BETA_URL}
# Bring the full installed workspace from deps: root + per-workspace
# node_modules and the @arda symlinks (npm does not hoist @vxture/ioredis/jose
# to root). Then overlay source; node_modules are dockerignored so they survive.
COPY --from=deps /app ./
COPY . .
RUN npm run build -w @arda/app

FROM ${NODE_BASE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Next.js standalone server binds to $HOSTNAME; Docker sets HOSTNAME to the
# container id, so without this it listens only on the container IP and a
# 127.0.0.1 healthcheck cannot reach it. Bind all interfaces instead.
ENV HOSTNAME=0.0.0.0
ENV PORT=3230
# Prisma CLI for `migrate deploy` at startup. Prisma 7 is Rust-free (schema
# engine bundled), so there is no engine-binary download and no openssl/musl
# target to manage.
RUN npm install -g prisma@7.8.0
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs
# Monorepo standalone output is nested under the workspace dir (app/).
COPY --from=builder --chown=nextjs:nextjs /app/app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/app/.next/static ./app/.next/static
COPY --from=builder --chown=nextjs:nextjs /app/app/public ./app/public
# Schema + migrations + config so the entrypoint can apply migrations at start.
COPY --from=builder --chown=nextjs:nextjs /app/app/prisma ./app/prisma
COPY --from=builder --chown=nextjs:nextjs /app/app/prisma.config.ts ./app/prisma.config.ts
COPY --chown=nextjs:nextjs app/docker-entrypoint.sh ./docker-entrypoint.sh
USER nextjs
EXPOSE 3230
ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
