FROM node:22.20.0-bookworm-slim

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

COPY . .
RUN pnpm install --frozen-lockfile && pnpm run build
RUN mkdir -p /app/data && chown node:node /app/data

ENV NODE_ENV=production
USER node
CMD ["pnpm", "--filter", "@ecorione/ai", "start"]
