FROM node:22-alpine AS builder
WORKDIR /app

COPY apps/webapp/package.json ./apps/webapp/
RUN npm install --prefix apps/webapp --legacy-peer-deps

COPY apps/webapp ./apps/webapp
RUN npm run build --prefix apps/webapp

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
