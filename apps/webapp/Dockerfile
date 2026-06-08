FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/webapp/package.json apps/webapp/package.json
RUN npm install --legacy-peer-deps

COPY turbo.json ./
COPY apps/webapp apps/webapp
RUN npx turbo run build --filter=@database-bak/web

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY apps/webapp/package.json package.json
RUN npm install --omit=dev --legacy-peer-deps

COPY --from=builder /app/apps/webapp/.next ./.next
COPY --from=builder /app/apps/webapp/public ./public
COPY --from=builder /app/apps/webapp/next.config.ts ./
EXPOSE 7300
ENV PORT=7300
CMD ["npm", "run", "start"]
