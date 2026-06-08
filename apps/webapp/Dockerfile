FROM node:22-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/webapp/package.json apps/webapp/package.json
RUN pnpm install --no-frozen-lockfile

COPY turbo.json ./
COPY apps/webapp apps/webapp
RUN pnpm --filter=@database-bak/web build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

RUN npm install -g pnpm

COPY apps/webapp/package.json package.json
RUN pnpm install --prod --no-frozen-lockfile

COPY --from=builder /app/apps/webapp/.next ./.next
COPY --from=builder /app/apps/webapp/public ./public
COPY --from=builder /app/apps/webapp/next.config.ts ./
EXPOSE 7300
ENV PORT=7300
CMD ["npm", "run", "start"]
