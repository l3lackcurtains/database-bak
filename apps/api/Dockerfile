FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/webapp/package.json apps/webapp/package.json
RUN npm install --legacy-peer-deps

COPY turbo.json ./
COPY apps/api apps/api
RUN npx turbo run build --filter=@database-bak/api

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY apps/api/package.json package.json
RUN npm install --omit=dev --legacy-peer-deps

COPY --from=builder /app/apps/api/dist ./dist
EXPOSE 7301
CMD ["node", "dist/src/main"]
