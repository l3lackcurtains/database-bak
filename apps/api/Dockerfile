FROM node:22-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/webapp/package.json apps/webapp/package.json
RUN pnpm install --no-frozen-lockfile

COPY turbo.json ./
COPY apps/api apps/api
RUN pnpm --filter=@database-bak/api build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

RUN npm install -g pnpm

COPY apps/api/package.json package.json
RUN pnpm install --prod --no-frozen-lockfile

COPY --from=builder /app/apps/api/dist ./dist
EXPOSE 7301
CMD ["node", "dist/src/main"]
