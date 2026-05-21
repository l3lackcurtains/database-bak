FROM oven/bun:1.3 AS builder
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/webapp/package.json apps/webapp/package.json
RUN bun install --frozen-lockfile --workspaces

COPY turbo.json ./
COPY apps/api apps/api
RUN bun run --filter=@database-bak/api build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY apps/api/package.json package.json
RUN npm install --omit=dev --legacy-peer-deps

COPY --from=builder /app/apps/api/dist ./dist
EXPOSE 3000
CMD ["node", "dist/src/main"]
