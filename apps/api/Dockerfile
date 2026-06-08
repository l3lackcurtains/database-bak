FROM node:22-alpine AS builder
WORKDIR /app

COPY apps/api/package.json ./apps/api/
RUN npm install --prefix apps/api --legacy-peer-deps

COPY apps/api ./apps/api
RUN npm run build --prefix apps/api

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY apps/api/package.json package.json
RUN npm install --omit=dev --legacy-peer-deps

COPY --from=builder /app/apps/api/dist ./dist
EXPOSE 7301
CMD ["node", "dist/src/main"]
