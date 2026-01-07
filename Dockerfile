FROM node:20-alpine

RUN apk add --no-cache git python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

RUN npm run db:push

RUN npx tsx scripts/seed-admin.ts

EXPOSE 3000

ENV NODE_ENV=production
ENV NODE_OPTIONS=--max_old_space_size=4096
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/services/status || exit 1

CMD ["node", ".next/standalone/server.js"]

