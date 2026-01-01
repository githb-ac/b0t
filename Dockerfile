FROM node:20-alpine

RUN apk add --no-cache git python3 make g++

WORKDIR /app

COPY . .

RUN npm install --production=false

RUN npm run build

EXPOSE 3000

ENV NODE_ENV=production
ENV NODE_OPTIONS=--max_old_space_size=4096

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/services/status || exit 1

CMD ["node", ".next/standalone/server.js"]
