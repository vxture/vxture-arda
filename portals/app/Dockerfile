ARG NODE_BASE_IMAGE=node:22-alpine

# Build context is the portals/ workspace root (pnpm workspace). This image
# builds the @arda/app workspace; shared code comes from the internal
# @arda/shared package, linked by the single workspace install. node-linker is
# pinned to `hoisted` (in .npmrc) so pnpm produces a flat node_modules the
# Next.js standalone build + the deps-stage COPY below rely on.
FROM ${NODE_BASE_IMAGE} AS deps
WORKDIR /app
ARG VXTURE_NPM_REGISTRY=https://npm.pkg.github.com
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
# Root manifest + lockfile + workspace file + every member manifest (pnpm needs
# them all to resolve the workspace before install).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY app/package.json ./app/package.json
COPY packages/shared/package.json ./packages/shared/package.json
# The @vxture registry PAT rides a BuildKit secret mount, not a build-arg: a
# build-arg is recorded in image/build metadata and can persist into the
# exported layer cache (cache-to gha,mode=max), leaking the token. The secret
# is mounted as a file for this RUN only, read into .npmrc, and the .npmrc is
# deleted in the same layer (the deps stage is intermediate and never pushed).
RUN --mount=type=secret,id=node_auth_token \
    printf '@vxture:registry=%s\nnode-linker=hoisted\n//npm.pkg.github.com/:_authToken=%s\n' \
      "$VXTURE_NPM_REGISTRY" "$(cat /run/secrets/node_auth_token)" > .npmrc \
    && pnpm install --frozen-lockfile \
    && rm -f .npmrc

FROM ${NODE_BASE_IMAGE} AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
# NEXT_PUBLIC_* vars are baked into the browser bundle at build time. Pass them
# as build args so CI can inject the correct value per stack (prod vs beta).
ARG NEXT_PUBLIC_APP_ENV=prod
ARG NEXT_PUBLIC_PROD_URL=https://arda.vxture.com
ARG NEXT_PUBLIC_BETA_URL=https://beta-arda.vxture.com
ARG NEXT_PUBLIC_CONSOLE_URL=https://console.vxture.com
ENV NEXT_PUBLIC_APP_ENV=${NEXT_PUBLIC_APP_ENV}
ENV NEXT_PUBLIC_PROD_URL=${NEXT_PUBLIC_PROD_URL}
ENV NEXT_PUBLIC_BETA_URL=${NEXT_PUBLIC_BETA_URL}
ENV NEXT_PUBLIC_CONSOLE_URL=${NEXT_PUBLIC_CONSOLE_URL}
# Bring the full installed workspace from deps: the hoisted node_modules and the
# @arda workspace links. Then overlay source; node_modules are dockerignored so
# they survive.
COPY --from=deps /app ./
COPY . .
RUN pnpm --filter @arda/app run build

FROM ${NODE_BASE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Next.js standalone server binds to $HOSTNAME; Docker sets HOSTNAME to the
# container id, so without this it listens only on the container IP and a
# 127.0.0.1 healthcheck cannot reach it. Bind all interfaces instead.
ENV HOSTNAME=0.0.0.0
ENV PORT=3230
# No prisma CLI in the runtime image: DB structure is owned by the hand-written
# DDL under deploy/database/ddl/ and applied only via the db-init workflow
# (org governance #7) - the container never migrates at startup.
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs
# Monorepo standalone output is nested under the workspace dir (app/).
COPY --from=builder --chown=nextjs:nextjs /app/app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/app/.next/static ./app/.next/static
COPY --from=builder --chown=nextjs:nextjs /app/app/public ./app/public
COPY --chown=nextjs:nextjs app/docker-entrypoint.sh ./docker-entrypoint.sh
USER nextjs
EXPOSE 3230
ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
