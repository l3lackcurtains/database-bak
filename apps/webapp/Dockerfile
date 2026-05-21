FROM oven/bun:1.3 AS builder
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/webapp/package.json apps/webapp/package.json
RUN bun install --frozen-lockfile --workspaces

COPY turbo.json ./
COPY apps/webapp apps/webapp
RUN bun run --filter=@database-bak/web build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY apps/webapp/package.json package.json
RUN npm install --omit=dev --legacy-peer-deps

COPY --from=builder /app/apps/webapp/.next ./.next
COPY --from=builder /app/apps/webapp/public ./public
COPY --from=builder /app/apps/webapp/next.config.ts ./
EXPOSE 7100
ENV PORT=7100
CMD ["npm", "run", "start"]
