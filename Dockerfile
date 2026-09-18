FROM node:22.20.0-bookworm-slim@sha256:b21fe589dfbe5cc39365d0544b9be3f1f33f55f3c86c87a76ff65a02f8f5848e

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

COPY . .
RUN pnpm install --frozen-lockfile && pnpm run build
RUN test -d services/context/dist/migrations \
  && find services/context/dist/migrations -maxdepth 1 -type f -name '*.sql' -print -quit | grep -q .
RUN mkdir -p /app/data && chown node:node /app/data

ENV NODE_ENV=production
USER node
CMD ["pnpm", "--filter", "@ecorione/ai", "start"]
