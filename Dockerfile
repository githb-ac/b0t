FROM node:20-alpine

# Install build dependencies
RUN apk add --no-cache git python3 make g++

# Set working directory
WORKDIR /app

# Copy package files first (for better caching)
COPY package*.json ./
COPY drizzle.config.ts ./

# Install dependencies
RUN npm ci --production=false || npm install --production=false

# Copy the rest of the application code
COPY . .

# Generate Prisma client and run build
RUN npm run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/services/status', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", ".next/standalone/server.js"]
