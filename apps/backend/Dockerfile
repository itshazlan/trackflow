FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PNPM_HOME/bin:$PATH"
RUN npm install -g pnpm@10.33.0

FROM base AS pruner
WORKDIR /app
RUN pnpm add -g turbo
COPY . .
RUN turbo prune @trackflow/backend --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=pruner /app/out/full/ .
COPY --from=installer /app/ .
RUN pnpm run build --filter=@trackflow/backend

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Salin file-file yang diperlukan untuk production run
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend ./apps/backend
COPY --from=builder /app/packages/shared-types ./packages/shared-types

EXPOSE 3000
CMD ["sh", "-c", "pnpm --filter @trackflow/backend db:migrate && pnpm --filter @trackflow/backend start:prod"]
